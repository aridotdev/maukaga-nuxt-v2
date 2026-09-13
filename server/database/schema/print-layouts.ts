import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { PRINT_LAYOUT_TYPES } from './constants'

export const printLayouts = sqliteTable('print_layouts', {
  id: text('id').primaryKey(),
  type: text('type', { enum: PRINT_LAYOUT_TYPES }).notNull(),
  name: text('name').notNull(),
  offsetX: real('offset_x').notNull().default(0),
  offsetY: real('offset_y').notNull().default(0),
  gapProductModel: real('gap_product_model').notNull().default(0),
  gapModelSerial: real('gap_model_serial').notNull().default(0),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
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
  index('print_layouts_type_idx').on(table.type),
  index('print_layouts_builtin_idx').on(table.isBuiltin),
])

export const insertPrintLayoutsSchema = createInsertSchema(printLayouts, {
  id: z.string().min(1).trim(),
  type: z.enum(PRINT_LAYOUT_TYPES),
  name: z.string().min(1).trim(),
}).omit({
  createdAt: true,
  updatedAt: true,
})

export const selectPrintLayoutsSchema = createSelectSchema(printLayouts)
export const updatePrintLayoutsSchema = createUpdateSchema(printLayouts, {
  type: z.enum(PRINT_LAYOUT_TYPES).optional(),
  name: z.string().min(1).trim().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type PrintLayout = typeof printLayouts.$inferSelect
export type InsertPrintLayout = z.infer<typeof insertPrintLayoutsSchema>
export type UpdatePrintLayout = z.infer<typeof updatePrintLayoutsSchema>
