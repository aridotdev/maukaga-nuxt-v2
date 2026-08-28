import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { pengajuan } from './pengajuan'
import { ARCHIVE_FILE_KINDS, ARCHIVE_FILE_STATUSES } from './constants'

export const archiveFiles = sqliteTable('archive_files', {
  id: text('id').primaryKey(),
  idPengajuan: text('id_pengajuan')
    .notNull()
    .references(() => pengajuan.idPengajuan, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ARCHIVE_FILE_KINDS }).notNull(),
  sequence: integer('sequence').notNull().default(0),
  fileName: text('file_name').notNull(),
  publicPath: text('public_path').notNull(),
  localPath: text('local_path'),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  sha256: text('sha256'),
  sourceDriveFileId: text('source_drive_file_id'),
  status: text('status', { enum: ARCHIVE_FILE_STATUSES }).notNull().default('pending'),
  downloadedAt: text('downloaded_at'),
  driveTrashedAt: text('drive_trashed_at'),
  error: text('error'),

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
}, (table) => [
  index('archive_files_id_pengajuan_idx').on(table.idPengajuan),
  index('archive_files_status_idx').on(table.status),
  index('archive_files_public_path_idx').on(table.publicPath),
])

export const insertArchiveFilesSchema = createInsertSchema(archiveFiles, {
  id: z.string().min(1).trim(),
  idPengajuan: z.string().min(1).trim(),
  kind: z.enum(ARCHIVE_FILE_KINDS),
  sequence: z.number().int().min(0),
  fileName: z.string().min(1).trim(),
  publicPath: z.string().min(1).trim(),
  status: z.enum(ARCHIVE_FILE_STATUSES).optional(),
}).omit({
  createdAt: true,
  updatedAt: true,
})

export const selectArchiveFilesSchema = createSelectSchema(archiveFiles)
export const updateArchiveFilesSchema = createUpdateSchema(archiveFiles).omit({
  id: true,
  idPengajuan: true,
  kind: true,
  sequence: true,
  createdAt: true,
  updatedAt: true,
})

export type ArchiveFile = typeof archiveFiles.$inferSelect
export type InsertArchiveFile = z.infer<typeof insertArchiveFilesSchema>
export type UpdateArchiveFile = z.infer<typeof updateArchiveFilesSchema>
