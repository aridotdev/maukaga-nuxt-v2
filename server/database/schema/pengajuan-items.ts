import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { pengajuan } from './pengajuan'

// Konstanta diambil dari Code_2.gs
const ITEM_DECISION_STATUSES = ['Disetujui', 'Ditolak'] as const

// ============================================================
// TABLE DEFINITION
// ============================================================

export const pengajuanItems = sqliteTable('pengajuan_items', {
  // Foreign Key ke tabel pengajuan
  idPengajuan: text('id_pengajuan')
    .notNull()
    .references(() => pengajuan.idPengajuan, { onDelete: 'cascade' }),
  
  noItem: integer('no_item').notNull(),
  produk: text('produk'),
  model: text('model'),
  nomorSeri: text('nomor_seri'),
  
  // Keputusan & Catatan Admin
  keputusanItem: text('keputusan_item'),
  catatanAdminItem: text('catatan_admin_item'),
  tanggalUpdateKeputusanItem: text('tanggal_update_keputusan_item'),
  userUpdateKeputusanItem: text('user_update_keputusan_item'),

  // Status Cetak & Kirim
  jenisKartu: text('jenis_kartu'),
  statusCetak: text('status_cetak'),
  printBatchId: text('print_batch_id'),
  printedAt: text('printed_at'),
  statusKirim: text('status_kirim'),
  shipBatchId: text('ship_batch_id'),
  shippedAt: text('shipped_at'),
  
  // Normalisasi & Review Produk
  modelNormalized: text('model_normalized'),
  produkStatus: text('produk_status'),
  produkSumber: text('produk_sumber'),

  // Metadata Standar Lokal
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
}, (table) => [
  // Composite Primary Key
  primaryKey({ columns: [table.idPengajuan, table.noItem] }),
  
  // Indeks untuk pencarian & filtering performa tinggi
  index('items_id_pengajuan_idx').on(table.idPengajuan),
  index('items_model_idx').on(table.modelNormalized),
  index('items_nomor_seri_idx').on(table.nomorSeri)
])

// ============================================================
// ZOD SCHEMAS
// ============================================================

export const insertPengajuanItemsSchema = createInsertSchema(pengajuanItems, {
  idPengajuan: z.string().min(1, 'ID Pengajuan is required').trim(),
  noItem: z.number().int().positive('No Item must be a positive integer'),
  keputusanItem: z.enum(ITEM_DECISION_STATUSES).optional(),
}).omit({
  createdAt: true,
  updatedAt: true
})

export const selectPengajuanItemsSchema = createSelectSchema(pengajuanItems)

export const updatePengajuanItemsSchema = insertPengajuanItemsSchema.partial().omit({
  idPengajuan: true,
  noItem: true // PK tidak boleh diubah setelah dibuat
})

// ============================================================
// TYPE EXPORTS
// ============================================================

export type PengajuanItem = typeof pengajuanItems.$inferSelect
export type InsertPengajuanItem = z.infer<typeof insertPengajuanItemsSchema>
export type UpdatePengajuanItem = z.infer<typeof updatePengajuanItemsSchema>