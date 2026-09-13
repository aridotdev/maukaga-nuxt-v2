import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { pengajuanItems } from './pengajuan-items'
import { pengajuan } from './pengajuan'
import { user } from './user'
import { STATUS_LOG_SCOPES } from './constants'

export const statusLog = sqliteTable('status_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pengajuanId: integer('pengajuan_id')
    .notNull()
    .references(() => pengajuan.id, { onDelete: 'cascade' }),
  itemId: integer('item_id').references(() => pengajuanItems.id, {
    onDelete: 'cascade',
  }),
  scope: text('scope', { enum: STATUS_LOG_SCOPES }).notNull(),
  statusLama: text('status_lama'),
  statusBaru: text('status_baru').notNull(),
  catatan: text('catatan'),
  actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
  dedupeKey: text('dedupe_key'),

  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
}, (table) => [
  uniqueIndex('status_log_dedupe_key_uidx').on(table.dedupeKey),
  index('status_log_pengajuan_id_idx').on(table.pengajuanId),
  index('status_log_item_id_idx').on(table.itemId),
  index('status_log_scope_idx').on(table.scope),
  index('status_log_created_at_idx').on(table.createdAt),
])

export const insertStatusLogSchema = createInsertSchema(statusLog, {
  pengajuanId: z.number().int().positive(),
  itemId: z.number().int().positive().optional().nullable(),
  scope: z.enum(STATUS_LOG_SCOPES),
  statusLama: z.string().min(1).trim().optional().nullable(),
  statusBaru: z.string().min(1).trim(),
  catatan: z.string().trim().optional().nullable(),
  actorId: z.string().min(1).trim().optional().nullable(),
  dedupeKey: z.string().min(1).trim().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
})

export const selectStatusLogSchema = createSelectSchema(statusLog)
export const updateStatusLogSchema = createUpdateSchema(statusLog).omit({
  id: true,
  pengajuanId: true,
  itemId: true,
  scope: true,
  dedupeKey: true,
  createdAt: true,
})

export type StatusLog = typeof statusLog.$inferSelect
export type InsertStatusLog = z.infer<typeof insertStatusLogSchema>
export type UpdateStatusLog = z.infer<typeof updateStatusLogSchema>
