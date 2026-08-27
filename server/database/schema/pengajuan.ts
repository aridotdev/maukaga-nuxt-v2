import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

// Konstanta status yang valid diambil dari Code_2.gs
const PENGAJUAN_STATUSES = [
  'Baru', 
  'Disetujui', 
  'Ditolak', 
  'Diprint', 
  'Dikirim', 
  'Selesai', 
  'Menunggu Upload' // Alias dari DRAFT_STATUS
] as const

// ============================================================
// TABLE DEFINITION
// ============================================================

export const pengajuan = sqliteTable('pengajuan', {
  // Primary Key
  idPengajuan: text('id_pengajuan').primaryKey(),
  
  // Data Submit
  timestampSubmit: text('timestamp_submit'),
  nama: text('nama'),
  bagianCabang: text('bagian_cabang'),
  pemilik: text('pemilik'),
  alasanPengajuan: text('alasan_pengajuan'),
  tanggalForm: text('tanggal_form'),
  catatanTambahan: text('catatan_tambahan'),
  
  // Agregasi
  jumlahItem: integer('jumlah_item'),
  jumlahFileBukti: integer('jumlah_file_bukti'),
  
  // Status & Admin Tracking
  status: text('status'), 
  catatanAdmin: text('catatan_admin'),
  tanggalUpdateStatusTerakhir: text('tanggal_update_status_terakhir'),
  userUpdateStatus: text('user_update_status'),
  
  // Draft Data
  resumeToken: text('resume_token'),
  draftCreatedAt: text('draft_created_at'),
  draftUpdatedAt: text('draft_updated_at'),
  submittedAt: text('submitted_at'),

  // Metadata Standar Lokal (Mengikuti pola claim.ts)
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
}, (table) => [
  // Indeks untuk mempercepat query dashboard dan pencarian token
  index('pengajuan_status_idx').on(table.status),
  index('pengajuan_resume_token_idx').on(table.resumeToken),
  index('pengajuan_timestamp_idx').on(table.timestampSubmit)
])

// ============================================================
// ZOD SCHEMAS
// ============================================================

export const insertPengajuanSchema = createInsertSchema(pengajuan, {
  idPengajuan: z.string().min(1, 'ID Pengajuan is required').trim(),
  nama: z.string().optional(),
  bagianCabang: z.string().optional(),
  status: z.enum(PENGAJUAN_STATUSES).optional(),
  jumlahItem: z.number().int().min(0).optional(),
  jumlahFileBukti: z.number().int().min(0).optional(),
}).omit({
  createdAt: true,
  updatedAt: true
})

export const selectPengajuanSchema = createSelectSchema(pengajuan)

export const updatePengajuanSchema = insertPengajuanSchema.partial().omit({
  idPengajuan: true // ID Pengajuan tidak boleh diubah setelah dibuat
})

// ============================================================
// TYPE EXPORTS
// ============================================================

export type Pengajuan = typeof pengajuan.$inferSelect
export type InsertPengajuan = z.infer<typeof insertPengajuanSchema>
export type UpdatePengajuan = z.infer<typeof updatePengajuanSchema>