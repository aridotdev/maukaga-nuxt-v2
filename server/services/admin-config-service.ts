import * as z from 'zod'
import { useDb, type MaukagaDatabase } from '../database'
import {
  findConfigRecord,
  listConfigRecords,
  upsertConfigRecord,
} from '../repositories/config-repository'
import { insertAuditLogRecord } from '../repositories/pengajuan-repository'

const configKeySchema = z.string()
  .trim()
  .min(1, 'Key config wajib diisi')
  .max(120, 'Key config terlalu panjang')
  .regex(/^[A-Za-z0-9_.-]+$/, 'Key config tidak valid')

export const saveAdminConfigInputSchema = z.object({
  key: configKeySchema.optional(),
  value: z.string().max(2000, 'Value config terlalu panjang').optional(),
  values: z.record(z.string(), z.string().max(2000, 'Value config terlalu panjang')).optional(),
}).superRefine((input, context) => {
  if (input.values && Object.keys(input.values).length > 0) return
  if (input.key && input.value !== undefined) return

  context.addIssue({
    code: 'custom',
    message: 'Isi key/value atau values config',
  })
})

export interface AdminConfigOptions {
  database?: MaukagaDatabase
  actorId: string
}

export async function listAdminConfig(database = useDb()) {
  const records = await listConfigRecords(database)
  return records.map(mapConfigRecord)
}

export async function saveAdminConfig(
  input: unknown,
  options: AdminConfigOptions,
) {
  const database = options.database ?? useDb()
  const data = saveAdminConfigInputSchema.parse(input)
  const values = data.values && Object.keys(data.values).length > 0
    ? data.values
    : { [data.key as string]: data.value as string }

  for (const key of Object.keys(values)) {
    configKeySchema.parse(key)
  }

  await database.transaction(async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      const previous = await findConfigRecord(tx, key)
      await upsertConfigRecord(tx, { key, value })

      await insertAuditLogRecord(tx, {
        actorId: options.actorId,
        action: 'admin.config-update',
        entityType: 'config',
        entityId: key,
        metadataJson: JSON.stringify({
          key,
          hadPreviousValue: Boolean(previous),
        }),
      })
    }
  })

  return listAdminConfig(database)
}

function mapConfigRecord(record: {
  key: string
  value: string | null
  updatedAt: Date
}) {
  return {
    key: record.key,
    value: record.value ?? '',
    updatedAt: record.updatedAt.toISOString(),
  }
}
