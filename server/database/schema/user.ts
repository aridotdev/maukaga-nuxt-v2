import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const timestamp = (name: string) =>
  integer(name, { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)

const nullableTimestamp = (name: string) => integer(name, { mode: 'timestamp_ms' })

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  role: text('role').notNull().default('admin'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  image: text('image'),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at').$onUpdateFn(() => new Date()),
}, (table) => [
  uniqueIndex('user_email_uidx').on(table.email),
])

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at').$onUpdateFn(() => new Date()),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('session_token_uidx').on(table.token),
  index('session_user_id_idx').on(table.userId),
])

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  issuer: text('issuer').notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: nullableTimestamp('access_token_expires_at'),
  refreshTokenExpiresAt: nullableTimestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at').$onUpdateFn(() => new Date()),
}, (table) => [
  uniqueIndex('account_issuer_account_id_uidx').on(table.issuer, table.accountId),
  index('account_user_id_idx').on(table.userId),
])

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at').$onUpdateFn(() => new Date()),
}, (table) => [
  index('verification_identifier_idx').on(table.identifier),
])

export type User = typeof user.$inferSelect
export type Session = typeof session.$inferSelect
export type Account = typeof account.$inferSelect
export type Verification = typeof verification.$inferSelect
