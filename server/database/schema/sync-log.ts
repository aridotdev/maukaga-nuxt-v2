import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { SYNC_MODES, SYNC_STATUSES } from './constants'

export const syncLog = sqliteTable('sync_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: text('run_id').notNull(),
  mode: text('mode', { enum: SYNC_MODES }).notNull(),
  source: text('source').notNull(),
  status: text('status', { enum: SYNC_STATUSES }).notNull(),
  idPengajuan: text('id_pengajuan'),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  rowsFetched: integer('rows_fetched').notNull().default(0),
  rowsChanged: integer('rows_changed').notNull().default(0),
  message: text('message'),
  error: text('error'),
  metaJson: text('meta_json'),

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
}, (table) => [
  index('sync_log_run_id_idx').on(table.runId),
  index('sync_log_status_idx').on(table.status),
  index('sync_log_started_at_idx').on(table.startedAt),
  index('sync_log_id_pengajuan_idx').on(table.idPengajuan),
])

export const insertSyncLogSchema = createInsertSchema(syncLog, {
  runId: z.string().min(1).trim(),
  mode: z.enum(SYNC_MODES),
  source: z.string().min(1).trim(),
  status: z.enum(SYNC_STATUSES),
  startedAt: z.string().min(1).trim(),
  rowsFetched: z.number().int().min(0).optional(),
  rowsChanged: z.number().int().min(0).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const selectSyncLogSchema = createSelectSchema(syncLog)
export const updateSyncLogSchema = createUpdateSchema(syncLog).omit({
  id: true,
  runId: true,
  createdAt: true,
  updatedAt: true,
})

export type SyncLog = typeof syncLog.$inferSelect
export type InsertSyncLog = z.infer<typeof insertSyncLogSchema>
export type UpdateSyncLog = z.infer<typeof updateSyncLogSchema>
