import { createError } from 'h3'
import { z } from 'zod'
import { type MaukagaDatabase, useDb } from '../database'
import {
  findPengajuanRecord,
  type PengajuanWithRelations,
} from '../repositories/pengajuan-repository'

const itemNoSchema = z.number().superRefine((itemNo, context) => {
  if (!Number.isInteger(itemNo) || itemNo < 1) {
    context.addIssue({
      code: 'custom',
      message: 'Nomor item tidak valid',
    })
  }
})

export const rejectedUnitLetterInputSchema = z.object({
  itemNos: z.array(itemNoSchema).min(1, 'Pilih minimal satu item'),
}).superRefine((input, context) => {
  const seen = new Set<number>()

  input.itemNos.forEach((itemNo, index) => {
    if (seen.has(itemNo)) {
      context.addIssue({
        code: 'custom',
        path: ['itemNos', index],
        message: 'Nomor item tidak boleh duplikat',
      })
    }
    seen.add(itemNo)
  })
})

export interface RejectedUnitLetterResolution {
  record: PengajuanWithRelations
  items: PengajuanWithRelations['items']
}

export async function resolveRejectedUnitLetterItems(
  idPengajuan: string,
  input: z.input<typeof rejectedUnitLetterInputSchema>,
  database: MaukagaDatabase = useDb(),
): Promise<RejectedUnitLetterResolution> {
  const normalizedIdPengajuan = idPengajuan.trim()
  if (!normalizedIdPengajuan) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID pengajuan wajib diisi',
    })
  }

  const data = rejectedUnitLetterInputSchema.parse(input)
  const record = await findPengajuanRecord(database, normalizedIdPengajuan)

  if (!record) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Pengajuan tidak ditemukan',
    })
  }

  if (record.pengajuan.status === 'Selesai') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Pengajuan Selesai tidak dapat dibuatkan surat',
    })
  }

  const requestedItemNos = new Set(data.itemNos)
  const selectedItems = record.items.filter(item => requestedItemNos.has(item.noItem))

  if (selectedItems.length !== data.itemNos.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Salah satu item tidak ditemukan pada pengajuan ini',
    })
  }

  if (selectedItems.some(item => item.keputusanItem !== 'Ditolak')) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Surat hanya dapat dibuat untuk item yang berstatus Ditolak',
    })
  }

  return {
    record,
    items: selectedItems,
  }
}
