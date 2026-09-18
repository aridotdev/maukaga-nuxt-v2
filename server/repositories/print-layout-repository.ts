import { asc, eq } from 'drizzle-orm'
import type { MaukagaDatabase } from '../database'
import {
  auditLog,
  printLayouts,
  type InsertAuditLog,
  type InsertPrintLayout,
  type PrintLayout,
} from '../database/schema'

type TransactionCallback = Parameters<MaukagaDatabase['transaction']>[0]
export type PrintLayoutTransaction = Parameters<TransactionCallback>[0]
export type PrintLayoutDatabase = MaukagaDatabase | PrintLayoutTransaction

export async function listPrintLayoutRecords(database: PrintLayoutDatabase) {
  return database
    .select()
    .from(printLayouts)
    .orderBy(asc(printLayouts.type), asc(printLayouts.isBuiltin), asc(printLayouts.name))
}

export async function findPrintLayoutRecord(
  database: PrintLayoutDatabase,
  id: string,
) {
  const [record] = await database
    .select()
    .from(printLayouts)
    .where(eq(printLayouts.id, id))

  return record ?? null
}

export async function insertPrintLayoutRecord(
  database: PrintLayoutDatabase,
  values: InsertPrintLayout,
) {
  const [record] = await database
    .insert(printLayouts)
    .values(values)
    .returning()

  if (!record) throw new Error('Layout cetak tidak dapat dibuat')
  return record
}

export async function updatePrintLayoutRecord(
  database: PrintLayoutDatabase,
  id: string,
  values: Partial<Pick<
    PrintLayout,
    'type' | 'name' | 'offsetX' | 'offsetY' | 'gapProductModel' | 'gapModelSerial' | 'isBuiltin' | 'updatedBy'
  >>,
) {
  const [record] = await database
    .update(printLayouts)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(printLayouts.id, id))
    .returning()

  return record ?? null
}

export async function deletePrintLayoutRecord(
  database: PrintLayoutDatabase,
  id: string,
) {
  await database
    .delete(printLayouts)
    .where(eq(printLayouts.id, id))
}

export async function insertPrintLayoutAuditLog(
  database: PrintLayoutDatabase,
  values: InsertAuditLog,
) {
  await database.insert(auditLog).values(values)
}
