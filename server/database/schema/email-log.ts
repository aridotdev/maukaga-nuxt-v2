import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import type { z } from 'zod'

export const emailLog = sqliteTable('email_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp'),
  subject: text('subject'),
  recipients: text('recipients'),
  jumlahPengajuan: integer('jumlah_pengajuan'),
  status: text('status'),

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
})

export const insertEmailLogSchema = createInsertSchema(emailLog).omit({
  id: true,
  createdAt: true,
  updatedAt: true
})

export const selectEmailLogSchema = createSelectSchema(emailLog)
export const updateEmailLogSchema = insertEmailLogSchema.partial()

export type EmailLog = typeof emailLog.$inferSelect
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>
export type UpdateEmailLog = z.infer<typeof updateEmailLogSchema>