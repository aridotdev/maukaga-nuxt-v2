import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import * as z from 'zod'
import { type MaukagaDatabase, useDb } from '../database'
import {
  MODEL_ORIGINS,
  type ModelProduk,
} from '../database/schema'
import {
  findModelProdukByModel,
  findModelProdukRecord,
  insertModelProdukAuditLog,
  insertModelProdukRecord,
  listModelProdukRecords,
  updateModelProdukRecord,
} from '../repositories/model-produk-repository'

export type ModelProdukOrigin = typeof MODEL_ORIGINS[number]
export type ModelProdukStatus = ModelProduk['status']

export interface ModelProdukServiceOptions {
  database?: MaukagaDatabase
  actorId: string
}

export const modelProdukCreateInputSchema = z.object({
  model: z.string().trim().min(1, 'Model wajib diisi').max(120, 'Model terlalu panjang'),
  produk: z.string().trim().min(1, 'Nama produk wajib diisi').max(120, 'Nama produk terlalu panjang'),
  origin: z.enum(MODEL_ORIGINS),
})

export const modelProdukUpdateInputSchema = z.object({
  produk: z.string().trim().min(1, 'Nama produk wajib diisi').max(120, 'Nama produk terlalu panjang'),
  origin: z.enum(MODEL_ORIGINS),
})

export async function listModelProduk(
  options: { status?: ModelProdukStatus } = {},
  database = useDb(),
) {
  const records = await listModelProdukRecords(database, options.status)
  const rows = records.map(mapModelProdukDto)

  return {
    rows,
    summary: {
      total: rows.length,
      verified: rows.filter(row => row.status === 'verified').length,
      needsReview: rows.filter(row => row.status === 'needs_review').length,
    },
  }
}

export async function createModelProduk(
  input: z.input<typeof modelProdukCreateInputSchema>,
  options: ModelProdukServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = normalizeCreateInput(input)

  try {
    const record = await database.transaction(async (tx) => {
      const existing = await findModelProdukByModel(tx, data.model)
      if (existing) throw duplicateModelError(data.model)

      const created = await insertModelProdukRecord(tx, {
        id: randomUUID(),
        model: data.model,
        produk: data.produk,
        origin: data.origin,
        status: 'verified',
        createdBy: options.actorId,
        updatedBy: options.actorId,
      })

      await insertModelProdukAuditLog(tx, {
        actorId: options.actorId,
        action: 'model-produk.create',
        entityType: 'model_produk',
        entityId: created.id,
        metadataJson: JSON.stringify({
          model: created.model,
          produk: created.produk,
          origin: created.origin,
        }),
      })

      return created
    })

    return mapModelProdukDto(record)
  } catch (error) {
    throw normalizeModelProdukDatabaseError(error)
  }
}

export async function updateModelProduk(
  id: string,
  input: z.input<typeof modelProdukUpdateInputSchema>,
  options: ModelProdukServiceOptions,
) {
  const database = options.database ?? useDb()
  const parsed = modelProdukUpdateInputSchema.parse(input)
  const data = {
    ...parsed,
    produk: normalizeText(parsed.produk),
  }

  try {
    const record = await database.transaction(async (tx) => {
      const existing = await findModelProdukRecord(tx, id)
      if (!existing) throw notFoundModelError(id)

      const updated = await updateModelProdukRecord(tx, id, {
        produk: data.produk,
        origin: data.origin,
        status: 'verified',
        updatedBy: options.actorId,
      })
      if (!updated) throw notFoundModelError(id)

      await insertModelProdukAuditLog(tx, {
        actorId: options.actorId,
        action: 'model-produk.update',
        entityType: 'model_produk',
        entityId: id,
        metadataJson: JSON.stringify({
          before: {
            model: existing.model,
            produk: existing.produk,
            origin: existing.origin,
            status: existing.status,
          },
          after: {
            model: updated.model,
            produk: updated.produk,
            origin: updated.origin,
            status: updated.status,
          },
        }),
      })

      return updated
    })

    return mapModelProdukDto(record)
  } catch (error) {
    throw normalizeModelProdukDatabaseError(error)
  }
}

function normalizeCreateInput(
  input: z.input<typeof modelProdukCreateInputSchema>,
) {
  const data = modelProdukCreateInputSchema.parse(input)

  return {
    ...data,
    model: normalizeModel(data.model),
    produk: normalizeText(data.produk),
  }
}

function normalizeModel(value: string) {
  return normalizeText(value).toUpperCase()
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function mapModelProdukDto(record: ModelProduk) {
  return {
    id: record.id,
    model: record.model,
    produk: record.produk,
    origin: record.origin,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function duplicateModelError(model: string) {
  return createError({
    statusCode: 409,
    statusMessage: `Model "${model}" sudah terdaftar`,
  })
}

function notFoundModelError(id: string) {
  return createError({
    statusCode: 404,
    statusMessage: `Model produk ${id} tidak ditemukan`,
  })
}

function normalizeModelProdukDatabaseError(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) return error
  if (error instanceof z.ZodError) return error

  if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
    return createError({
      statusCode: 409,
      statusMessage: 'Model tersebut sudah terdaftar',
    })
  }

  return error
}
