import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

export const user = sqliteTable('user', {
  username: text('username').primaryKey(),
  passwordPin: text('password_pin').notNull(),
  nama: text('nama').notNull(),
  role: text('role').notNull(),
  aktif: integer('aktif', { mode: 'boolean' }).notNull().default(true),
  lastLogin: text('last_login'),

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
}, (table) => [
  uniqueIndex('user_username_idx').on(table.username),
])

export const insertUserSchema = createInsertSchema(user, {
  username: z.string().min(1, 'Username is required').trim(),
  passwordPin: z.string().min(1, 'Password/PIN is required'),
  nama: z.string().min(1, 'Name is required').trim(),
  role: z.string().min(1, 'Role is required').trim(),
  aktif: z.boolean().optional(),
}).omit({
  createdAt: true,
  updatedAt: true,
})

export const selectUserSchema = createSelectSchema(user)
export const updateUserSchema = createUpdateSchema(user, {
  passwordPin: z.string().min(1, 'Password/PIN is required').optional(),
  nama: z.string().min(1, 'Name is required').trim().optional(),
  role: z.string().min(1, 'Role is required').trim().optional(),
  aktif: z.boolean().optional(),
}).omit({
  username: true,
  createdAt: true,
  updatedAt: true,
})

export type User = typeof user.$inferSelect
export type InsertUser = z.infer<typeof insertUserSchema>
export type UpdateUser = z.infer<typeof updateUserSchema>