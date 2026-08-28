import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
})

export const insertSyncMetaSchema = createInsertSchema(syncMeta, {
  key: z.string().min(1).trim(),
  value: z.string(),
}).omit({
  updatedAt: true,
})

export const selectSyncMetaSchema = createSelectSchema(syncMeta)
export const updateSyncMetaSchema = createUpdateSchema(syncMeta).omit({
  key: true,
  updatedAt: true,
})

export type SyncMeta = typeof syncMeta.$inferSelect
export type InsertSyncMeta = z.infer<typeof insertSyncMetaSchema>
export type UpdateSyncMeta = z.infer<typeof updateSyncMetaSchema>
