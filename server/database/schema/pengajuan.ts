import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { PENGAJUAN_STATUSES } from './constants'

export const pengajuan = sqliteTable('pengajuan', {
  idPengajuan: text('id_pengajuan').primaryKey(),

  timestampSubmit: text('timestamp_submit'),
  nama: text('nama'),
  bagianCabang: text('bagian_cabang'),
  pemilik: text('pemilik'),
  alasanPengajuan: text('alasan_pengajuan'),
  tanggalForm: text('tanggal_form'),
  catatanTambahan: text('catatan_tambahan'),

  jumlahItem: integer('jumlah_item'),
  jumlahFileBukti: integer('jumlah_file_bukti'),

  status: text('status', { enum: PENGAJUAN_STATUSES }),
  catatanAdmin: text('catatan_admin'),
  tanggalUpdateStatusTerakhir: text('tanggal_update_status_terakhir'),
  userUpdateStatus: text('user_update_status'),

  resumeToken: text('resume_token'),
  draftCreatedAt: text('draft_created_at'),
  draftUpdatedAt: text('draft_updated_at'),
  submittedAt: text('submitted_at'),

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
}, (table) => [
  index('pengajuan_status_idx').on(table.status),
  index('pengajuan_resume_token_idx').on(table.resumeToken),
  index('pengajuan_timestamp_idx').on(table.timestampSubmit),
])

export const insertPengajuanSchema = createInsertSchema(pengajuan, {
  idPengajuan: z.string().min(1, 'ID Pengajuan is required').trim(),
  nama: z.string().optional().nullable(),
  bagianCabang: z.string().optional().nullable(),
  status: z.enum(PENGAJUAN_STATUSES).optional().nullable(),
  jumlahItem: z.number().int().min(0).optional().nullable(),
  jumlahFileBukti: z.number().int().min(0).optional().nullable(),
}).omit({
  createdAt: true,
  updatedAt: true,
})

export const selectPengajuanSchema = createSelectSchema(pengajuan)
export const updatePengajuanSchema = createUpdateSchema(pengajuan, {
  nama: z.string().optional().nullable(),
  bagianCabang: z.string().optional().nullable(),
  status: z.enum(PENGAJUAN_STATUSES).optional().nullable(),
  jumlahItem: z.number().int().min(0).optional().nullable(),
  jumlahFileBukti: z.number().int().min(0).optional().nullable(),
}).omit({
  idPengajuan: true,
  createdAt: true,
  updatedAt: true,
})

export type Pengajuan = typeof pengajuan.$inferSelect
export type InsertPengajuan = z.infer<typeof insertPengajuanSchema>
export type UpdatePengajuan = z.infer<typeof updatePengajuanSchema>