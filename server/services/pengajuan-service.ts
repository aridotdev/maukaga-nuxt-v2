import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import * as z from 'zod'
import { type MaukagaDatabase, useDb } from '../database'
import {
  type ITEM_DECISION_STATUSES,
  type ITEM_PRINT_STATUSES,
  type ITEM_SHIPPING_STATUSES,
  PENGAJUAN_STATUSES,
  type InsertPengajuanFile,
  type InsertPengajuanItem,
  type InsertPrintBatchItem,
  type InsertShippingBatchItem,
  type Pengajuan,
  type PengajuanFile,
  type PengajuanItem,
  type StatusLog,
  WARRANTY_CARD_TYPES,
} from '../database/schema'
import {
  findItemRecord,
  findPengajuanRecord,
  insertAuditLogRecord,
  insertPengajuanFileRecords,
  insertPengajuanItemRecords,
  insertPengajuanRecord,
  insertPrintBatchItemRecords,
  insertPrintBatchRecord,
  insertShippingBatchItemRecords,
  insertShippingBatchRecord,
  insertStatusLogRecord,
  listItemRecordsByPengajuanId,
  listPengajuanRecords,
  listShippingLabelQueueRecords,
  listWarrantyPrintQueueRecords,
  softDeletePengajuanRecord,
  updateItemRecord,
  updateItemShippingStatusRecord,
  updatePengajuanRecord,
  type PengajuanTransaction,
  type ShippingLabelQueueRecord,
  type PengajuanWithRelations,
  type WarrantyPrintQueueRecord,
} from '../repositories/pengajuan-repository'
import { generatePengajuanIdInTransaction } from './pengajuan-id-service'
import {
  cleanupPengajuanFiles,
  preparePengajuanFile,
  writePengajuanFile,
  type PendingPengajuanFile,
} from '../utils/pengajuan-file-storage'

export type PengajuanStatus = typeof PENGAJUAN_STATUSES[number]
export type ItemDecision = typeof ITEM_DECISION_STATUSES[number]
export type PrintStatus = typeof ITEM_PRINT_STATUSES[number]
export type ShippingStatus = typeof ITEM_SHIPPING_STATUSES[number]
export type WarrantyCardType = typeof WARRANTY_CARD_TYPES[number]

export interface PengajuanListFilters {
  search?: string
  status?: PengajuanStatus
  decision?: ItemDecision
  branch?: string
  model?: string
}

export interface PengajuanServiceOptions {
  database?: MaukagaDatabase
  now?: Date
  actorId: string
  maxItems?: number
}

export interface PengajuanFileDto {
  name: string
  kind: 'hardcopy' | 'evidence' | 'attachment'
  mimeType: 'application/pdf' | 'image/jpeg'
  sizeLabel: string
}

export interface StatusLogDto {
  at: string
  actor: string
  from: PengajuanStatus | '-'
  to: PengajuanStatus
  note: string
}

export interface PengajuanItemDto {
  noItem: number
  produk: string
  model: string
  nomorSeri: string
  keputusanItem: ItemDecision
  catatanKeputusan?: string
  jenisKartu: WarrantyCardType | ''
  statusCetak: PrintStatus
  statusKirim: ShippingStatus
  printedAt?: string
  shippedAt?: string
}

export interface PengajuanDto {
  idPengajuan: string
  submittedAt: string
  nama: string
  bagianCabang: string
  pemilik: string
  alasanPengajuan: string
  tanggalForm: string
  catatanTambahan: string
  status: PengajuanStatus
  catatanAdmin: string
  files: PengajuanFileDto[]
  items: PengajuanItemDto[]
  statusLog: StatusLogDto[]
}

export interface WarrantyPrintQueueRowDto {
  key: string
  idPengajuan: string
  noItem: number
  produk: string
  model: string
  nomorSeri: string
  jenisKartu: WarrantyCardType | ''
  jenisKartuKey: 'local' | 'import' | ''
  statusCetak: PrintStatus
  statusKirim: ShippingStatus
  nama: string
  bagianCabang: string
  submittedAt: string
}

export interface WarrantyPrintQueueDto {
  rows: WarrantyPrintQueueRowDto[]
  summary: {
    total: number
    local: number
    import: number
    unset: number
  }
}

export interface ShippingLabelQueueRowDto {
  key: string
  idPengajuan: string
  noItem: number
  produk: string
  model: string
  nomorSeri: string
  statusCetak: PrintStatus
  statusKirim: ShippingStatus
  nama: string
  bagianCabang: string
  submittedAt: string
}

