import { sql } from 'drizzle-orm'
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

export const printLayouts = sqliteTable('print_layouts', {
  id: text('id').primaryKey(),
  type: text('type'),
  name: text('name'),
  offsetX: real('offset_x'),
  offsetY: real('offset_y'),
  gapProductModel: real('gap_product_model'),
  gapModelSerial: real('gap_model_serial'),
  isBuiltin: text('is_builtin').default('FALSE'),
  createdAtGas: text('created_at'),
  updatedAtGas: text('updated_at'),
  updatedBy: text('updated_by'),

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
})

export const insertPrintLayoutsSchema = createInsertSchema(printLayouts, {
  id: z.string().min(1).trim(),
  type: z.enum(['local', 'import']),
  name: z.string().min(1).trim(),
}).omit({
  createdAt: true,
  updatedAt: true
})

export const selectPrintLayoutsSchema = createSelectSchema(printLayouts)
export const updatePrintLayoutsSchema = insertPrintLayoutsSchema.partial().omit({ id: true })

export type PrintLayout = typeof printLayouts.$inferSelect
export type InsertPrintLayout = z.infer<typeof insertPrintLayoutsSchema>
export type UpdatePrintLayout = z.infer<typeof updatePrintLayoutsSchema>