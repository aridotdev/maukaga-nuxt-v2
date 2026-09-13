import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { MODEL_ORIGINS, MODEL_REVIEW_STATUSES } from './constants'

export const modelProduk = sqliteTable('model_produk', {
  id: text('id').primaryKey(),
  model: text('model').notNull(),
  produk: text('produk').notNull(),
  origin: text('origin', { enum: MODEL_ORIGINS }).notNull().default('local'),
  status: text('status', { enum: MODEL_REVIEW_STATUSES }).notNull().default('verified'),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),

  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
}, (table) => [
  uniqueIndex('model_produk_model_uidx').on(table.model),
  index('model_produk_produk_idx').on(table.produk),
  index('model_produk_status_idx').on(table.status),
])

export const insertModelProdukSchema = createInsertSchema(modelProduk, {
  id: z.string().min(1, 'Model product ID is required').trim(),
  model: z.string().min(1, 'Model is required').trim(),
  produk: z.string().min(1, 'Produk is required').trim(),
  origin: z.enum(MODEL_ORIGINS).optional(),
  status: z.enum(MODEL_REVIEW_STATUSES).optional(),
}).omit({
  createdAt: true,
  updatedAt: true,
})

export const selectModelProdukSchema = createSelectSchema(modelProduk)
export const updateModelProdukSchema = createUpdateSchema(modelProduk, {
  model: z.string().min(1).trim().optional(),
  produk: z.string().min(1).trim().optional(),
  origin: z.enum(MODEL_ORIGINS).optional(),
  status: z.enum(MODEL_REVIEW_STATUSES).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type ModelProduk = typeof modelProduk.$inferSelect
export type InsertModelProduk = z.infer<typeof insertModelProdukSchema>
export type UpdateModelProduk = z.infer<typeof updateModelProdukSchema>