export interface ShippingLabelQueueDto {
  rows: ShippingLabelQueueRowDto[]
  summary: {
    total: number
    groups: number
  }
}

const dateInputSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal form tidak valid')
const warrantyPrintItemSchema = z.object({
  idPengajuan: z.string().trim().min(1, 'ID pengajuan wajib diisi'),
  noItem: z.number().int().positive('Nomor item tidak valid'),
})

export const createPengajuanInputSchema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi'),
  bagianCabang: z.string().trim().min(1, 'Bagian/cabang wajib diisi'),
  pemilik: z.string().trim().min(1, 'Pemilik wajib diisi'),
  alasanPengajuan: z.string().trim().min(1, 'Alasan pengajuan wajib diisi').max(200),
  tanggalForm: dateInputSchema,
  catatanTambahan: z.string().trim().max(200).optional().default(''),
  items: z.array(z.object({
    model: z.string().trim().min(1, 'Model wajib diisi'),
    nomorSeri: z.string().trim().min(1, 'Nomor seri wajib diisi'),
    produk: z.string().trim().min(1, 'Produk wajib diisi'),
  })).min(1, 'Tambahkan minimal satu item pengajuan'),
})

export const updatePengajuanInputSchema = createPengajuanInputSchema.omit({
  items: true,
})

export const updateStatusInputSchema = z.object({
  status: z.enum(PENGAJUAN_STATUSES),
  note: z.string().trim().max(500).optional().default(''),
})

export const itemDecisionInputSchema = z.object({
  noItem: z.number().int().positive(),
  decision: z.enum(['Disetujui', 'Ditolak']),
  note: z.string().trim().max(500).optional().default(''),
})

export const deletePengajuanInputSchema = z.object({
  reason: z.string().trim().max(500).optional().default('Dihapus oleh admin.'),
})

export const warrantyCardTypesInputSchema = z.object({
  items: z.array(warrantyPrintItemSchema.extend({
    jenisKartu: z.enum(WARRANTY_CARD_TYPES),
  })).min(1, 'Pilih minimal satu item'),
})

export const printWarrantyCardsInputSchema = z.object({
  items: z.array(warrantyPrintItemSchema.extend({
    jenisKartu: z.enum(WARRANTY_CARD_TYPES).optional(),
  })).min(1, 'Pilih minimal satu item'),
})

export const shipLabelsInputSchema = z.object({
  items: z.array(warrantyPrintItemSchema).min(1, 'Pilih minimal satu item'),
})

export async function listPengajuan(
  filters: PengajuanListFilters = {},
  database = useDb(),
) {
  const records = await listPengajuanRecords(database)
  const dtos = records.map(mapPengajuanDto)

  return dtos.filter(record => matchesPengajuanFilters(record, filters))
}

export async function getPengajuan(idPengajuan: string, database = useDb()) {
  const record = await findPengajuanRecord(database, idPengajuan)
  if (!record) throw notFoundError(idPengajuan)
  return mapPengajuanDto(record)
}

export async function listWarrantyPrintQueue(database = useDb()): Promise<WarrantyPrintQueueDto> {
  const rows = (await listWarrantyPrintQueueRecords(database)).map(mapWarrantyPrintQueueRowDto)

  return {
    rows,
    summary: createWarrantyPrintQueueSummary(rows),
  }
}

export async function listShippingLabelQueue(database = useDb()): Promise<ShippingLabelQueueDto> {
  const rows = (await listShippingLabelQueueRecords(database)).map(mapShippingLabelQueueRowDto)

  return {
    rows,
    summary: createShippingLabelQueueSummary(rows),
  }
}

