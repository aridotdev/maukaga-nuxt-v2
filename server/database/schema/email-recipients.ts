import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

export const emailRecipients = sqliteTable('email_recipients', {
  email: text('email').primaryKey(),
  nama: text('nama'),
  aktif: integer('aktif', { mode: 'boolean' }).notNull().default(true),
  keterangan: text('keterangan'),

  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
})

export const insertEmailRecipientsSchema = createInsertSchema(emailRecipients, {
  email: z.string().trim().pipe(z.email('Invalid email address')),
  aktif: z.boolean().optional(),
}).omit({
  createdAt: true,
  updatedAt: true,
})

export const selectEmailRecipientsSchema = createSelectSchema(emailRecipients)
export type EmailRecipient = typeof emailRecipients.$inferSelect
export type InsertEmailRecipient = z.infer<typeof insertEmailRecipientsSchema>
