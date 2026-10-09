import { asc, eq } from 'drizzle-orm'
import type { MaukagaDatabase } from '../database'
import {
  auditLog,
  pemilikBarang,
  type InsertAuditLog,
  type InsertPemilikBarang,
  type PemilikBarang,
} from '../database/schema'

type TransactionCallback = Parameters<MaukagaDatabase['transaction']>[0]
export type PemilikBarangTransaction = Parameters<TransactionCallback>[0]
export type PemilikBarangDatabase = MaukagaDatabase | PemilikBarangTransaction

export async function listPemilikBarangRecords(
  database: PemilikBarangDatabase,
) {
  return database
    .select()
    .from(pemilikBarang)
    .orderBy(asc(pemilikBarang.nama))
}

export async function findPemilikBarangRecord(
  database: PemilikBarangDatabase,
  id: string,
) {
  const [record] = await database
    .select()
    .from(pemilikBarang)
    .where(eq(pemilikBarang.id, id))

  return record ?? null
}

export async function findPemilikBarangByNama(
  database: PemilikBarangDatabase,
  nama: string,
) {
  const [record] = await database
    .select()
    .from(pemilikBarang)
    .where(eq(pemilikBarang.nama, nama))

  return record ?? null
}

export async function insertPemilikBarangRecord(
  database: PemilikBarangDatabase,
  values: InsertPemilikBarang,
) {
  const [record] = await database
    .insert(pemilikBarang)
    .values(values)
    .returning()

  if (!record) throw new Error('Pemilik barang tidak dapat dibuat')
  return record
}

export async function updatePemilikBarangRecord(
  database: PemilikBarangDatabase,
  id: string,
  values: Partial<Pick<PemilikBarang, 'nama' | 'updatedBy'>>,
) {
  const [record] = await database
    .update(pemilikBarang)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(pemilikBarang.id, id))
    .returning()

  return record ?? null
}

export async function deletePemilikBarangRecord(
  database: PemilikBarangDatabase,
  id: string,
) {
  await database
    .delete(pemilikBarang)
    .where(eq(pemilikBarang.id, id))
}

export async function insertPemilikBarangAuditLog(
  database: PemilikBarangDatabase,
  values: InsertAuditLog,
) {
  await database.insert(auditLog).values(values)
}