export async function createPengajuan(
  input: z.input<typeof createPengajuanInputSchema>,
  files: PendingPengajuanFile[],
  options: PengajuanServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = createPengajuanInputSchema.parse(input)
  const maxItems = Math.max(1, options.maxItems ?? 10)

  if (data.items.length > maxItems) {
    throw createError({
      statusCode: 400,
      statusMessage: `Maksimal ${maxItems} item dalam satu pengajuan`,
    })
  }

  assertUniqueItems(data.items)
  validateCreateFiles(files)

  const writtenStorageKeys: string[] = []

  try {
    const idPengajuan = await database.transaction(async (tx) => {
      const nextId = await generatePengajuanIdInTransaction(tx, {
        now: options.now,
      })
      const preparedFiles = files.map(file => ({
        raw: file,
        metadata: preparePengajuanFile(nextId, file),
      }))

      for (const file of preparedFiles) {
        await writePengajuanFile(file.metadata.storageKey, file.raw.data)
        writtenStorageKeys.push(file.metadata.storageKey)
      }

      const pengajuanRecord = await insertPengajuanRecord(tx, {
        idPengajuan: nextId,
        nama: data.nama,
        bagianCabang: data.bagianCabang,
        pemilik: data.pemilik,
        alasanPengajuan: data.alasanPengajuan,
        tanggalForm: data.tanggalForm,
        catatanTambahan: data.catatanTambahan || null,
        status: 'Baru',
        catatanAdmin: null,
        createdBy: options.actorId,
        updatedBy: options.actorId,
        submittedAt: options.now ?? new Date(),
      })

      await insertPengajuanItemRecords(
        tx,
        data.items.map((item, index): InsertPengajuanItem => ({
          pengajuanId: pengajuanRecord.id,
          noItem: index + 1,
          produk: item.produk,
          model: item.model,
          modelNormalized: normalizeBusinessKey(item.model),
          nomorSeri: item.nomorSeri,
          nomorSeriNormalized: normalizeBusinessKey(item.nomorSeri),
          jenisKartu: null,
        })),
      )

      await insertPengajuanFileRecords(
        tx,
        preparedFiles.map(({ metadata }): InsertPengajuanFile => ({
          ...metadata,
          pengajuanId: pengajuanRecord.id,
          uploadedBy: options.actorId,
        })),
      )

      await insertStatusLogRecord(tx, {
        pengajuanId: pengajuanRecord.id,
        scope: 'pengajuan',
        statusLama: null,
        statusBaru: 'Baru',
        catatan: 'Pengajuan dibuat dari form manual admin.',
        actorId: options.actorId,
      })

      await insertAuditLogRecord(tx, {
        actorId: options.actorId,
        action: 'pengajuan.create',
        entityType: 'pengajuan',
        entityId: nextId,
        metadataJson: JSON.stringify({ itemCount: data.items.length }),
      })

      return nextId
    })

    return getPengajuan(idPengajuan, database)
  } catch (error) {
    await cleanupPengajuanFiles(writtenStorageKeys)
    throw normalizeDatabaseError(error)
  }
}

export async function updatePengajuan(
  idPengajuan: string,
  input: z.input<typeof updatePengajuanInputSchema>,
  options: PengajuanServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = updatePengajuanInputSchema.parse(input)

  await database.transaction(async (tx) => {
    const record = await updatePengajuanRecord(tx, idPengajuan, {
      nama: data.nama,
      bagianCabang: data.bagianCabang,
      pemilik: data.pemilik,
      alasanPengajuan: data.alasanPengajuan,
      tanggalForm: data.tanggalForm,
      catatanTambahan: data.catatanTambahan || null,
      updatedBy: options.actorId,
    })

    if (!record) throw notFoundError(idPengajuan)

    await insertAuditLogRecord(tx, {
      actorId: options.actorId,
      action: 'pengajuan.update',
      entityType: 'pengajuan',
      entityId: idPengajuan,
      metadataJson: JSON.stringify({ fields: Object.keys(data) }),
    })
  })

  return getPengajuan(idPengajuan, database)
}

export async function deletePengajuan(
  idPengajuan: string,
  input: z.input<typeof deletePengajuanInputSchema>,
  options: PengajuanServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = deletePengajuanInputSchema.parse(input)

  await database.transaction(async (tx) => {
    const record = await softDeletePengajuanRecord(tx, idPengajuan, options.actorId, data.reason)
    if (!record) throw notFoundError(idPengajuan)

    await insertAuditLogRecord(tx, {
      actorId: options.actorId,
      action: 'pengajuan.delete',
      entityType: 'pengajuan',
      entityId: idPengajuan,
      metadataJson: JSON.stringify({ reason: data.reason }),
    })
  })

  return { idPengajuan, deleted: true }
}

