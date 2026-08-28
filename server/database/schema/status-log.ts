import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { pengajuan } from './pengajuan'

export const statusLog = sqliteTable('status_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dedupeKey: text('dedupe_key').notNull(),
  timestamp: text('timestamp'),
  idPengajuan: text('id_pengajuan')
    .notNull()
    .references(() => pengajuan.idPengajuan, { onDelete: 'cascade' }),
  statusLama: text('status_lama'),
  statusBaru: text('status_baru'),
  catatanAdmin: text('catatan_admin'),
  user: text('user'),
  noItem: text('no_item'),

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
}, (table) => [
  uniqueIndex('status_log_dedupe_key_idx').on(table.dedupeKey),
  index('status_log_id_pengajuan_idx').on(table.idPengajuan),
  index('status_log_timestamp_idx').on(table.timestamp),
])

export const insertStatusLogSchema = createInsertSchema(statusLog, {
  dedupeKey: z.string().min(1, 'Dedupe key is required').trim(),
  idPengajuan: z.string().min(1, 'ID Pengajuan is required').trim(),
  timestamp: z.string().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const selectStatusLogSchema = createSelectSchema(statusLog)
export const updateStatusLogSchema = createUpdateSchema(statusLog).omit({
  id: true,
  dedupeKey: true,
  idPengajuan: true,
  createdAt: true,
  updatedAt: true,
})

export type StatusLog = typeof statusLog.$inferSelect
export type InsertStatusLog = z.infer<typeof insertStatusLogSchema>
export type UpdateStatusLog = z.infer<typeof updateStatusLogSchema>