import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { resolveArchiveFileDirectory, resolveArchivePublicBasePath } from '../../config/database'
import { db as defaultDb, type Database } from '../database'
import {
  archiveFiles,
  insertArchiveFilesSchema,
  insertPengajuanItemsSchema,
  insertPengajuanSchema,
  insertStatusLogSchema,
  pengajuan,
  pengajuanItems,
  statusLog,
  syncLog,
  syncMeta,
} from '../database/schema'
import { SYNC_MODES } from '../database/schema/constants'
import { gasArchivePayloadSchema, type GasArchivePayload } from '../schemas/gas-archive'

export type ArchiveSyncMode = (typeof SYNC_MODES)[number]

export type UpsertGasArchiveDetailOptions = {
  database?: Database
  mode?: ArchiveSyncMode
  source?: string
  runId?: string
  archiveDir?: string
  archivePublicBasePath?: string
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function ensureLeadingSlash(value: string) {
  return value.startsWith('/') ? value : `/${value}`
}

function normalizePublicBasePath(value: string) {
  const normalized = ensureLeadingSlash(value.trim() || '/arsip_file').replace(/\/+$|\\+$/g, '')
  return normalized || '/arsip_file'
}

export function ensureArchiveFileDirectory(archiveDir = resolveArchiveFileDirectory()) {
  const absoluteDir = resolve(archiveDir)
  mkdirSync(absoluteDir, { recursive: true })
  return absoluteDir
}

export function resolveArchiveLocalPath(
  publicPath: string,
  options: {
    archiveDir?: string
    archivePublicBasePath?: string
  } = {},
) {
  const archiveDir = ensureArchiveFileDirectory(options.archiveDir)
  const publicBase = normalizePublicBasePath(options.archivePublicBasePath || resolveArchivePublicBasePath())
  const normalizedPublicPath = ensureLeadingSlash(publicPath.replace(/\\/g, '/'))

  if (normalizedPublicPath !== publicBase && !normalizedPublicPath.startsWith(`${publicBase}/`)) {
    throw new Error(`Archive public path must start with ${publicBase}: ${publicPath}`)
  }

  const relativeFilePath = normalizedPublicPath.slice(publicBase.length).replace(/^\/+/, '')
  const targetPath = resolve(archiveDir, relativeFilePath)
  const relativeTarget = relative(archiveDir, targetPath)

  if (relativeTarget.startsWith('..') || resolve(relativeTarget) === relativeTarget) {
    throw new Error(`Archive file path escapes archive directory: ${publicPath}`)
  }

  return targetPath
}

function withLocalFilePaths(payload: GasArchivePayload, options: UpsertGasArchiveDetailOptions) {
  return {
    ...payload,
    archiveFiles: payload.archiveFiles.map((file) => ({
      ...file,
      localPath: resolveArchiveLocalPath(file.publicPath, {
        archiveDir: options.archiveDir,
        archivePublicBasePath: options.archivePublicBasePath,
      }),
    })),
  }
}

function validateLocalArchivePayload(payload: GasArchivePayload) {
  insertPengajuanSchema.parse(payload.pengajuan)
  payload.items.forEach((item) => insertPengajuanItemsSchema.parse(item))
  payload.statusLogs.forEach((log) => insertStatusLogSchema.parse(log))
  payload.archiveFiles.forEach((file) => insertArchiveFilesSchema.parse(file))
}

function buildPengajuanConflictSet(row: GasArchivePayload['pengajuan']) {
  const { idPengajuan: _idPengajuan, ...set } = row
  return set
}

function buildItemConflictSet(row: GasArchivePayload['items'][number]) {
  const { idPengajuan: _idPengajuan, noItem: _noItem, ...set } = row
  return set
}

function buildArchiveFileConflictSet(row: GasArchivePayload['archiveFiles'][number]) {
  const {
    id: _id,
    status: _status,
    downloadedAt: _downloadedAt,
    driveTrashedAt: _driveTrashedAt,
    error: _error,
    sourceDriveFileId: _sourceDriveFileId,
    sha256: _sha256,
    sizeBytes: _sizeBytes,
    mimeType: _mimeType,
    ...set
  } = row

  return set
}

async function writeSyncMeta(executor: Pick<Database, 'insert'>, key: string, value: string) {
  await executor
    .insert(syncMeta)
    .values({ key, value })
    .onConflictDoUpdate({
      target: syncMeta.key,
      set: { value },
    })
}

export async function upsertGasArchiveDetail(input: unknown, options: UpsertGasArchiveDetailOptions = {}) {
  const database = options.database || defaultDb
  const parsedPayload = gasArchivePayloadSchema.parse(input)
  const payload = withLocalFilePaths(parsedPayload, options)
  validateLocalArchivePayload(payload)

  const idPengajuan = payload.pengajuan.idPengajuan
  const mode = options.mode || 'detail'
  const source = options.source || 'gas:detail'
  const runId = options.runId || randomUUID()
  const startedAt = new Date().toISOString()

  await database.insert(syncLog).values({
    runId,
    mode,
    source,
    status: 'running',
    idPengajuan,
    startedAt,
    rowsFetched: 1,
    rowsChanged: 0,
  })

  try {
    const result = await database.transaction(async (tx) => {
      await tx
        .insert(pengajuan)
        .values(payload.pengajuan)
        .onConflictDoUpdate({
          target: pengajuan.idPengajuan,
          set: buildPengajuanConflictSet(payload.pengajuan),
        })

      for (const item of payload.items) {
        await tx
          .insert(pengajuanItems)
          .values(item)
          .onConflictDoUpdate({
            target: [pengajuanItems.idPengajuan, pengajuanItems.noItem],
            set: buildItemConflictSet(item),
          })
      }

      for (const file of payload.archiveFiles) {
        await tx
          .insert(archiveFiles)
          .values(file)
          .onConflictDoUpdate({
            target: archiveFiles.id,
            set: buildArchiveFileConflictSet(file),
          })
      }

      for (const log of payload.statusLogs) {
        await tx
          .insert(statusLog)
          .values(log)
          .onConflictDoNothing({ target: statusLog.dedupeKey })
      }

      const syncedAt = new Date().toISOString()
      await writeSyncMeta(tx, 'last_archive_detail_sync_at', syncedAt)
      await writeSyncMeta(tx, `pengajuan:${idPengajuan}:last_sync_at`, syncedAt)

      return {
        idPengajuan,
        rowsChanged: 1 + payload.items.length + payload.archiveFiles.length + payload.statusLogs.length,
        items: payload.items.length,
        archiveFiles: payload.archiveFiles.length,
        statusLogs: payload.statusLogs.length,
      }
    })

    await database
      .update(syncLog)
      .set({
        status: 'success',
        finishedAt: new Date().toISOString(),
        rowsChanged: result.rowsChanged,
        metaJson: JSON.stringify(result),
      })
      .where(eq(syncLog.runId, runId))

    return {
      success: true,
      runId,
      ...result,
    }
  } catch (error) {
    await database
      .update(syncLog)
      .set({
        status: 'failed',
        finishedAt: new Date().toISOString(),
        error: getErrorMessage(error),
      })
      .where(eq(syncLog.runId, runId))

    throw error
  }
}