export async function updatePengajuanStatus(
  idPengajuan: string,
  input: z.input<typeof updateStatusInputSchema>,
  options: PengajuanServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = updateStatusInputSchema.parse(input)

  await database.transaction(async (tx) => {
    const record = await findPengajuanRecord(tx, idPengajuan)
    if (!record) throw notFoundError(idPengajuan)

    if (data.status === 'Selesai' && !canCompleteRecord(record.items, record.pengajuan.status)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Pengajuan belum memenuhi aturan Selesai',
      })
    }

    await setPengajuanStatus(tx, record.pengajuan, data.status, data.note, options.actorId)
  })

  return getPengajuan(idPengajuan, database)
}

export async function updateBulkPengajuanStatus(
  ids: string[],
  input: z.input<typeof updateStatusInputSchema>,
  options: PengajuanServiceOptions,
) {
  const uniqueIds = Array.from(new Set(ids.map(id => id.trim()).filter(Boolean)))
  const updated: string[] = []

  for (const idPengajuan of uniqueIds) {
    await updatePengajuanStatus(idPengajuan, input, options)
    updated.push(idPengajuan)
  }

  return { updated }
}

export async function updateItemDecision(
  idPengajuan: string,
  input: z.input<typeof itemDecisionInputSchema>,
  options: PengajuanServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = itemDecisionInputSchema.parse(input)

  if (data.decision === 'Ditolak' && !data.note) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Catatan wajib diisi saat item ditolak',
    })
  }

  await database.transaction(async (tx) => {
    const target = await findItemRecord(tx, idPengajuan, data.noItem)
    if (!target) throw notFoundError(idPengajuan)

    await updateItemRecord(tx, target.item.id, {
      keputusanItem: data.decision,
      catatanKeputusan: data.note || null,
      keputusanOleh: options.actorId,
      keputusanAt: options.now ?? new Date(),
      statusCetak: data.decision === 'Ditolak' ? 'Belum Dicetak' : target.item.statusCetak,
      statusKirim: data.decision === 'Ditolak' ? 'Belum Dikirim' : target.item.statusKirim,
      printedAt: data.decision === 'Ditolak' ? null : target.item.printedAt,
      shippedAt: data.decision === 'Ditolak' ? null : target.item.shippedAt,
    })

    await insertStatusLogRecord(tx, {
      pengajuanId: target.record.id,
      itemId: target.item.id,
      scope: 'item',
      statusLama: target.item.keputusanItem,
      statusBaru: data.decision,
      catatan: data.note || `Item ${data.noItem} ${data.decision.toLowerCase()}.`,
      actorId: options.actorId,
    })

    await recalculateAndPersistStatus(
      tx,
      target.record,
      `Item ${data.noItem} ${data.decision.toLowerCase()}.`,
      options.actorId,
    )

    await insertAuditLogRecord(tx, {
      actorId: options.actorId,
      action: 'pengajuan.item-decision',
      entityType: 'pengajuan_item',
      entityId: `${idPengajuan}:${data.noItem}`,
      metadataJson: JSON.stringify({ decision: data.decision }),
    })
  })

  return getPengajuan(idPengajuan, database)
}

export async function markItemPrinted(
  idPengajuan: string,
  noItem: number,
  options: PengajuanServiceOptions,
) {
  const result = await markWarrantyCardsPrinted({
    items: [{ idPengajuan, noItem }],
  }, options)

  return getPengajuan(result.updated[0] ?? idPengajuan, options.database ?? useDb())
}

export async function markItemShipped(
  idPengajuan: string,
  noItem: number,
  options: PengajuanServiceOptions,
) {
  const result = await markShippingLabelsShipped({
    items: [{ idPengajuan, noItem }],
  }, options)

  return getPengajuan(result.updated[0] ?? idPengajuan, options.database ?? useDb())
}

