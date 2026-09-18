import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { MaukagaDatabase } from '../database'
import {
  auditLog,
  pengajuan,
  pengajuanFiles,
  pengajuanItems,
  printBatchItems,
  printBatches,
  shippingBatchItems,
  shippingBatches,
  statusLog,
  type InsertAuditLog,
  type InsertPengajuan,
  type InsertPengajuanFile,
  type InsertPengajuanItem,
  type InsertPrintBatch,
  type InsertPrintBatchItem,
  type InsertShippingBatch,
  type InsertShippingBatchItem,
  type InsertStatusLog,
  type Pengajuan,
  type PengajuanFile,
  type PengajuanItem,
  type StatusLog,
  type UpdatePengajuan,
} from '../database/schema'

type TransactionCallback = Parameters<MaukagaDatabase['transaction']>[0]
export type PengajuanTransaction = Parameters<TransactionCallback>[0]
export type PengajuanDatabase = MaukagaDatabase | PengajuanTransaction

export interface PengajuanWithRelations {
  pengajuan: Pengajuan
  items: PengajuanItem[]
  files: PengajuanFile[]
  logs: StatusLog[]
}

export interface WarrantyPrintQueueRecord {
  pengajuan: Pengajuan
  item: PengajuanItem
}

export interface ShippingLabelQueueRecord {
  pengajuan: Pengajuan
  item: PengajuanItem
}

export async function listPengajuanRecords(database: PengajuanDatabase) {
  const records = await database
    .select()
    .from(pengajuan)
    .where(isNull(pengajuan.deletedAt))
    .orderBy(desc(pengajuan.submittedAt), desc(pengajuan.createdAt))

  return hydratePengajuanRecords(database, records)
}

export async function listWarrantyPrintQueueRecords(database: PengajuanDatabase) {
  return database
    .select({
      pengajuan,
      item: pengajuanItems,
    })
    .from(pengajuanItems)
    .innerJoin(pengajuan, eq(pengajuanItems.pengajuanId, pengajuan.id))
    .where(and(
      eq(pengajuanItems.keputusanItem, 'Disetujui'),
      eq(pengajuanItems.statusCetak, 'Belum Dicetak'),
      isNull(pengajuan.deletedAt),
    ))
    .orderBy(
      asc(pengajuanItems.jenisKartu),
      asc(pengajuan.idPengajuan),
      asc(pengajuanItems.noItem),
    )
}

export async function listShippingLabelQueueRecords(database: PengajuanDatabase) {
  return database
    .select({
      pengajuan,
      item: pengajuanItems,
    })
    .from(pengajuanItems)
    .innerJoin(pengajuan, eq(pengajuanItems.pengajuanId, pengajuan.id))
    .where(and(
      eq(pengajuanItems.keputusanItem, 'Disetujui'),
      eq(pengajuanItems.statusCetak, 'Dicetak'),
      eq(pengajuanItems.statusKirim, 'Belum Dikirim'),
      isNull(pengajuan.deletedAt),
    ))
    .orderBy(
      asc(pengajuan.bagianCabang),
      asc(pengajuan.nama),
      asc(pengajuan.idPengajuan),
      asc(pengajuanItems.noItem),
    )
}

export async function findPengajuanRecord(
  database: PengajuanDatabase,
  idPengajuan: string,
) {
  const [record] = await database
    .select()
    .from(pengajuan)
    .where(and(
      eq(pengajuan.idPengajuan, idPengajuan),
      isNull(pengajuan.deletedAt),
    ))

  if (!record) return null

  const [hydrated] = await hydratePengajuanRecords(database, [record])
  return hydrated ?? null
}

export async function insertPengajuanRecord(
  database: PengajuanDatabase,
  values: InsertPengajuan,
) {
  const [record] = await database
    .insert(pengajuan)
    .values(values)
    .returning()

  if (!record) {
    throw new Error('Pengajuan could not be created')
  }

  return record
}

export async function insertPengajuanItemRecords(
  database: PengajuanDatabase,
  values: InsertPengajuanItem[],
) {
  if (!values.length) return []

  return database
    .insert(pengajuanItems)
    .values(values)
    .returning()
}

export async function insertPengajuanFileRecords(
  database: PengajuanDatabase,
  values: InsertPengajuanFile[],
) {
  if (!values.length) return []

  return database
    .insert(pengajuanFiles)
    .values(values)
    .returning()
}

export async function insertStatusLogRecord(
  database: PengajuanDatabase,
  values: InsertStatusLog,
) {
  await database.insert(statusLog).values(values)
}

export async function insertAuditLogRecord(
  database: PengajuanDatabase,
  values: InsertAuditLog,
) {
  await database.insert(auditLog).values(values)
}

