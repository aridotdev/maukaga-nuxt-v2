import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

export const printBatch = sqliteTable('print_batch', {
  batchId: text('batch_id').primaryKey(),
  tipeBatch: text('tipe_batch'),
  createdAtGas: text('created_at'),
  createdBy: text('created_by'),
  jumlahItem: integer('jumlah_item'),
  catatan: text('catatan'),

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
})

export const insertPrintBatchSchema = createInsertSchema(printBatch, {
  batchId: z.string().min(1, 'Batch ID is required').trim(),
}).omit({
  createdAt: true,
  updatedAt: true
})

export const selectPrintBatchSchema = createSelectSchema(printBatch)
export const updatePrintBatchSchema = insertPrintBatchSchema.partial().omit({ batchId: true })

export type PrintBatch = typeof printBatch.$inferSelect
export type InsertPrintBatch = z.infer<typeof insertPrintBatchSchema>
export type UpdatePrintBatch = z.infer<typeof updatePrintBatchSchema>