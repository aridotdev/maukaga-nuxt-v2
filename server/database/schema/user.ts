import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import { z } from 'zod'

// ============================================================
// TABLE DEFINITION
// ============================================================

export const user = sqliteTable('user', {
  username: text('username').primaryKey(),
  passwordPin: text('password_pin').notNull(),
  nama: text('nama').notNull(),
  role: text('role').notNull(),
  aktif: integer('aktif', { mode: 'boolean' }).notNull().default(true), // Menyimpan 1 atau 0
  lastLogin: text('last_login'),

  // Mengikuti pola timestamp dari claim.ts
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
}, (table) => [
  uniqueIndex('user_username_idx').on(table.username)
])

// ============================================================
// ZOD SCHEMAS
// ============================================================

export const insertUserSchema = createInsertSchema(user, {
  username: z.string().min(1, 'Username is required').trim(),
  passwordPin: z.string().min(1, 'Password/PIN is required'),
  nama: z.string().min(1, 'Name is required').trim(),
  role: z.enum(['admin', 'management', 'qrcc', 'user']), // Anda bisa sesuaikan daftar role ini
  aktif: z.enum(['yes', 'no']),
}).omit({
  createdAt: true,
  updatedAt: true
})

export const selectUserSchema = createSelectSchema(user)

export const updateUserSchema = insertUserSchema.partial().omit({
  username: true // Biasanya username tidak bisa diubah
})

// ============================================================
// TYPE EXPORTS
// ============================================================

export type User = typeof user.$inferSelect
export type InsertUser = z.infer<typeof insertUserSchema>
export type UpdateUser = z.infer<typeof updateUserSchema>