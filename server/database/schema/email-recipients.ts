import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

export const emailRecipients = sqliteTable('email_recipients', {
  email: text('email').primaryKey(),
  nama: text('nama'),
  aktif: text('aktif').default('yes'),
  keterangan: text('keterangan'),

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
})

export const insertEmailRecipientsSchema = createInsertSchema(emailRecipients, {
  email: z.string().email('Invalid email address').min(1),
  aktif: z.enum(['yes', 'no']).optional(),
}).omit({
  createdAt: true,
  updatedAt: true
})

export const selectEmailRecipientsSchema = createSelectSchema(emailRecipients)
export const updateEmailRecipientsSchema = insertEmailRecipientsSchema.partial().omit({ email: true })

export type EmailRecipient = typeof emailRecipients.$inferSelect
export type InsertEmailRecipient = z.infer<typeof insertEmailRecipientsSchema>
export type UpdateEmailRecipient = z.infer<typeof updateEmailRecipientsSchema>