import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

export const emailLog = sqliteTable('email_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subject: text('subject').notNull(),
  recipientsJson: text('recipients_json').notNull(),
  pengajuanCount: integer('pengajuan_count').notNull().default(0),
  status: text('status').notNull(),
  sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
  error: text('error'),

  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
})

export const insertEmailLogSchema = createInsertSchema(emailLog, {
  subject: z.string().min(1).trim(),
  recipientsJson: z.string().min(1),
  pengajuanCount: z.number().int().min(0).optional(),
  status: z.string().min(1).trim(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const selectEmailLogSchema = createSelectSchema(emailLog)
export type EmailLog = typeof emailLog.$inferSelect
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>
