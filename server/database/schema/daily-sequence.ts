import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

export const dailySequence = sqliteTable('daily_sequence', {
  sequenceDate: text('sequence_date').primaryKey(),
  currentValue: integer('current_value').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
})

export const insertDailySequenceSchema = createInsertSchema(dailySequence, {
  sequenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currentValue: z.number().int().min(0).optional(),
}).omit({
  updatedAt: true,
})

export const selectDailySequenceSchema = createSelectSchema(dailySequence)
export const updateDailySequenceSchema = createUpdateSchema(dailySequence, {
  currentValue: z.number().int().min(0),
}).omit({
  sequenceDate: true,
  updatedAt: true,
})

export type DailySequence = typeof dailySequence.$inferSelect
export type InsertDailySequence = z.infer<typeof insertDailySequenceSchema>
export type UpdateDailySequence = z.infer<typeof updateDailySequenceSchema>
