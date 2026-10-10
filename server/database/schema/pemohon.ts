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

export const pemohon = sqliteTable('pemohon', {
  id: text('id').primaryKey(),
  nama: text('nama').notNull(),
  bagian: text('bagian').notNull(),
  cabang: text('cabang').notNull(),
  email: text('email'),
  nomorHp: text('nomor_hp'),
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
  uniqueIndex('pemohon_identity_uidx').on(table.nama, table.bagian, table.cabang),
  index('pemohon_nama_idx').on(table.nama),
  index('pemohon_bagian_idx').on(table.bagian),
  index('pemohon_cabang_idx').on(table.cabang),
])

export const insertPemohonSchema = createInsertSchema(pemohon, {
  id: z.string().min(1, 'Pemohon ID is required').trim(),
  nama: z.string().min(1, 'Nama is required').trim(),
  bagian: z.string().min(1, 'Bagian is required').trim(),
  cabang: z.string().min(1, 'Cabang is required').trim(),
  email: z.email('Email is invalid').trim().optional().nullable(),
  nomorHp: z.string().min(1, 'Nomor HP is required').trim().optional().nullable(),
}).omit({
  createdAt: true,
  updatedAt: true,
})

export const selectPemohonSchema = createSelectSchema(pemohon)
export const updatePemohonSchema = createUpdateSchema(pemohon, {
  nama: z.string().min(1).trim().optional(),
  bagian: z.string().min(1).trim().optional(),
  cabang: z.string().min(1).trim().optional(),
  email: z.email('Email is invalid').trim().optional().nullable(),
  nomorHp: z.string().min(1).trim().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type Pemohon = typeof pemohon.$inferSelect
export type InsertPemohon = z.infer<typeof insertPemohonSchema>
export type UpdatePemohon = z.infer<typeof updatePemohonSchema>
