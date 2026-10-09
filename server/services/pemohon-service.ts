import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import * as z from 'zod'
import { type MaukagaDatabase, useDb } from '../database'
import type { Pemohon } from '../database/schema'
import {
  deletePemohonRecord,
  findPemohonByEmail,
  findPemohonRecord,
  insertPemohonAuditLog,
  insertPemohonRecord,
  listPemohonRecords,
  updatePemohonRecord,
} from '../repositories/pemohon-repository'

export interface PemohonServiceOptions {
  database?: MaukagaDatabase
  actorId: string
}

export type PemohonDto = {
  id: string
  nama: string
  bagian: string
  cabang: string
  email: string | null
  nomorHp: string | null
  createdAt: string
  updatedAt: string
}

export type PemohonListDto = {
  rows: PemohonDto[]
}

export const pemohonCreateInputSchema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi').max(120, 'Nama terlalu panjang'),
  bagian: z.string().trim().min(1, 'Bagian wajib diisi').max(120, 'Bagian terlalu panjang'),
  cabang: z.string().trim().min(1, 'Cabang wajib diisi').max(120, 'Cabang terlalu panjang'),
  email: z.union([
    z.string().trim().pipe(z.email('Format email tidak valid')),
    z.literal(''),
  ]).nullable().optional(),
  nomorHp: z.string().trim().max(40, 'Nomor HP terlalu panjang').nullable().optional(),
})

export const pemohonUpdateInputSchema = pemohonCreateInputSchema.partial()
  .refine(input => Object.keys(input).length > 0, {
    message: 'Tidak ada data yang diperbarui',
  })

export async function listPemohon(
  database = useDb(),
): Promise<PemohonListDto> {
  const rows = (await listPemohonRecords(database)).map(mapPemohonDto)
  return { rows }
}

export async function createPemohon(
  input: unknown,
  options: PemohonServiceOptions,
): Promise<PemohonDto> {
  const database = options.database ?? useDb()
  const data = normalizeCreateInput(input)

  try {
    const record = await database.transaction(async (tx) => {
      if (data.email) {
        const existing = await findPemohonByEmail(tx, data.email)
        if (existing) throw duplicatePemohonEmailError()
      }

      const created = await insertPemohonRecord(tx, {
        id: randomUUID(),
        nama: data.nama,
        bagian: data.bagian,
        cabang: data.cabang,
        email: data.email,
        nomorHp: data.nomorHp,
        createdBy: options.actorId,
        updatedBy: options.actorId,
      })

      await insertPemohonAuditLog(tx, {
        actorId: options.actorId,
        action: 'pemohon.create',
        entityType: 'pemohon',
        entityId: created.id,
        metadataJson: JSON.stringify({
          nama: created.nama,
          bagian: created.bagian,
          cabang: created.cabang,
          email: created.email,
        }),
      })

      return created
    })

    return mapPemohonDto(record)
  } catch (error) {
    throw normalizePemohonDatabaseError(error)
  }
}

export async function updatePemohon(
  id: string,
  input: unknown,
  options: PemohonServiceOptions,
): Promise<PemohonDto> {
  const database = options.database ?? useDb()
  const data = normalizeUpdateInput(input)

  try {
    const record = await database.transaction(async (tx) => {
      const current = await findPemohonRecord(tx, id)
      if (!current) throw notFoundPemohonError(id)

      if (data.email) {
        const existing = await findPemohonByEmail(tx, data.email)
        if (existing && existing.id !== id) throw duplicatePemohonEmailError()
      }

      const updated = await updatePemohonRecord(tx, id, {
        nama: data.nama,
        bagian: data.bagian,
        cabang: data.cabang,
        email: data.email,
        nomorHp: data.nomorHp,
        updatedBy: options.actorId,
      })
      if (!updated) throw notFoundPemohonError(id)

      await insertPemohonAuditLog(tx, {
        actorId: options.actorId,
        action: 'pemohon.update',
        entityType: 'pemohon',
        entityId: id,
        metadataJson: JSON.stringify({
          before: pemohonAuditData(current),
          after: pemohonAuditData(updated),
        }),
      })

      return updated
    })

    return mapPemohonDto(record)
  } catch (error) {
    throw normalizePemohonDatabaseError(error)
  }
}

export async function deletePemohon(
  id: string,
  options: PemohonServiceOptions,
): Promise<void> {
  const database = options.database ?? useDb()

  try {
    await database.transaction(async (tx) => {
      const current = await findPemohonRecord(tx, id)
      if (!current) throw notFoundPemohonError(id)

      await deletePemohonRecord(tx, id)
      await insertPemohonAuditLog(tx, {
        actorId: options.actorId,
        action: 'pemohon.delete',
        entityType: 'pemohon',
        entityId: id,
        metadataJson: JSON.stringify(pemohonAuditData(current)),
      })
    })
  } catch (error) {
    throw normalizePemohonDatabaseError(error)
  }
}

function normalizeCreateInput(input: unknown) {
  const data = pemohonCreateInputSchema.parse(input)

  return {
    nama: normalizeText(data.nama),
    bagian: normalizeText(data.bagian),
    cabang: normalizeText(data.cabang),
    email: normalizeEmail(data.email),
    nomorHp: normalizeOptionalText(data.nomorHp),
  }
}

function normalizeUpdateInput(input: unknown) {
  const data = pemohonUpdateInputSchema.parse(input)

  return {
    nama: data.nama === undefined ? undefined : normalizeText(data.nama),
    bagian: data.bagian === undefined ? undefined : normalizeText(data.bagian),
    cabang: data.cabang === undefined ? undefined : normalizeText(data.cabang),
    email: data.email === undefined ? undefined : normalizeEmail(data.email),
    nomorHp: data.nomorHp === undefined ? undefined : normalizeOptionalText(data.nomorHp),
  }
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? ''
  return normalized || null
}

function normalizeOptionalText(value: string | null | undefined) {
  if (value == null) return null
  const normalized = normalizeText(value)
  return normalized || null
}

function mapPemohonDto(record: Pemohon): PemohonDto {
  return {
    id: record.id,
    nama: record.nama,
    bagian: record.bagian,
    cabang: record.cabang,
    email: record.email,
    nomorHp: record.nomorHp,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function pemohonAuditData(record: Pemohon) {
  return {
    nama: record.nama,
    bagian: record.bagian,
    cabang: record.cabang,
    email: record.email,
    nomorHp: record.nomorHp,
  }
}

function duplicatePemohonEmailError() {
  return createError({
    statusCode: 409,
    statusMessage: 'Email Pemohon sudah terdaftar',
  })
}

function notFoundPemohonError(id: string) {
  return createError({
    statusCode: 404,
    statusMessage: `Pemohon ${id} tidak ditemukan`,
  })
}

function normalizePemohonDatabaseError(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) return error
  if (error instanceof z.ZodError) return error

  if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
    return duplicatePemohonEmailError()
  }

  return error
}
