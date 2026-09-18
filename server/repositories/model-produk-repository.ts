import { asc, eq } from 'drizzle-orm'
import type { MaukagaDatabase } from '../database'
import {
  auditLog,
  modelProduk,
  type InsertAuditLog,
  type InsertModelProduk,
  type ModelProduk,
} from '../database/schema'

type TransactionCallback = Parameters<MaukagaDatabase['transaction']>[0]
export type ModelProdukTransaction = Parameters<TransactionCallback>[0]
export type ModelProdukDatabase = MaukagaDatabase | ModelProdukTransaction

export async function listModelProdukRecords(
  database: ModelProdukDatabase,
  status?: ModelProduk['status'],
) {
  const query = database
    .select()
    .from(modelProduk)

  return status
    ? query
      .where(eq(modelProduk.status, status))
      .orderBy(asc(modelProduk.model))
    : query.orderBy(asc(modelProduk.model))
}

export async function findModelProdukRecord(
  database: ModelProdukDatabase,
  id: string,
) {
  const [record] = await database
    .select()
    .from(modelProduk)
    .where(eq(modelProduk.id, id))

  return record ?? null
}

export async function findModelProdukByModel(
  database: ModelProdukDatabase,
  model: string,
) {
  const [record] = await database
    .select()
    .from(modelProduk)
    .where(eq(modelProduk.model, model))

  return record ?? null
}

export async function insertModelProdukRecord(
  database: ModelProdukDatabase,
  values: InsertModelProduk,
) {
  const [record] = await database
    .insert(modelProduk)
    .values(values)
    .returning()

  if (!record) throw new Error('Model produk tidak dapat dibuat')
  return record
}

export async function updateModelProdukRecord(
  database: ModelProdukDatabase,
  id: string,
  values: Partial<Pick<ModelProduk, 'produk' | 'origin' | 'status' | 'updatedBy'>>,
) {
  const [record] = await database
    .update(modelProduk)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(modelProduk.id, id))
    .returning()

  return record ?? null
}

export async function insertModelProdukAuditLog(
  database: ModelProdukDatabase,
  values: InsertAuditLog,
) {
  await database.insert(auditLog).values(values)
}
