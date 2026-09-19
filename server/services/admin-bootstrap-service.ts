import { randomUUID, timingSafeEqual } from 'node:crypto'
import { createError } from 'h3'
import * as z from 'zod'
import { useDb, type MaukagaDatabase } from '../database'
import {
  countMemberRecords,
  insertMemberAuditLog,
  insertMemberRecord,
} from '../repositories/member-repository'
import { auth } from '../lib/auth'

export const bootstrapAdminInputSchema = z.object({
  email: z.string().trim().pipe(z.email('Format email tidak valid')),
  name: z.string().trim().max(120, 'Nama terlalu panjang').optional().default(''),
  password: z.string().min(8, 'Password minimal 8 karakter').max(200, 'Password terlalu panjang'),
  bootstrapToken: z.string().min(1, 'Token bootstrap wajib diisi'),
})

export interface BootstrapAdminOptions {
  database?: MaukagaDatabase
  bootstrapToken?: string
  hashPassword?: (password: string) => Promise<string>
  now?: Date
}

export async function bootstrapAdmin(
  input: unknown,
  options: BootstrapAdminOptions = {},
) {
  const database = options.database ?? useDb()
  const data = bootstrapAdminInputSchema.parse(input)
  const configuredToken = options.bootstrapToken ?? process.env.ADMIN_BOOTSTRAP_TOKEN?.trim()

  if (!configuredToken) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Bootstrap admin belum dikonfigurasi di server',
    })
  }

  if (!tokensMatch(data.bootstrapToken, configuredToken)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Token bootstrap tidak valid',
    })
  }

  if (await countMemberRecords(database) > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Bootstrap admin sudah tidak tersedia',
    })
  }

  const hashPassword = options.hashPassword ?? hashPasswordWithBetterAuth
  const now = options.now ?? new Date()
  const email = data.email.trim().toLowerCase()
  const name = data.name.trim() || email

  return database.transaction(async (tx) => {
    if (await countMemberRecords(tx) > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Bootstrap admin sudah tidak tersedia',
      })
    }

    const userId = randomUUID()
    const created = await insertMemberRecord(tx, {
      id: userId,
      email,
      name,
      role: 'admin',
      passwordHash: await hashPassword(data.password),
      createdAt: now,
    })

    await insertMemberAuditLog(tx, {
      actorId: userId,
      action: 'admin.bootstrap',
      entityType: 'user',
      entityId: userId,
      metadataJson: JSON.stringify({
        email: created.email,
        role: created.role,
      }),
    })

    return {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      isActive: created.isActive,
    }
  })
}

async function hashPasswordWithBetterAuth(password: string) {
  const context = await auth.$context
  return context.password.hash(password)
}

function tokensMatch(input: string, configured: string) {
  const inputBuffer = Buffer.from(input)
  const configuredBuffer = Buffer.from(configured)

  return inputBuffer.length === configuredBuffer.length
    && timingSafeEqual(inputBuffer, configuredBuffer)
}
