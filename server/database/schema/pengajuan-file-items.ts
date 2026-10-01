import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { pengajuanFiles } from './pengajuan-files'
import { pengajuanItems } from './pengajuan-items'

export const pengajuanFileItems = sqliteTable('pengajuan_file_items', {
  fileId: text('file_id')
    .notNull()
    .references(() => pengajuanFiles.id, { onDelete: 'cascade' }),
  itemId: integer('item_id')
    .notNull()
    .references(() => pengajuanItems.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
}, (table) => [
  uniqueIndex('pengajuan_file_items_file_item_uidx').on(table.fileId, table.itemId),
  index('pengajuan_file_items_file_id_idx').on(table.fileId),
  index('pengajuan_file_items_item_id_idx').on(table.itemId),
])

export const insertPengajuanFileItemsSchema = createInsertSchema(pengajuanFileItems, {
  fileId: z.string().min(1).trim(),
  itemId: z.number().int().positive(),
}).omit({
  createdAt: true,
})

export const selectPengajuanFileItemsSchema = createSelectSchema(pengajuanFileItems)

export type PengajuanFileItem = typeof pengajuanFileItems.$inferSelect
export type InsertPengajuanFileItem = z.infer<typeof insertPengajuanFileItemsSchema>