export async function markShippingLabelsShipped(
  input: z.input<typeof shipLabelsInputSchema>,
  options: PengajuanServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = shipLabelsInputSchema.parse(input)
  const items = dedupeWarrantyPrintItems(data.items)
  const now = options.now ?? new Date()
  const batchId = createShippingBatchId(now)
  const affectedPengajuanIds = new Set<string>()

  await database.transaction(async (tx) => {
    const targets = []

    for (const item of items) {
      const target = await findItemRecord(tx, item.idPengajuan, item.noItem)
      if (!target) throw notFoundError(item.idPengajuan)
      assertItemCanEnterShippingQueue(target.item)

      affectedPengajuanIds.add(item.idPengajuan)
      targets.push(target)
    }

    await insertShippingBatchRecord(tx, {
      id: batchId,
      actorId: options.actorId,
      status: 'completed',
      note: `Batch pengiriman ${targets.length} item.`,
      completedAt: now,
    })

    await insertShippingBatchItemRecords(
      tx,
      targets.map((target): InsertShippingBatchItem => ({
        batchId,
        itemId: target.item.id,
        status: 'success',
        error: null,
        succeededAt: now,
      })),
    )

    for (const target of targets) {
      const updatedItem = await updateItemShippingStatusRecord(tx, target.item.id, {
        lastShippingBatchId: batchId,
        shippedAt: now,
      })

      if (!updatedItem) {
        throw createError({
          statusCode: 409,
          statusMessage: `Item ${target.record.idPengajuan} #${target.item.noItem} sudah berubah dan tidak dapat dikirim`,
        })
      }

      await insertStatusLogRecord(tx, {
        pengajuanId: target.record.id,
        itemId: target.item.id,
        scope: 'item',
        statusLama: target.item.statusKirim,
        statusBaru: 'Dikirim',
        catatan: `Item ${target.item.noItem} dikirim dalam batch ${batchId}.`,
        actorId: options.actorId,
      })
    }

    for (const idPengajuan of affectedPengajuanIds) {
      const record = await findPengajuanRecord(tx, idPengajuan)
      if (!record) continue

      await recalculateAndPersistStatus(
        tx,
        record.pengajuan,
        `Batch pengiriman ${batchId} selesai.`,
        options.actorId,
      )
    }

    await insertAuditLogRecord(tx, {
      actorId: options.actorId,
      action: 'pengajuan.shipping-batch',
      entityType: 'shipping_batch',
      entityId: batchId,
      metadataJson: JSON.stringify({
        itemCount: targets.length,
        items: targets.map(target => ({
          idPengajuan: target.record.idPengajuan,
          noItem: target.item.noItem,
        })),
      }),
    })
  })

  return {
    batchId,
    count: items.length,
    updated: Array.from(affectedPengajuanIds),
  }
}

export async function saveWarrantyCardTypes(
  input: z.input<typeof warrantyCardTypesInputSchema>,
  options: PengajuanServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = warrantyCardTypesInputSchema.parse(input)
  const items = dedupeWarrantyPrintItems(data.items)

  await database.transaction(async (tx) => {
    for (const item of items) {
      const target = await findItemRecord(tx, item.idPengajuan, item.noItem)
      if (!target) throw notFoundError(item.idPengajuan)
      assertItemCanEnterPrintQueue(target.item)

      await updateItemRecord(tx, target.item.id, {
        jenisKartu: item.jenisKartu,
      })

      await insertAuditLogRecord(tx, {
        actorId: options.actorId,
        action: 'pengajuan.item-card-type',
        entityType: 'pengajuan_item',
        entityId: `${item.idPengajuan}:${item.noItem}`,
        metadataJson: JSON.stringify({ jenisKartu: item.jenisKartu }),
      })
    }
  })

  return { count: items.length }
}

export async function markWarrantyCardsPrinted(
  input: z.input<typeof printWarrantyCardsInputSchema>,
  options: PengajuanServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = printWarrantyCardsInputSchema.parse(input)
  const items = dedupeWarrantyPrintItems(data.items)
  const now = options.now ?? new Date()
  const batchId = createPrintBatchId(now)
  const affectedPengajuanIds = new Set<string>()

  await database.transaction(async (tx) => {
    const targets = []

    for (const item of items) {
      const target = await findItemRecord(tx, item.idPengajuan, item.noItem)
      if (!target) throw notFoundError(item.idPengajuan)
      assertItemCanEnterPrintQueue(target.item)

      const jenisKartu = item.jenisKartu ?? target.item.jenisKartu
      if (!jenisKartu) {
        throw createError({
          statusCode: 400,
          statusMessage: `Item ${item.idPengajuan} #${item.noItem} belum memiliki jenis kartu`,
        })
      }

      affectedPengajuanIds.add(item.idPengajuan)
      targets.push({ ...target, jenisKartu })
    }

    await insertPrintBatchRecord(tx, {
      id: batchId,
      layoutId: null,
      actorId: options.actorId,
      status: 'completed',
      note: `Batch cetak ${targets.length} kartu garansi.`,
      completedAt: now,
    })

    await insertPrintBatchItemRecords(
      tx,
      targets.map((target): InsertPrintBatchItem => ({
        batchId,
        itemId: target.item.id,
        status: 'success',
        error: null,
        succeededAt: now,
      })),
    )

    for (const target of targets) {
      await updateItemRecord(tx, target.item.id, {
        jenisKartu: target.jenisKartu,
        statusCetak: 'Dicetak',
        printedAt: now,
        lastPrintBatchId: batchId,
      })

      await insertStatusLogRecord(tx, {
        pengajuanId: target.record.id,
        itemId: target.item.id,
        scope: 'item',
        statusLama: target.item.statusCetak,
        statusBaru: 'Dicetak',
        catatan: `Item ${target.item.noItem} dicetak dalam batch ${batchId}.`,
        actorId: options.actorId,
      })
    }

    for (const idPengajuan of affectedPengajuanIds) {
      const record = await findPengajuanRecord(tx, idPengajuan)
      if (!record) continue

      await recalculateAndPersistStatus(
        tx,
        record.pengajuan,
        `Batch cetak ${batchId} selesai.`,
        options.actorId,
      )
    }

    await insertAuditLogRecord(tx, {
      actorId: options.actorId,
      action: 'pengajuan.print-batch',
      entityType: 'print_batch',
      entityId: batchId,
      metadataJson: JSON.stringify({
        itemCount: targets.length,
        items: targets.map(target => ({
          idPengajuan: target.record.idPengajuan,
          noItem: target.item.noItem,
          jenisKartu: target.jenisKartu,
        })),
      }),
    })
  })

  return {
    batchId,
    count: items.length,
    updated: Array.from(affectedPengajuanIds),
  }
}

