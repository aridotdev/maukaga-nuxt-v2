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
import { modelProduk } from './model-produk'
import { pengajuan } from './pengajuan'
import {
  ITEM_DECISION_STATUSES,
  ITEM_PRINT_STATUSES,
  ITEM_SHIPPING_STATUSES,
  WARRANTY_CARD_TYPES,
} from './constants'

export const pengajuanItems = sqliteTable('pengajuan_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pengajuanId: integer('pengajuan_id')
    .notNull()
    .references(() => pengajuan.id, { onDelete: 'cascade' }),
  noItem: integer('no_item').notNull(),

  modelProdukId: text('model_produk_id').references(() => modelProduk.id, {
    onDelete: 'set null',
  }),
  produk: text('produk'),
  model: text('model').notNull(),
  modelNormalized: text('model_normalized').notNull(),
  nomorSeri: text('nomor_seri').notNull(),
  nomorSeriNormalized: text('nomor_seri_normalized').notNull(),

  keputusanItem: text('keputusan_item', { enum: ITEM_DECISION_STATUSES })
    .notNull()
    .default('Menunggu'),
  catatanKeputusan: text('catatan_keputusan'),
  keputusanOleh: text('keputusan_oleh'),
  keputusanAt: integer('keputusan_at', { mode: 'timestamp_ms' }),

  jenisKartu: text('jenis_kartu', { enum: WARRANTY_CARD_TYPES }),
  statusCetak: text('status_cetak', { enum: ITEM_PRINT_STATUSES })
    .notNull()
    .default('Belum Dicetak'),
  statusKirim: text('status_kirim', { enum: ITEM_SHIPPING_STATUSES })
    .notNull()
    .default('Belum Dikirim'),
  lastPrintBatchId: text('last_print_batch_id'),
  lastShippingBatchId: text('last_shipping_batch_id'),
  printedAt: integer('printed_at', { mode: 'timestamp_ms' }),
  shippedAt: integer('shipped_at', { mode: 'timestamp_ms' }),

  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
}, (table) => [
  uniqueIndex('pengajuan_items_pengajuan_no_item_uidx').on(
    table.pengajuanId,
    table.noItem,
  ),
  uniqueIndex('pengajuan_items_model_serial_uidx').on(
    table.modelNormalized,
    table.nomorSeriNormalized,
  ),
  index('pengajuan_items_pengajuan_id_idx').on(table.pengajuanId),
  index('pengajuan_items_model_idx').on(table.modelNormalized),
  index('pengajuan_items_serial_idx').on(table.nomorSeriNormalized),
  index('pengajuan_items_decision_idx').on(table.keputusanItem),
  index('pengajuan_items_print_status_idx').on(table.statusCetak),
  index('pengajuan_items_shipping_status_idx').on(table.statusKirim),
])

export const insertPengajuanItemsSchema = createInsertSchema(pengajuanItems, {
  pengajuanId: z.number().int().positive(),
  noItem: z.number().int().positive('No Item must be a positive integer'),
  modelProdukId: z.string().min(1).trim().optional().nullable(),
  model: z.string().min(1, 'Model is required').trim(),
  modelNormalized: z.string().min(1).trim(),
  nomorSeri: z.string().min(1, 'Nomor seri is required').trim(),
  nomorSeriNormalized: z.string().min(1).trim(),
  keputusanItem: z.enum(ITEM_DECISION_STATUSES).optional(),
  jenisKartu: z.enum(WARRANTY_CARD_TYPES).optional().nullable(),
  statusCetak: z.enum(ITEM_PRINT_STATUSES).optional(),
  statusKirim: z.enum(ITEM_SHIPPING_STATUSES).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const selectPengajuanItemsSchema = createSelectSchema(pengajuanItems)
export const updatePengajuanItemsSchema = createUpdateSchema(pengajuanItems, {
  noItem: z.number().int().positive().optional(),
  modelProdukId: z.string().min(1).trim().optional().nullable(),
  model: z.string().min(1).trim().optional(),
  modelNormalized: z.string().min(1).trim().optional(),
  nomorSeri: z.string().min(1).trim().optional(),
  nomorSeriNormalized: z.string().min(1).trim().optional(),
  keputusanItem: z.enum(ITEM_DECISION_STATUSES).optional(),
  jenisKartu: z.enum(WARRANTY_CARD_TYPES).optional().nullable(),
  statusCetak: z.enum(ITEM_PRINT_STATUSES).optional(),
  statusKirim: z.enum(ITEM_SHIPPING_STATUSES).optional(),
}).omit({
  id: true,
  pengajuanId: true,
  createdAt: true,
  updatedAt: true,
})

export type PengajuanItem = typeof pengajuanItems.$inferSelect
export type InsertPengajuanItem = z.infer<typeof insertPengajuanItemsSchema>
export type UpdatePengajuanItem = z.infer<typeof updatePengajuanItemsSchema>
