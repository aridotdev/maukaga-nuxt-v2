import { createError } from 'h3'
import { z } from 'zod'
import { type MaukagaDatabase, useDb } from '../database'
import {
  findPengajuanRecord,
  insertAuditLogRecord,
  type PengajuanWithRelations,
} from '../repositories/pengajuan-repository'
import { renderRejectedUnitLetterPdf } from '../renderers/rejected-unit-letter-pdf-renderer'
import {
  getApplicationTimeZone,
  getPengajuanSequenceDate,
} from './pengajuan-id-service'
import { allocateRejectedUnitLetterNumber } from './letter-sequence-service'

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

export interface RejectedUnitLetterViewModelItem {
  noItem: number
  pemilik: string
  model: string
  produk: string
  nomorSeri: string
  keputusanAwal: string
  alasan: string
}

export interface RejectedUnitLetterViewModel {
  nomorSurat: string
  tanggalSurat: string
  tanggalTandaTangan: string
  tempatTandaTangan: string
  idPengajuan: string
  namaPemohon: string
  bagian: string
  cabang: string
  pemilik: string
  items: RejectedUnitLetterViewModelItem[]
  actorId?: string
}

export const REJECTED_UNIT_LETTER_GENERATE_AUDIT_ACTION =
  'pengajuan.rejected-unit-letter-generate'

export interface GenerateRejectedUnitLetterOptions {
  database?: MaukagaDatabase
  actorId: string
  actorRole: string
  now?: Date
  timeZone?: string
  renderPdf?: typeof renderRejectedUnitLetterPdf
}

export interface GeneratedRejectedUnitLetter {
  pdf: Buffer
  viewModel: RejectedUnitLetterViewModel
}

export interface BuildRejectedUnitLetterViewModelOptions {
  nomorSurat: string
  generatedAt?: Date
  timeZone?: string
  actorId?: string
}

export async function generateRejectedUnitLetter(
  idPengajuan: string,
  input: unknown,
  options: GenerateRejectedUnitLetterOptions,
): Promise<GeneratedRejectedUnitLetter> {
  if (options.actorRole !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  const actorId = options.actorId.trim()
  if (!actorId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  const database = options.database ?? useDb()
  const generatedAt = options.now ?? new Date()
  const resolution = await resolveRejectedUnitLetterItems(
    idPengajuan,
    input,
    database,
  )
  const allocatedNumber = await allocateRejectedUnitLetterNumber({
    database,
    now: generatedAt,
    timeZone: options.timeZone,
  })
  const viewModel = buildRejectedUnitLetterViewModel(resolution, {
    nomorSurat: allocatedNumber.letterNumber,
    generatedAt,
    timeZone: options.timeZone,
    actorId,
  })
  const renderPdf = options.renderPdf ?? renderRejectedUnitLetterPdf
  const pdf = await renderPdf(viewModel)

  await insertAuditLogRecord(database, {
    actorId,
    action: REJECTED_UNIT_LETTER_GENERATE_AUDIT_ACTION,
    entityType: 'pengajuan',
    entityId: viewModel.idPengajuan,
    metadataJson: JSON.stringify({
      idPengajuan: viewModel.idPengajuan,
      itemNos: viewModel.items.map(item => item.noItem),
      nomorSurat: viewModel.nomorSurat,
      itemCount: viewModel.items.length,
      actorId,
      generatedAt: generatedAt.toISOString(),
    }),
  })

  return { pdf, viewModel }
}

export async function resolveRejectedUnitLetterItems(
  idPengajuan: string,
  input: unknown,
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

export function buildRejectedUnitLetterViewModel(
  resolution: RejectedUnitLetterResolution,
  options: BuildRejectedUnitLetterViewModelOptions,
): RejectedUnitLetterViewModel {
  const generatedAt = options.generatedAt ?? new Date()
  const timeZone = options.timeZone ?? getApplicationTimeZone()
  const sequenceDate = getPengajuanSequenceDate(generatedAt, timeZone)
  const [year, month, day] = sequenceDate.split('-')
  const tanggalSurat = `${day}/${month}/${year}`
  const tanggalTandaTangan = `${day}-${month}-${year}`
  const { pengajuan: submission } = resolution.record

  return {
    nomorSurat: options.nomorSurat,
    tanggalSurat,
    tanggalTandaTangan,
    tempatTandaTangan: displayValue(submission.cabang),
    idPengajuan: displayValue(submission.idPengajuan),
    namaPemohon: displayValue(submission.nama),
    bagian: displayValue(submission.bagian),
    cabang: displayValue(submission.cabang),
    pemilik: displayValue(submission.pemilik),
    items: resolution.items.map(item => ({
      noItem: item.noItem,
      pemilik: displayValue(submission.pemilik),
      model: displayValue(item.model),
      produk: displayValue(item.produk),
      nomorSeri: displayValue(item.nomorSeri),
      keputusanAwal: displayValue(item.keputusanItem),
      alasan: displayValue(item.catatanKeputusan),
    })),
    ...(options.actorId ? { actorId: options.actorId } : {}),
  }
}

function displayValue(value: string | null | undefined): string {
  const normalizedValue = value?.trim()
  return normalizedValue || '-'
}
