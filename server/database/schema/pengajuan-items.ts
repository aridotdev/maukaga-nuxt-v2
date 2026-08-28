import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { pengajuan } from './pengajuan'
import {
  ITEM_DECISION_STATUSES,
  MODEL_REVIEW_STATUSES,
  PRINT_STATUSES,
  SHIP_STATUSES,
  WARRANTY_CARD_TYPES,
} from './constants'

export const pengajuanItems = sqliteTable('pengajuan_items', {
  idPengajuan: text('id_pengajuan')
    .notNull()
    .references(() => pengajuan.idPengajuan, { onDelete: 'cascade' }),
  noItem: integer('no_item').notNull(),
  produk: text('produk'),
  model: text('model'),
  nomorSeri: text('nomor_seri'),

  keputusanItem: text('keputusan_item', { enum: ITEM_DECISION_STATUSES }),
  catatanAdminItem: text('catatan_admin_item'),
  tanggalUpdateKeputusanItem: text('tanggal_update_keputusan_item'),
  userUpdateKeputusanItem: text('user_update_keputusan_item'),

  jenisKartu: text('jenis_kartu', { enum: WARRANTY_CARD_TYPES }),
  statusCetak: text('status_cetak', { enum: PRINT_STATUSES }).notNull().default('Belum Dicetak'),
  printBatchId: text('print_batch_id'),
  printedAt: text('printed_at'),
  statusKirim: text('status_kirim', { enum: SHIP_STATUSES }).notNull().default('Belum Dikirim'),
  shipBatchId: text('ship_batch_id'),
  shippedAt: text('shipped_at'),

  modelNormalized: text('model_normalized'),
  produkStatus: text('produk_status', { enum: MODEL_REVIEW_STATUSES }),
  produkSumber: text('produk_sumber'),

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
}, (table) => [
  primaryKey({ columns: [table.idPengajuan, table.noItem] }),
  index('items_id_pengajuan_idx').on(table.idPengajuan),
  index('items_model_idx').on(table.modelNormalized),
  index('items_nomor_seri_idx').on(table.nomorSeri),
  index('items_status_cetak_idx').on(table.statusCetak),
  index('items_status_kirim_idx').on(table.statusKirim),
])

export const insertPengajuanItemsSchema = createInsertSchema(pengajuanItems, {
  idPengajuan: z.string().min(1, 'ID Pengajuan is required').trim(),
  noItem: z.number().int().positive('No Item must be a positive integer'),
  keputusanItem: z.enum(ITEM_DECISION_STATUSES).optional().nullable(),
  jenisKartu: z.enum(WARRANTY_CARD_TYPES).optional().nullable(),
  statusCetak: z.enum(PRINT_STATUSES).optional(),
  statusKirim: z.enum(SHIP_STATUSES).optional(),
  produkStatus: z.enum(MODEL_REVIEW_STATUSES).optional().nullable(),
}).omit({
  createdAt: true,
  updatedAt: true,
})

export const selectPengajuanItemsSchema = createSelectSchema(pengajuanItems)
export const updatePengajuanItemsSchema = createUpdateSchema(pengajuanItems, {
  keputusanItem: z.enum(ITEM_DECISION_STATUSES).optional().nullable(),
  jenisKartu: z.enum(WARRANTY_CARD_TYPES).optional().nullable(),
  statusCetak: z.enum(PRINT_STATUSES).optional(),
  statusKirim: z.enum(SHIP_STATUSES).optional(),
  produkStatus: z.enum(MODEL_REVIEW_STATUSES).optional().nullable(),
}).omit({
  idPengajuan: true,
  noItem: true,
  createdAt: true,
  updatedAt: true,
})

export type PengajuanItem = typeof pengajuanItems.$inferSelect
export type InsertPengajuanItem = z.infer<typeof insertPengajuanItemsSchema>
export type UpdatePengajuanItem = z.infer<typeof updatePengajuanItemsSchema>