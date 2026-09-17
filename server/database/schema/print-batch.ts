import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { BATCH_ITEM_STATUSES, BATCH_STATUSES } from './constants'
import { pengajuanItems } from './pengajuan-items'
import { printLayouts } from './print-layouts'
import { user } from './user'

export const printBatches = sqliteTable('print_batches', {
  id: text('id').primaryKey(),
  layoutId: text('layout_id').references(() => printLayouts.id, {
    onDelete: 'set null',
  }),
  actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
  status: text('status', { enum: BATCH_STATUSES }).notNull().default('queued'),
  note: text('note'),
  requestedAt: integer('requested_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
}, (table) => [
  index('print_batches_status_idx').on(table.status),
  index('print_batches_actor_id_idx').on(table.actorId),
  index('print_batches_requested_at_idx').on(table.requestedAt),
])

export const printBatchItems = sqliteTable('print_batch_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  batchId: text('batch_id')
    .notNull()
    .references(() => printBatches.id, { onDelete: 'cascade' }),
  itemId: integer('item_id')
    .notNull()
    .references(() => pengajuanItems.id, { onDelete: 'restrict' }),
  status: text('status', { enum: BATCH_ITEM_STATUSES }).notNull(),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  succeededAt: integer('succeeded_at', { mode: 'timestamp_ms' }),
}, (table) => [
  uniqueIndex('print_batch_items_batch_item_uidx').on(table.batchId, table.itemId),
  index('print_batch_items_batch_id_idx').on(table.batchId),
  index('print_batch_items_item_id_idx').on(table.itemId),
  index('print_batch_items_status_idx').on(table.status),
])

export const insertPrintBatchSchema = createInsertSchema(printBatches, {
  id: z.string().min(1, 'Print batch ID is required').trim(),
  layoutId: z.string().min(1).trim().optional().nullable(),
  actorId: z.string().min(1).trim().optional().nullable(),
  status: z.enum(BATCH_STATUSES).optional(),
}).omit({
  requestedAt: true,
  completedAt: true,
})

export const selectPrintBatchSchema = createSelectSchema(printBatches)
export const updatePrintBatchSchema = createUpdateSchema(printBatches, {
  status: z.enum(BATCH_STATUSES).optional(),
}).omit({
  id: true,
  requestedAt: true,
})

export const insertPrintBatchItemSchema = createInsertSchema(printBatchItems, {
  batchId: z.string().min(1).trim(),
  itemId: z.number().int().positive(),
  status: z.enum(BATCH_ITEM_STATUSES),
}).omit({
  id: true,
  createdAt: true,
  succeededAt: true,
})

export const selectPrintBatchItemSchema = createSelectSchema(printBatchItems)
export type PrintBatch = typeof printBatches.$inferSelect
export type PrintBatchItem = typeof printBatchItems.$inferSelect
export type InsertPrintBatch = typeof printBatches.$inferInsert
export type UpdatePrintBatch = z.infer<typeof updatePrintBatchSchema>
export type InsertPrintBatchItem = typeof printBatchItems.$inferInsert
