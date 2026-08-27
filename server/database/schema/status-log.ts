import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { pengajuan } from './pengajuan'

// ============================================================
// TABLE DEFINITION
// ============================================================

export const statusLog = sqliteTable('status_log', {
  // Auto-increment ID untuk log tabular
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Waktu spesifik terjadinya perubahan status dari GAS
  timestamp: text('timestamp'),
  
  // Foreign Key ke tabel pengajuan
  idPengajuan: text('id_pengajuan')
    .notNull()
    .references(() => pengajuan.idPengajuan, { onDelete: 'cascade' }),
  
  statusLama: text('status_lama'),
  statusBaru: text('status_baru'),
  catatanAdmin: text('catatan_admin'),
  user: text('user'),
  
  // Berupa teks karena dari GAS terkadang string kosong jika perubahan status global (bukan per item)
  noItem: text('no_item'),

  // Metadata Standar Lokal
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
}, (table) => [
  // Indeks untuk mempercepat pencarian riwayat berdasarkan ID Pengajuan
  index('status_log_id_pengajuan_idx').on(table.idPengajuan),
  // Indeks untuk pengurutan log dari yang terbaru
  index('status_log_timestamp_idx').on(table.timestamp)
])

// ============================================================
// ZOD SCHEMAS
// ============================================================

export const insertStatusLogSchema = createInsertSchema(statusLog, {
  idPengajuan: z.string().min(1, 'ID Pengajuan is required').trim(),
  timestamp: z.string().min(1, 'Timestamp is required'),
}).omit({
  id: true, // ID di-generate otomatis oleh database
  createdAt: true,
  updatedAt: true
})

export const selectStatusLogSchema = createSelectSchema(statusLog)

export const updateStatusLogSchema = insertStatusLogSchema.partial()

// ============================================================
// TYPE EXPORTS
// ============================================================

export type StatusLog = typeof statusLog.$inferSelect
export type InsertStatusLog = z.infer<typeof insertStatusLogSchema>
export type UpdateStatusLog = z.infer<typeof updateStatusLogSchema>