async function recalculateAndPersistStatus(
  tx: PengajuanTransaction,
  record: Pengajuan,
  note: string,
  actorId: string,
) {
  const items = await listItemRecordsByPengajuanId(tx, record.id)
  await setPengajuanStatus(tx, record, resolveAggregateStatus(items), note, actorId)
}

async function setPengajuanStatus(
  tx: PengajuanTransaction,
  record: Pengajuan,
  status: PengajuanStatus,
  note: string,
  actorId: string,
) {
  if (record.status === status) return

  await updatePengajuanRecord(tx, record.idPengajuan, {
    status,
    catatanAdmin: note || null,
    updatedBy: actorId,
  })

  await insertStatusLogRecord(tx, {
    pengajuanId: record.id,
    scope: 'pengajuan',
    statusLama: record.status,
    statusBaru: status,
    catatan: note || null,
    actorId,
  })

  await insertAuditLogRecord(tx, {
    actorId,
    action: 'pengajuan.status-update',
    entityType: 'pengajuan',
    entityId: record.idPengajuan,
    metadataJson: JSON.stringify({ from: record.status, to: status }),
  })
}

function resolveAggregateStatus(items: PengajuanItem[]): PengajuanStatus {
  const approvedItems = items.filter(item => item.keputusanItem === 'Disetujui')
  const rejectedItems = items.filter(item => item.keputusanItem === 'Ditolak')

  if (items.length > 0 && rejectedItems.length === items.length) return 'Ditolak'
  if (approvedItems.length && approvedItems.every(item => item.statusKirim === 'Dikirim')) return 'Dikirim'
  if (approvedItems.length && approvedItems.every(item => item.statusCetak === 'Dicetak')) return 'Diprint'
  if (approvedItems.length) return 'Disetujui'
  return 'Baru'
}

function canCompleteRecord(items: PengajuanItem[], status: PengajuanStatus) {
  const hasShippedItem = items.some(item => item.statusKirim === 'Dikirim')
  const allDoneOrRejected = items.every(item =>
    item.keputusanItem === 'Ditolak' || item.statusKirim === 'Dikirim',
  )

  return status === 'Dikirim' && hasShippedItem && allDoneOrRejected
}

function mapPengajuanDto(record: PengajuanWithRelations): PengajuanDto {
  return {
    idPengajuan: record.pengajuan.idPengajuan,
    submittedAt: toIsoString(record.pengajuan.submittedAt ?? record.pengajuan.createdAt),
    nama: record.pengajuan.nama,
    bagianCabang: record.pengajuan.bagianCabang,
    pemilik: record.pengajuan.pemilik,
    alasanPengajuan: record.pengajuan.alasanPengajuan,
    tanggalForm: record.pengajuan.tanggalForm,
    catatanTambahan: record.pengajuan.catatanTambahan ?? '',
    status: record.pengajuan.status,
    catatanAdmin: record.pengajuan.catatanAdmin ?? '',
    files: record.files.map(mapFileDto),
    items: record.items.map(mapItemDto),
    statusLog: record.logs.map(mapStatusLogDto),
  }
}

