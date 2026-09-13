import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-orm/zod'
import { z } from 'zod'
import { PENGAJUAN_STATUSES } from './constants'

export const pengajuan = sqliteTable('pengajuan', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  idPengajuan: text('id_pengajuan').notNull(),

  nama: text('nama').notNull(),
  bagianCabang: text('bagian_cabang').notNull(),
  pemilik: text('pemilik').notNull(),
  alasanPengajuan: text('alasan_pengajuan').notNull(),
  tanggalForm: text('tanggal_form').notNull(),
  catatanTambahan: text('catatan_tambahan'),

  status: text('status', { enum: PENGAJUAN_STATUSES }).notNull().default('Baru'),
  catatanAdmin: text('catatan_admin'),

  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
  deletedBy: text('deleted_by'),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  deletedReason: text('deleted_reason'),
  submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }),

  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
}, (table) => [
  uniqueIndex('pengajuan_id_pengajuan_uidx').on(table.idPengajuan),
  index('pengajuan_status_idx').on(table.status),
  index('pengajuan_tanggal_form_idx').on(table.tanggalForm),
  index('pengajuan_bagian_cabang_idx').on(table.bagianCabang),
  index('pengajuan_deleted_at_idx').on(table.deletedAt),
])

export const insertPengajuanSchema = createInsertSchema(pengajuan, {
  idPengajuan: z.string().min(1, 'ID Pengajuan is required').trim(),
  nama: z.string().min(1, 'Nama is required').trim(),
  bagianCabang: z.string().min(1, 'Bagian/cabang is required').trim(),
  pemilik: z.string().min(1, 'Pemilik is required').trim(),
  alasanPengajuan: z.string().min(1, 'Alasan pengajuan is required').trim(),
  tanggalForm: z.string().min(1, 'Tanggal form is required').trim(),
  status: z.enum(PENGAJUAN_STATUSES).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const selectPengajuanSchema = createSelectSchema(pengajuan)
export const updatePengajuanSchema = createUpdateSchema(pengajuan, {
  nama: z.string().min(1).trim().optional(),
  bagianCabang: z.string().min(1).trim().optional(),
  pemilik: z.string().min(1).trim().optional(),
  alasanPengajuan: z.string().min(1).trim().optional(),
  tanggalForm: z.string().min(1).trim().optional(),
  status: z.enum(PENGAJUAN_STATUSES).optional(),
}).omit({
  id: true,
  idPengajuan: true,
  createdAt: true,
  updatedAt: true,
})

export type Pengajuan = typeof pengajuan.$inferSelect
export type InsertPengajuan = z.infer<typeof insertPengajuanSchema>
export type UpdatePengajuan = z.infer<typeof updatePengajuanSchema>
