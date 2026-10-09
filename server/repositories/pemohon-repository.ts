import { asc, eq } from 'drizzle-orm'
import type { MaukagaDatabase } from '../database'
import {
  auditLog,
  pemohon,
  type InsertAuditLog,
  type InsertPemohon,
  type Pemohon,
} from '../database/schema'

type TransactionCallback = Parameters<MaukagaDatabase['transaction']>[0]
export type PemohonTransaction = Parameters<TransactionCallback>[0]
export type PemohonDatabase = MaukagaDatabase | PemohonTransaction

export async function listPemohonRecords(database: PemohonDatabase) {
  return database
    .select()
    .from(pemohon)
    .orderBy(asc(pemohon.nama), asc(pemohon.bagian), asc(pemohon.cabang))
}

export async function findPemohonRecord(
  database: PemohonDatabase,
  id: string,
) {
  const [record] = await database
    .select()
    .from(pemohon)
    .where(eq(pemohon.id, id))

  return record ?? null
}

export async function findPemohonByEmail(
  database: PemohonDatabase,
  email: string,
) {
  const [record] = await database
    .select()
    .from(pemohon)
    .where(eq(pemohon.email, email))

  return record ?? null
}

export async function insertPemohonRecord(
  database: PemohonDatabase,
  values: InsertPemohon,
) {
  const [record] = await database
    .insert(pemohon)
    .values(values)
    .returning()

  if (!record) throw new Error('Pemohon tidak dapat dibuat')
  return record
}

export async function updatePemohonRecord(
  database: PemohonDatabase,
  id: string,
  values: Partial<Pick<
    Pemohon,
    'nama' | 'bagian' | 'cabang' | 'email' | 'nomorHp' | 'updatedBy'
  >>,
) {
  const [record] = await database
    .update(pemohon)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(pemohon.id, id))
    .returning()

  return record ?? null
}

export async function deletePemohonRecord(
  database: PemohonDatabase,
  id: string,
) {
  await database
    .delete(pemohon)
    .where(eq(pemohon.id, id))
}

export async function insertPemohonAuditLog(
  database: PemohonDatabase,
  values: InsertAuditLog,
) {
  await database.insert(auditLog).values(values)
}