function mapItemDto(item: PengajuanItem): PengajuanItemDto {
  return {
    noItem: item.noItem,
    produk: item.produk ?? '',
    model: item.model,
    nomorSeri: item.nomorSeri,
    keputusanItem: item.keputusanItem,
    catatanKeputusan: item.catatanKeputusan ?? undefined,
    jenisKartu: item.jenisKartu ?? '',
    statusCetak: item.statusCetak,
    statusKirim: item.statusKirim,
    printedAt: item.printedAt ? toIsoString(item.printedAt) : undefined,
    shippedAt: item.shippedAt ? toIsoString(item.shippedAt) : undefined,
  }
}

function mapWarrantyPrintQueueRowDto(record: WarrantyPrintQueueRecord): WarrantyPrintQueueRowDto {
  const jenisKartu = record.item.jenisKartu ?? ''

  return {
    key: `${record.pengajuan.idPengajuan}::${record.item.noItem}`,
    idPengajuan: record.pengajuan.idPengajuan,
    noItem: record.item.noItem,
    produk: record.item.produk ?? '',
    model: record.item.model,
    nomorSeri: record.item.nomorSeri,
    jenisKartu,
    jenisKartuKey: getWarrantyCardTypeKey(jenisKartu),
    statusCetak: record.item.statusCetak,
    statusKirim: record.item.statusKirim,
    nama: record.pengajuan.nama,
    bagianCabang: record.pengajuan.bagianCabang,
    submittedAt: toIsoString(record.pengajuan.submittedAt ?? record.pengajuan.createdAt),
  }
}

function mapShippingLabelQueueRowDto(record: ShippingLabelQueueRecord): ShippingLabelQueueRowDto {
  return {
    key: `${record.pengajuan.idPengajuan}::${record.item.noItem}`,
    idPengajuan: record.pengajuan.idPengajuan,
    noItem: record.item.noItem,
    produk: record.item.produk ?? '',
    model: record.item.model,
    nomorSeri: record.item.nomorSeri,
    statusCetak: record.item.statusCetak,
    statusKirim: record.item.statusKirim,
    nama: record.pengajuan.nama,
    bagianCabang: record.pengajuan.bagianCabang,
    submittedAt: toIsoString(record.pengajuan.submittedAt ?? record.pengajuan.createdAt),
  }
}

function createWarrantyPrintQueueSummary(rows: WarrantyPrintQueueRowDto[]) {
  return rows.reduce((summary, row) => {
    summary.total += 1
    if (row.jenisKartuKey === 'local') summary.local += 1
    else if (row.jenisKartuKey === 'import') summary.import += 1
    else summary.unset += 1
    return summary
  }, {
    total: 0,
    local: 0,
    import: 0,
    unset: 0,
  })
}

function createShippingLabelQueueSummary(rows: ShippingLabelQueueRowDto[]) {
  const groups = new Set(
    rows.map(row => `${normalizeGroupValue(row.nama)}::${normalizeGroupValue(row.bagianCabang)}`),
  )

  return {
    total: rows.length,
    groups: groups.size,
  }
}

function dedupeWarrantyPrintItems<T extends { idPengajuan: string; noItem: number }>(items: T[]) {
  const keys = new Set<string>()
  const uniqueItems: T[] = []

  for (const item of items) {
    const key = `${item.idPengajuan}::${item.noItem}`
    if (keys.has(key)) continue

    keys.add(key)
    uniqueItems.push(item)
  }

  return uniqueItems
}

function assertItemCanEnterPrintQueue(item: PengajuanItem) {
  if (item.keputusanItem !== 'Disetujui') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item harus disetujui sebelum masuk antrean cetak',
    })
  }

  if (item.statusCetak === 'Dicetak') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item sudah dicetak',
    })
  }
}

function assertItemCanEnterShippingQueue(item: PengajuanItem) {
  if (item.keputusanItem !== 'Disetujui') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item harus disetujui sebelum dikirim',
    })
  }

  if (item.statusCetak !== 'Dicetak') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item harus dicetak sebelum dikirim',
    })
  }

  if (item.statusKirim === 'Dikirim') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item sudah dikirim',
    })
  }
}

function createPrintBatchId(now: Date) {
  const timestamp = now.toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z')

  return `PRINT-${timestamp}-${randomUUID().slice(0, 8)}`
}

