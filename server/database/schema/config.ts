import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value'),

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
})

export const insertConfigSchema = createInsertSchema(config, {
  key: z.string().min(1, 'Key is required').trim(),
}).omit({
  createdAt: true,
  updatedAt: true
})

export const selectConfigSchema = createSelectSchema(config)
export const updateConfigSchema = insertConfigSchema.partial().omit({ key: true })

export type Config = typeof config.$inferSelect
export type InsertConfig = z.infer<typeof insertConfigSchema>
export type UpdateConfig = z.infer<typeof updateConfigSchema>