export async function insertPrintBatchRecord(
  database: PengajuanDatabase,
  values: InsertPrintBatch,
) {
  await database.insert(printBatches).values(values)
}

export async function insertPrintBatchItemRecords(
  database: PengajuanDatabase,
  values: InsertPrintBatchItem[],
) {
  if (!values.length) return
  await database.insert(printBatchItems).values(values)
}

export async function insertShippingBatchRecord(
  database: PengajuanDatabase,
  values: InsertShippingBatch,
) {
  await database.insert(shippingBatches).values(values)
}

export async function insertShippingBatchItemRecords(
  database: PengajuanDatabase,
  values: InsertShippingBatchItem[],
) {
  if (!values.length) return
  await database.insert(shippingBatchItems).values(values)
}

export async function updatePengajuanRecord(
  database: PengajuanDatabase,
  idPengajuan: string,
  values: UpdatePengajuan,
) {
  const [record] = await database
    .update(pengajuan)
    .set({ ...values, updatedAt: new Date() })
    .where(and(
      eq(pengajuan.idPengajuan, idPengajuan),
      isNull(pengajuan.deletedAt),
    ))
    .returning()

  return record ?? null
}

export async function softDeletePengajuanRecord(
  database: PengajuanDatabase,
  idPengajuan: string,
  actorId: string,
  reason: string,
) {
  const [record] = await database
    .update(pengajuan)
    .set({
      deletedAt: new Date(),
      deletedBy: actorId,
      deletedReason: reason,
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(and(
      eq(pengajuan.idPengajuan, idPengajuan),
      isNull(pengajuan.deletedAt),
    ))
    .returning()

  return record ?? null
}

export async function findItemRecord(
  database: PengajuanDatabase,
  idPengajuan: string,
  noItem: number,
) {
  const [item] = await database
    .select({
      item: pengajuanItems,
      record: pengajuan,
    })
    .from(pengajuanItems)
    .innerJoin(pengajuan, eq(pengajuanItems.pengajuanId, pengajuan.id))
    .where(and(
      eq(pengajuan.idPengajuan, idPengajuan),
      eq(pengajuanItems.noItem, noItem),
      isNull(pengajuan.deletedAt),
    ))

  return item ?? null
}

export async function listItemRecordsByPengajuanId(
  database: PengajuanDatabase,
  pengajuanId: number,
) {
  return database
    .select()
    .from(pengajuanItems)
    .where(eq(pengajuanItems.pengajuanId, pengajuanId))
    .orderBy(asc(pengajuanItems.noItem))
}

export async function updateItemRecord(
  database: PengajuanDatabase,
  itemId: number,
  values: Partial<PengajuanItem>,
) {
  const [item] = await database
    .update(pengajuanItems)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(pengajuanItems.id, itemId))
    .returning()

  return item ?? null
}

export async function updateItemShippingStatusRecord(
  database: PengajuanDatabase,
  itemId: number,
  values: Pick<PengajuanItem, 'lastShippingBatchId' | 'shippedAt'>,
) {
  const [item] = await database
    .update(pengajuanItems)
    .set({
      ...values,
      statusKirim: 'Dikirim',
      updatedAt: new Date(),
    })
    .where(and(
      eq(pengajuanItems.id, itemId),
      eq(pengajuanItems.keputusanItem, 'Disetujui'),
      eq(pengajuanItems.statusCetak, 'Dicetak'),
      eq(pengajuanItems.statusKirim, 'Belum Dikirim'),
    ))
    .returning()

  return item ?? null
}

async function hydratePengajuanRecords(
  database: PengajuanDatabase,
  records: Pengajuan[],
): Promise<PengajuanWithRelations[]> {
  if (!records.length) return []

  const ids = records.map(record => record.id)
  const [items, files, logs] = await Promise.all([
    database
      .select()
      .from(pengajuanItems)
      .where(inArray(pengajuanItems.pengajuanId, ids))
      .orderBy(asc(pengajuanItems.noItem)),
    database
      .select()
      .from(pengajuanFiles)
      .where(inArray(pengajuanFiles.pengajuanId, ids))
      .orderBy(asc(pengajuanFiles.kind), asc(pengajuanFiles.sequence)),
    database
      .select()
      .from(statusLog)
      .where(inArray(statusLog.pengajuanId, ids))
      .orderBy(asc(statusLog.createdAt)),
  ])

  return records.map(record => ({
    pengajuan: record,
    items: items.filter(item => item.pengajuanId === record.id),
    files: files.filter(file => file.pengajuanId === record.id),
    logs: logs.filter(log => log.pengajuanId === record.id),
  }))
}