function createShippingBatchId(now: Date) {
  const timestamp = now.toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z')

  return `SHIP-${timestamp}-${randomUUID().slice(0, 8)}`
}

function normalizeGroupValue(value: string) {
  return value.trim().toLowerCase() || '-'
}

function getWarrantyCardTypeKey(value: WarrantyCardType | ''): 'local' | 'import' | '' {
  if (value === 'Local') return 'local'
  if (value === 'Import') return 'import'
  return ''
}

function mapFileDto(file: PengajuanFile): PengajuanFileDto {
  return {
    name: file.originalName,
    kind: file.kind,
    mimeType: normalizeMimeType(file.mimeType),
    sizeLabel: formatBytes(file.sizeBytes),
  }
}

function mapStatusLogDto(log: StatusLog): StatusLogDto {
  return {
    at: toIsoString(log.createdAt),
    actor: log.actorId ? 'Admin' : 'Sistem',
    from: isPengajuanStatus(log.statusLama) ? log.statusLama : '-',
    to: isPengajuanStatus(log.statusBaru) ? log.statusBaru : 'Baru',
    note: log.catatan ?? '',
  }
}

function matchesPengajuanFilters(record: PengajuanDto, filters: PengajuanListFilters) {
  const search = filters.search?.trim().toLowerCase()
  const matchesSearch = !search || [
    record.idPengajuan,
    record.nama,
    record.pemilik,
    record.bagianCabang,
    record.status,
    ...record.items.flatMap(item => [
      item.produk,
      item.model,
      item.nomorSeri,
      item.keputusanItem,
      item.jenisKartu,
    ]),
  ].join(' ').toLowerCase().includes(search)

  return matchesSearch
    && (!filters.status || record.status === filters.status)
    && (!filters.branch || record.bagianCabang === filters.branch)
    && (!filters.decision || record.items.some(item => item.keputusanItem === filters.decision))
    && (!filters.model || record.items.some(item => item.model === filters.model))
}

function validateCreateFiles(files: PendingPengajuanFile[]) {
  const hardcopies = files.filter(file => file.kind === 'hardcopy')
  if (hardcopies.length !== 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Hardcopy PDF wajib diunggah',
    })
  }

  for (const file of files) {
    if (file.sizeBytes <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'File tidak valid' })
    }

    const mimeType = normalizeMimeType(file.mimeType, file.originalName)
    const isPdf = mimeType === 'application/pdf'
    const isJpeg = mimeType === 'image/jpeg'

    if (file.kind === 'hardcopy' && !isPdf) {
      throw createError({ statusCode: 400, statusMessage: 'Hardcopy wajib berupa PDF' })
    }

    if (file.kind !== 'hardcopy' && !isPdf && !isJpeg) {
      throw createError({ statusCode: 400, statusMessage: 'Lampiran hanya boleh berupa PDF atau JPG' })
    }

    file.mimeType = mimeType
  }
}

function assertUniqueItems(items: Array<{ model: string; nomorSeri: string }>) {
  const keys = new Set<string>()

  for (const item of items) {
    const key = `${normalizeBusinessKey(item.model)}::${normalizeBusinessKey(item.nomorSeri)}`
    if (keys.has(key)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Model dan nomor seri tidak boleh duplikat dalam satu pengajuan',
      })
    }
    keys.add(key)
  }
}

function normalizeBusinessKey(value: string) {
  return value.trim().toUpperCase()
}

function normalizeMimeType(mimeType: string, fileName = ''): 'application/pdf' | 'image/jpeg' {
  const normalized = mimeType.toLowerCase()
  if (normalized === 'application/pdf' || /\.pdf$/i.test(fileName)) return 'application/pdf'
  return 'image/jpeg'
}

function isPengajuanStatus(value: unknown): value is PengajuanStatus {
  return PENGAJUAN_STATUSES.includes(value as PengajuanStatus)
}

function toIsoString(value: Date | number | string) {
  return new Date(value).toISOString()
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function notFoundError(idPengajuan: string) {
  return createError({
    statusCode: 404,
    statusMessage: `Pengajuan ${idPengajuan} tidak ditemukan`,
  })
}

function normalizeDatabaseError(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) return error
  if (error instanceof z.ZodError) return error
  if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
    return createError({
      statusCode: 409,
      statusMessage: 'Data pengajuan duplikat',
    })
  }
  return error
}
