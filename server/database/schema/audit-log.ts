import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { user } from './user'

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  metadataJson: text('metadata_json'),

  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
}, (table) => [
  index('audit_log_actor_id_idx').on(table.actorId),
  index('audit_log_action_idx').on(table.action),
  index('audit_log_entity_idx').on(table.entityType, table.entityId),
  index('audit_log_created_at_idx').on(table.createdAt),
])

export const insertAuditLogSchema = createInsertSchema(auditLog, {
  actorId: z.string().min(1).trim().optional().nullable(),
  action: z.string().min(1).trim(),
  entityType: z.string().min(1).trim(),
  entityId: z.string().min(1).trim(),
  metadataJson: z.string().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
})

export const selectAuditLogSchema = createSelectSchema(auditLog)
export type AuditLog = typeof auditLog.$inferSelect
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>
