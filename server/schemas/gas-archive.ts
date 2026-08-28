import { z } from 'zod'
import type { InsertArchiveFile, InsertPengajuan, InsertPengajuanItem, InsertStatusLog } from '../database/schema'
import {
  ITEM_DECISION_STATUSES,
  MODEL_REVIEW_STATUSES,
  PENGAJUAN_STATUSES,
  PRINT_STATUSES,
  SHIP_STATUSES,
  WARRANTY_CARD_TYPES,
} from '../database/schema/constants'

const ARCHIVE_PUBLIC_BASE = '/arsip_file'

function toText(value: unknown) {
  if (value instanceof Date) return value.toISOString()
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toNullableText(value: unknown) {
  const text = toText(value)
  return text ? text : null
}

function toNonNegativeInteger(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : value
}

function normalizeArchivePath(value: unknown) {
  const text = toText(value).replace(/\\/g, '/')
  return text || undefined
}

function padEvidenceSequence(sequence: number) {
  return String(sequence).padStart(2, '0')
}

export function buildArchiveFileName(idPengajuan: string, kind: 'hardcopy' | 'bukti', sequence = 0) {
  if (kind === 'hardcopy') return `${idPengajuan}_hardcopy.pdf`
  return `${idPengajuan}_bukti_${padEvidenceSequence(sequence)}.jpg`
}

export function buildArchivePublicPath(idPengajuan: string, kind: 'hardcopy' | 'bukti', sequence = 0) {
  return `${ARCHIVE_PUBLIC_BASE}/${buildArchiveFileName(idPengajuan, kind, sequence)}`
}

function buildArchiveFileId(idPengajuan: string, kind: 'hardcopy' | 'bukti', sequence = 0) {
  if (kind === 'hardcopy') return `${idPengajuan}:hardcopy`
  return `${idPengajuan}:bukti:${padEvidenceSequence(sequence)}`
}

function buildStatusLogDedupeKey(idPengajuan: string, log: GasStatusLogEntry) {
  return [
    idPengajuan,
    log.timestamp ?? '',
    log.noItem ?? '',
    log.statusLama ?? '',
    log.statusBaru ?? '',
    log.user ?? '',
    log.catatanAdmin ?? '',
  ].join('|')
}

function buildArchiveFiles(idPengajuan: string, jumlahFileBukti: number): InsertArchiveFile[] {
  const files: InsertArchiveFile[] = [
    {
      id: buildArchiveFileId(idPengajuan, 'hardcopy'),
      idPengajuan,
      kind: 'hardcopy',
      sequence: 0,
      fileName: buildArchiveFileName(idPengajuan, 'hardcopy'),
      publicPath: buildArchivePublicPath(idPengajuan, 'hardcopy'),
      status: 'pending',
    },
  ]

  for (let sequence = 1; sequence <= jumlahFileBukti; sequence += 1) {
    files.push({
      id: buildArchiveFileId(idPengajuan, 'bukti', sequence),
      idPengajuan,
      kind: 'bukti',
      sequence,
      fileName: buildArchiveFileName(idPengajuan, 'bukti', sequence),
      publicPath: buildArchivePublicPath(idPengajuan, 'bukti', sequence),
      status: 'pending',
    })
  }

  return files
}

const requiredTextSchema = z.preprocess(toText, z.string().min(1))
const nullableTextSchema = z.preprocess(toNullableText, z.string().nullable())
const nonNegativeIntegerSchema = z.preprocess(toNonNegativeInteger, z.number().int().min(0))
const positiveIntegerSchema = z.preprocess(toNonNegativeInteger, z.number().int().positive())

export const archivePublicPathSchema = z.preprocess(
  normalizeArchivePath,
  z.string().regex(/^\/arsip_file\/[^/]+_(?:hardcopy\.pdf|bukti_\d{2}\.jpg)$/),
)

const archivePublicPathArraySchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value.map(normalizeArchivePath).filter(Boolean)
  const text = toText(value)
  if (!text) return []
  return text.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)
}, z.array(archivePublicPathSchema))

const nullableItemDecisionSchema = z.preprocess(
  toNullableText,
  z.enum(ITEM_DECISION_STATUSES).nullable(),
)

const nullableWarrantyCardTypeSchema = z.preprocess(
  toNullableText,
  z.enum(WARRANTY_CARD_TYPES).nullable(),
)

const printStatusSchema = z.preprocess((value) => toText(value) || 'Belum Dicetak', z.enum(PRINT_STATUSES))
const shipStatusSchema = z.preprocess((value) => toText(value) || 'Belum Dikirim', z.enum(SHIP_STATUSES))
const nullableModelReviewStatusSchema = z.preprocess(
  (value) => toNullableText(value) ?? 'needs_review',
  z.enum(MODEL_REVIEW_STATUSES).nullable(),
)

export const gasPengajuanIdSchema = requiredTextSchema.refine(
  (value) => !/[\\/]/.test(value),
  'ID Pengajuan must be safe for deterministic archive file names',
)

export const gasPengajuanStatusSchema = z.preprocess(toText, z.enum(PENGAJUAN_STATUSES))

export const gasPengajuanItemSchema = z.object({
  noItem: positiveIntegerSchema,
  produk: nullableTextSchema,
  model: nullableTextSchema,
  nomorSeri: nullableTextSchema,
  modelNormalized: nullableTextSchema,
  produkStatus: nullableModelReviewStatusSchema,
  produkSumber: nullableTextSchema,
  keputusanItem: nullableItemDecisionSchema,
  catatanAdminItem: nullableTextSchema,
  jenisKartu: nullableWarrantyCardTypeSchema,
  statusCetak: printStatusSchema,
  printBatchId: nullableTextSchema,
  printedAt: nullableTextSchema,
  statusKirim: shipStatusSchema,
  shipBatchId: nullableTextSchema,
  shippedAt: nullableTextSchema,
  tanggalUpdateKeputusanItem: nullableTextSchema,
  userUpdateKeputusanItem: nullableTextSchema,
}).passthrough()

