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

export const pemilikBarang = sqliteTable('pemilik_barang', {
  id: text('id').primaryKey(),
  nama: text('nama').notNull(),
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
  uniqueIndex('pemilik_barang_nama_uidx').on(table.nama),
  index('pemilik_barang_nama_idx').on(table.nama),
])

export const insertPemilikBarangSchema = createInsertSchema(pemilikBarang, {
  id: z.string().min(1, 'Pemilik barang ID is required').trim(),
  nama: z.string().min(1, 'Nama is required').trim(),
}).omit({
  createdAt: true,
  updatedAt: true,
})

export const selectPemilikBarangSchema = createSelectSchema(pemilikBarang)
export const updatePemilikBarangSchema = createUpdateSchema(pemilikBarang, {
  nama: z.string().min(1).trim().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type PemilikBarang = typeof pemilikBarang.$inferSelect
export type InsertPemilikBarang = z.infer<typeof insertPemilikBarangSchema>
export type UpdatePemilikBarang = z.infer<typeof updatePemilikBarangSchema>
