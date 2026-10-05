import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

export const letterSequence = sqliteTable('letter_sequence', {
  letterKind: text('letter_kind').notNull(),
  sequencePeriod: text('sequence_period').notNull(),
  currentValue: integer('current_value').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
}, table => [
  primaryKey({
    name: 'letter_sequence_pk',
    columns: [table.letterKind, table.sequencePeriod],
  }),
  index('letter_sequence_kind_idx').on(table.letterKind),
])

export const insertLetterSequenceSchema = createInsertSchema(letterSequence, {
  letterKind: z.string().min(1).trim(),
  sequencePeriod: z.string().min(1).trim(),
  currentValue: z.number().int().min(0).optional(),
}).omit({
  updatedAt: true,
})

export const selectLetterSequenceSchema = createSelectSchema(letterSequence)
export const updateLetterSequenceSchema = createUpdateSchema(letterSequence, {
  currentValue: z.number().int().min(0),
}).omit({
  letterKind: true,
  sequencePeriod: true,
  updatedAt: true,
})

export type LetterSequence = typeof letterSequence.$inferSelect
export type InsertLetterSequence = z.infer<typeof insertLetterSequenceSchema>
export type UpdateLetterSequence = z.infer<typeof updateLetterSequenceSchema>