export const gasStatusLogEntrySchema = z.object({
  timestamp: nullableTextSchema,
  noItem: nullableTextSchema,
  statusLama: nullableTextSchema,
  statusBaru: nullableTextSchema,
  catatanAdmin: nullableTextSchema,
  user: nullableTextSchema,
}).passthrough()

export const gasPengajuanDetailSchema = z.object({
  idPengajuan: gasPengajuanIdSchema,
  timestampSubmit: nullableTextSchema,
  nama: nullableTextSchema,
  bagianCabang: nullableTextSchema,
  pemilik: nullableTextSchema,
  alasanPengajuan: nullableTextSchema,
  tanggalForm: nullableTextSchema,
  catatanTambahan: nullableTextSchema,
  jumlahItem: nonNegativeIntegerSchema,
  jumlahFileBukti: nonNegativeIntegerSchema,
  hardcopyArchivePath: archivePublicPathSchema.optional(),
  evidenceArchivePaths: archivePublicPathArraySchema.default([]),
  status: gasPengajuanStatusSchema,
  catatanAdmin: nullableTextSchema,
  tanggalUpdateStatusTerakhir: nullableTextSchema,
  userUpdateStatus: nullableTextSchema,
  items: z.array(gasPengajuanItemSchema).default([]),
  riwayat: z.array(gasStatusLogEntrySchema).default([]),
}).passthrough().superRefine((detail, ctx) => {
  const expectedHardcopyPath = buildArchivePublicPath(detail.idPengajuan, 'hardcopy')
  if (detail.hardcopyArchivePath && detail.hardcopyArchivePath !== expectedHardcopyPath) {
    ctx.addIssue({
      code: 'custom',
      path: ['hardcopyArchivePath'],
      message: `Hardcopy archive path must be ${expectedHardcopyPath}`,
    })
  }

  if (detail.evidenceArchivePaths.length !== detail.jumlahFileBukti) {
    ctx.addIssue({
      code: 'custom',
      path: ['evidenceArchivePaths'],
      message: 'Evidence archive path count must match Jumlah File Bukti',
    })
  }

  detail.evidenceArchivePaths.forEach((path, index) => {
    const expectedPath = buildArchivePublicPath(detail.idPengajuan, 'bukti', index + 1)
    if (path !== expectedPath) {
      ctx.addIssue({
        code: 'custom',
        path: ['evidenceArchivePaths', index],
        message: `Evidence archive path must be ${expectedPath}`,
      })
    }
  })
})

export const gasArchivePayloadSchema = gasPengajuanDetailSchema.transform((detail) => {
  const pengajuan: InsertPengajuan = {
    idPengajuan: detail.idPengajuan,
    timestampSubmit: detail.timestampSubmit,
    nama: detail.nama,
    bagianCabang: detail.bagianCabang,
    pemilik: detail.pemilik,
    alasanPengajuan: detail.alasanPengajuan,
    tanggalForm: detail.tanggalForm,
    catatanTambahan: detail.catatanTambahan,
    jumlahItem: detail.jumlahItem,
    jumlahFileBukti: detail.jumlahFileBukti,
    status: detail.status,
    catatanAdmin: detail.catatanAdmin,
    tanggalUpdateStatusTerakhir: detail.tanggalUpdateStatusTerakhir,
    userUpdateStatus: detail.userUpdateStatus,
  }

  const items: InsertPengajuanItem[] = detail.items.map((item) => ({
    idPengajuan: detail.idPengajuan,
    noItem: item.noItem,
    produk: item.produk,
    model: item.model,
    nomorSeri: item.nomorSeri,
    keputusanItem: item.keputusanItem,
    catatanAdminItem: item.catatanAdminItem,
    tanggalUpdateKeputusanItem: item.tanggalUpdateKeputusanItem,
    userUpdateKeputusanItem: item.userUpdateKeputusanItem,
    jenisKartu: item.jenisKartu,
    statusCetak: item.statusCetak,
    printBatchId: item.printBatchId,
    printedAt: item.printedAt,
    statusKirim: item.statusKirim,
    shipBatchId: item.shipBatchId,
    shippedAt: item.shippedAt,
    modelNormalized: item.modelNormalized,
    produkStatus: item.produkStatus,
    produkSumber: item.produkSumber,
  }))

  const statusLogs: InsertStatusLog[] = detail.riwayat.map((log) => ({
    dedupeKey: buildStatusLogDedupeKey(detail.idPengajuan, log),
    idPengajuan: detail.idPengajuan,
    timestamp: log.timestamp,
    noItem: log.noItem,
    statusLama: log.statusLama,
    statusBaru: log.statusBaru,
    catatanAdmin: log.catatanAdmin,
    user: log.user,
  }))

  return {
    pengajuan,
    items,
    statusLogs,
    archiveFiles: buildArchiveFiles(detail.idPengajuan, detail.jumlahFileBukti),
    detail,
  }
})

export type GasPengajuanItem = z.infer<typeof gasPengajuanItemSchema>
export type GasStatusLogEntry = z.infer<typeof gasStatusLogEntrySchema>
export type GasPengajuanDetail = z.infer<typeof gasPengajuanDetailSchema>
export type GasArchivePayload = z.infer<typeof gasArchivePayloadSchema>