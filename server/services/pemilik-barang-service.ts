import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import * as z from 'zod'
import { type MaukagaDatabase, useDb } from '../database'
import type { PemilikBarang } from '../database/schema'
import {
  deletePemilikBarangRecord,
  findPemilikBarangByNama,
  findPemilikBarangRecord,
  insertPemilikBarangAuditLog,
  insertPemilikBarangRecord,
  listPemilikBarangRecords,
  updatePemilikBarangRecord,
} from '../repositories/pemilik-barang-repository'

export interface PemilikBarangServiceOptions {
  database?: MaukagaDatabase
  actorId: string
}

export type PemilikBarangDto = {
  id: string
  nama: string
  createdAt: string
  updatedAt: string
}

export type PemilikBarangListDto = {
  rows: PemilikBarangDto[]
}

export const pemilikBarangCreateInputSchema = z.object({
  nama: z.string().trim().min(1, 'Nama Dealer/Toko wajib diisi').max(160, 'Nama Dealer/Toko terlalu panjang'),
})

export const pemilikBarangUpdateInputSchema = pemilikBarangCreateInputSchema
  .partial()
  .refine(input => Object.keys(input).length > 0, {
    message: 'Tidak ada data yang diperbarui',
  })

export async function listPemilikBarang(
  database = useDb(),
): Promise<PemilikBarangListDto> {
  const rows = (await listPemilikBarangRecords(database)).map(mapPemilikBarangDto)
  return { rows }
}

export async function createPemilikBarang(
  input: unknown,
  options: PemilikBarangServiceOptions,
): Promise<PemilikBarangDto> {
  const database = options.database ?? useDb()
  const data = normalizeCreateInput(input)

  try {
    const record = await database.transaction(async (tx) => {
      const existing = await findPemilikBarangByNama(tx, data.nama)
      if (existing) throw duplicatePemilikBarangError(data.nama)

      const created = await insertPemilikBarangRecord(tx, {
        id: randomUUID(),
        nama: data.nama,
        createdBy: options.actorId,
        updatedBy: options.actorId,
      })

      await insertPemilikBarangAuditLog(tx, {
        actorId: options.actorId,
        action: 'pemilik-barang.create',
        entityType: 'pemilik_barang',
        entityId: created.id,
        metadataJson: JSON.stringify({ nama: created.nama }),
      })

      return created
    })

    return mapPemilikBarangDto(record)
  } catch (error) {
    throw normalizePemilikBarangDatabaseError(error)
  }
}

export async function updatePemilikBarang(
  id: string,
  input: unknown,
  options: PemilikBarangServiceOptions,
): Promise<PemilikBarangDto> {
  const database = options.database ?? useDb()
  const data = normalizeUpdateInput(input)

  try {
    const record = await database.transaction(async (tx) => {
      const current = await findPemilikBarangRecord(tx, id)
      if (!current) throw notFoundPemilikBarangError(id)

      if (data.nama) {
        const existing = await findPemilikBarangByNama(tx, data.nama)
        if (existing && existing.id !== id) throw duplicatePemilikBarangError(data.nama)
      }

      const updated = await updatePemilikBarangRecord(tx, id, {
        nama: data.nama,
        updatedBy: options.actorId,
      })
      if (!updated) throw notFoundPemilikBarangError(id)

      await insertPemilikBarangAuditLog(tx, {
        actorId: options.actorId,
        action: 'pemilik-barang.update',
        entityType: 'pemilik_barang',
        entityId: id,
        metadataJson: JSON.stringify({
          before: { nama: current.nama },
          after: { nama: updated.nama },
        }),
      })

      return updated
    })

    return mapPemilikBarangDto(record)
  } catch (error) {
    throw normalizePemilikBarangDatabaseError(error)
  }
}

export async function deletePemilikBarang(
  id: string,
  options: PemilikBarangServiceOptions,
): Promise<void> {
  const database = options.database ?? useDb()

  try {
    await database.transaction(async (tx) => {
      const current = await findPemilikBarangRecord(tx, id)
      if (!current) throw notFoundPemilikBarangError(id)

      await deletePemilikBarangRecord(tx, id)
      await insertPemilikBarangAuditLog(tx, {
        actorId: options.actorId,
        action: 'pemilik-barang.delete',
        entityType: 'pemilik_barang',
        entityId: id,
        metadataJson: JSON.stringify({ nama: current.nama }),
      })
    })
  } catch (error) {
    throw normalizePemilikBarangDatabaseError(error)
  }
}

function normalizeCreateInput(input: unknown) {
  const data = pemilikBarangCreateInputSchema.parse(input)
  return { nama: normalizeText(data.nama) }
}

function normalizeUpdateInput(input: unknown) {
  const data = pemilikBarangUpdateInputSchema.parse(input)
  return {
    nama: data.nama === undefined ? undefined : normalizeText(data.nama),
  }
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function mapPemilikBarangDto(record: PemilikBarang): PemilikBarangDto {
  return {
    id: record.id,
    nama: record.nama,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function duplicatePemilikBarangError(nama: string) {
  return createError({
    statusCode: 409,
    statusMessage: `Dealer/Toko "${nama}" sudah terdaftar`,
  })
}

function notFoundPemilikBarangError(id: string) {
  return createError({
    statusCode: 404,
    statusMessage: `Dealer/Toko ${id} tidak ditemukan`,
  })
}

function normalizePemilikBarangDatabaseError(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) return error
  if (error instanceof z.ZodError) return error

  if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
    return createError({
      statusCode: 409,
      statusMessage: 'Dealer/Toko tersebut sudah terdaftar',
    })
  }

  return error
}
