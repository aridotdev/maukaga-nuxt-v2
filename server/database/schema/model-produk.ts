import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

// Konstanta opsi origin & status yang divalidasi
const ORIGIN_OPTIONS = ['local', 'import'] as const
const STATUS_OPTIONS = ['verified', 'needs_review'] as const

// ============================================================
// TABLE DEFINITION
// ============================================================

export const modelProduk = sqliteTable('model_produk', {
  // Primary Key (unik per model)
  model: text('model').primaryKey(),
  
  produk: text('produk').notNull(),
  origin: text('origin'),
  status: text('status').default('verified'),
  
  // Kolom bawaan dari GAS
  updatedAt: text('updated_at'), 
  updatedBy: text('updated_by'),

  // Metadata Standar Lokal
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  // Menggunakan nama localUpdatedAt agar tidak konflik dengan updatedAt dari GAS
  localUpdatedAt: integer('local_updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
}, (table) => [
  // Indeks untuk mempercepat pencarian kategori produk dan filter status
  index('model_produk_nama_idx').on(table.produk),
  index('model_produk_status_idx').on(table.status)
])

// ============================================================
// ZOD SCHEMAS
// ============================================================

export const insertModelProdukSchema = createInsertSchema(modelProduk, {
  model: z.string().min(1, 'Model is required').trim(),
  produk: z.string().min(1, 'Produk is required').trim(),
  origin: z.enum(ORIGIN_OPTIONS).optional().nullable(),
  status: z.enum(STATUS_OPTIONS).optional().nullable(),
}).omit({
  createdAt: true,
  localUpdatedAt: true
})

export const selectModelProdukSchema = createSelectSchema(modelProduk)

export const updateModelProdukSchema = insertModelProdukSchema.partial().omit({
  model: true // Primary key tidak boleh di-update, jika berubah = buat baru
})

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ModelProduk = typeof modelProduk.$inferSelect
export type InsertModelProduk = z.infer<typeof insertModelProdukSchema>
export type UpdateModelProduk = z.infer<typeof updateModelProdukSchema>