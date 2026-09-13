import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { PENGAJUAN_FILE_KINDS } from './constants'
import { pengajuan } from './pengajuan'

export const pengajuanFiles = sqliteTable('pengajuan_files', {
  id: text('id').primaryKey(),
  pengajuanId: integer('pengajuan_id')
    .notNull()
    .references(() => pengajuan.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: PENGAJUAN_FILE_KINDS }).notNull(),
  sequence: integer('sequence').notNull().default(0),
  originalName: text('original_name').notNull(),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256: text('sha256').notNull(),
  uploadedBy: text('uploaded_by'),

  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
}, (table) => [
  uniqueIndex('pengajuan_files_pengajuan_kind_sequence_uidx').on(
    table.pengajuanId,
    table.kind,
    table.sequence,
  ),
  uniqueIndex('pengajuan_files_storage_key_uidx').on(table.storageKey),
  index('pengajuan_files_pengajuan_id_idx').on(table.pengajuanId),
  index('pengajuan_files_kind_idx').on(table.kind),
  index('pengajuan_files_sha256_idx').on(table.sha256),
])

export const insertPengajuanFilesSchema = createInsertSchema(pengajuanFiles, {
  id: z.string().min(1).trim(),
  pengajuanId: z.number().int().positive(),
  kind: z.enum(PENGAJUAN_FILE_KINDS),
  sequence: z.number().int().min(0).optional(),
  originalName: z.string().min(1).trim(),
  storageKey: z.string().min(1).trim(),
  mimeType: z.string().min(1).trim(),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().length(64).trim(),
}).omit({
  createdAt: true,
  updatedAt: true,
})

export const selectPengajuanFilesSchema = createSelectSchema(pengajuanFiles)
export const updatePengajuanFilesSchema = createUpdateSchema(pengajuanFiles, {
  originalName: z.string().min(1).trim().optional(),
  mimeType: z.string().min(1).trim().optional(),
  sizeBytes: z.number().int().positive().optional(),
  sha256: z.string().length(64).trim().optional(),
}).omit({
  id: true,
  pengajuanId: true,
  kind: true,
  sequence: true,
  createdAt: true,
  updatedAt: true,
})

export type PengajuanFile = typeof pengajuanFiles.$inferSelect
export type InsertPengajuanFile = z.infer<typeof insertPengajuanFilesSchema>
export type UpdatePengajuanFile = z.infer<typeof updatePengajuanFilesSchema>
