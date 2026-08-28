import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db as defaultDb, type Database } from '../database'
import { archiveFiles, syncLog, syncMeta } from '../database/schema'
import { SYNC_MODES } from '../database/schema/constants'
import { resolveArchiveLocalPath, upsertGasArchiveDetail } from './local-archive'

type ArchiveSyncRuntimeConfig = {
  appsScriptApiUrl?: string
  archiveFileDirectory?: string
  public?: {
    archiveFileBasePath?: string
  }
}

type AppsScriptResult<T> = {
  success: boolean
  data?: T
  error?: string
}

const archiveSyncRequestSchema = z.object({
  token: z.preprocess(toText, z.string().min(1)),
  mode: z.enum(SYNC_MODES).default('full'),
  idPengajuan: z.preprocess(toOptionalText, z.string().min(1).optional()),
  limit: z.preprocess(toOptionalPositiveInteger, z.number().int().positive().max(1000).optional()),
  finalize: z.preprocess(toBoolean, z.boolean().default(true)),
}).superRefine((value, ctx) => {
  if (value.mode === 'detail' && !value.idPengajuan) {
    ctx.addIssue({
      code: 'custom',
      path: ['idPengajuan'],
      message: 'idPengajuan wajib diisi untuk mode detail',
    })
  }
})

export type ArchiveSyncRequest = z.infer<typeof archiveSyncRequestSchema>

export type ArchiveSyncFileResult = {
  id: string
  fileName: string
  status: 'downloaded' | 'drive_trashed' | 'missing' | 'error'
  source: 'remote' | 'local'
  localPath: string
  message?: string
}

export type ArchiveSyncDetailResult = {
  idPengajuan: string
  synced: boolean
  finalized: boolean
  fileResults: ArchiveSyncFileResult[]
  downloadedCount: number
  missingCount: number
  errorCount: number
  reusedCount: number
  message?: string
}

export type ArchiveSyncStatusResponse = {
  inProgress: boolean
  latestRun: Record<string, unknown> | null
  history: Array<Record<string, unknown>>
  meta: Record<string, string>
  fileSummary: {
    total: number
    pending: number
    downloaded: number
    driveTrashed: number
    missing: number
    error: number
  }
}

const ARCHIVE_SYNC_SOURCE = 'nitro:archive-sync'
const ARCHIVE_SYNC_DETAIL_SOURCE = 'nitro:archive-sync:detail'
const ARCHIVE_SYNC_META_KEYS = {
  lastRunId: 'archive_sync:last_run_id',
  lastStartedAt: 'archive_sync:last_started_at',
  lastFinishedAt: 'archive_sync:last_finished_at',
  lastStatus: 'archive_sync:last_status',
  lastMode: 'archive_sync:last_mode',
  lastMessage: 'archive_sync:last_message',
  lastError: 'archive_sync:last_error',
  lastProcessedCount: 'archive_sync:last_processed_count',
  lastSuccessCount: 'archive_sync:last_success_count',
  lastFailureCount: 'archive_sync:last_failure_count',
  lastDownloadedCount: 'archive_sync:last_downloaded_count',
  lastMissingCount: 'archive_sync:last_missing_count',
  lastErrorCount: 'archive_sync:last_error_count',
  lastFinalizedCount: 'archive_sync:last_finalized_count',
} as const

function toText(value: unknown) {
  if (value instanceof Date) return value.toISOString()
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toOptionalText(value: unknown) {
  const text = toText(value)
  return text ? text : undefined
}

function toOptionalPositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return value
  return Math.floor(parsed)
}

function toBoolean(value: unknown) {
  if (value === 'false' || value === '0' || value === 0) return false
  if (value === 'true' || value === '1' || value === 1) return true
  return value
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function getRuntimeAppsScriptUrl(runtimeConfig: ArchiveSyncRuntimeConfig) {
  const url = String(runtimeConfig.appsScriptApiUrl || '').trim()
  if (!url) throw new Error('URL Google Apps Script belum dikonfigurasi.')
  return url
}

function resolveArchivePaths(runtimeConfig: ArchiveSyncRuntimeConfig) {
  return {
    archiveDir: runtimeConfig.archiveFileDirectory,
    archivePublicBasePath: runtimeConfig.public?.archiveFileBasePath,
  }
}

function buildArchiveSyncMetaValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

async function callAppsScriptAction<T>(
  runtimeConfig: ArchiveSyncRuntimeConfig,
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(getRuntimeAppsScriptUrl(runtimeConfig), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action,
      ...payload,
    }),
  })

  const responseText = await response.text()
  if (!response.ok) {
    throw new Error(`Google Apps Script merespons ${response.status}: ${responseText.slice(0, 300)}`)
  }

  let parsed: AppsScriptResult<T>
  try {
    parsed = JSON.parse(responseText) as AppsScriptResult<T>
  } catch {
    throw new Error(`Respon Google Apps Script bukan JSON valid: ${responseText.slice(0, 300)}`)
  }

  if (!parsed.success) {
    throw new Error(parsed.error || 'Request Google Apps Script gagal.')
  }

  return parsed.data as T
}

async function setSyncMeta(database: Pick<Database, 'insert'>, key: string, value: unknown) {
  await database
    .insert(syncMeta)
    .values({
      key,
      value: buildArchiveSyncMetaValue(value),
    })
    .onConflictDoUpdate({
      target: syncMeta.key,
      set: { value: buildArchiveSyncMetaValue(value) },
    })
}

async function setArchiveFileMeta(
  database: Database,
  fileId: string,
  patch: Partial<typeof archiveFiles.$inferInsert>,
) {
  await database
    .update(archiveFiles)
    .set(patch)
    .where(eq(archiveFiles.id, fileId))
}

async function loadArchiveFiles(database: Database, idPengajuan: string) {
  return await database
    .select()
    .from(archiveFiles)
    .where(eq(archiveFiles.idPengajuan, idPengajuan))
    .orderBy(archiveFiles.sequence)
}

async function loadArchiveSyncHistory(database: Database) {
  return await database
    .select()
    .from(syncLog)
    .where(eq(syncLog.source, ARCHIVE_SYNC_SOURCE))
    .orderBy(desc(syncLog.startedAt))
    .limit(10)
}

async function loadArchiveSyncMeta(database: Database) {
  const rows = await database.select().from(syncMeta)
  const meta: Record<string, string> = {}
  rows.forEach((row) => {
    meta[row.key] = row.value
  })
  return meta
}

async function loadArchiveFileSummary(database: Database) {
  const rows = await database.select({ status: archiveFiles.status }).from(archiveFiles)
  const summary = {
    total: rows.length,
    pending: 0,
    downloaded: 0,
    driveTrashed: 0,
    missing: 0,
    error: 0,
  }

  rows.forEach((row) => {
    if (row.status === 'pending') summary.pending += 1
    else if (row.status === 'downloaded') summary.downloaded += 1
    else if (row.status === 'drive_trashed') summary.driveTrashed += 1
    else if (row.status === 'missing') summary.missing += 1
    else if (row.status === 'error') summary.error += 1
  })

  return summary
}

async function getArchiveFileFromGas(
  runtimeConfig: ArchiveSyncRuntimeConfig,
  token: string,
  file: { idPengajuan: string, kind: string, sequence: number, fileName: string },
) {
  const data = await callAppsScriptAction<{
    fileName: string
    mimeType: string
    sizeBytes: number
    base64: string
    sourceDriveFileId?: string | null
  }>(runtimeConfig, 'getArchiveFile', {
    token,
    idPengajuan: file.idPengajuan,
    kind: file.kind,
    sequence: file.sequence,
    fileName: file.fileName,
  })

  if (data.fileName && data.fileName !== file.fileName) {
    throw new Error(`Nama file tidak cocok: ${data.fileName} !== ${file.fileName}`)
  }

  return data
}

async function fetchCompletedArchiveIds(
  runtimeConfig: ArchiveSyncRuntimeConfig,
  token: string,
  limit?: number,
) {
  const ids = new Set<string>()
  let page = 1
  let totalRows = Infinity

  while (ids.size < totalRows) {
    const pageSize = Math.min(100, limit ? Math.max(limit - ids.size, 1) : 100)
    const payload = await callAppsScriptAction<{
      rows: Array<{ idPengajuan: string }>
      totalRows: number
    }>(runtimeConfig, 'getPengajuanList', {
      token,
      status: 'Selesai',
      page,
      pageSize,
    })

    totalRows = Number.isFinite(payload.totalRows) ? payload.totalRows : payload.rows.length
    payload.rows.forEach((row) => {
      const idPengajuan = toText(row.idPengajuan)
      if (idPengajuan) ids.add(idPengajuan)
    })

    if (payload.rows.length < pageSize) break
    if (limit && ids.size >= limit) break
    page += 1
  }

  return Array.from(ids).slice(0, limit || ids.size)
}

async function markArchiveFileDownloaded(
  database: Database,
  file: { id: string, sourceDriveFileId?: string | null, mimeType?: string, sizeBytes?: number, sha256: string },
  localPath: string,
) {
  await setArchiveFileMeta(database, file.id, {
    localPath,
    mimeType: file.mimeType || null,
    sizeBytes: file.sizeBytes ?? null,
    sha256: file.sha256,
    sourceDriveFileId: file.sourceDriveFileId || null,
    status: 'downloaded',
    downloadedAt: new Date().toISOString(),
    driveTrashedAt: null,
    error: null,
  })
}

async function markArchiveFileMissing(
  database: Database,
  fileId: string,
  message: string,
) {
  await setArchiveFileMeta(database, fileId, {
    status: 'missing',
    error: message,
  })
}

async function markArchiveFileError(
  database: Database,
  fileId: string,
  message: string,
) {
  await setArchiveFileMeta(database, fileId, {
    status: 'error',
    error: message,
  })
}

async function markArchiveFileTrashed(database: Database, fileId: string) {
  await setArchiveFileMeta(database, fileId, {
    status: 'drive_trashed',
    driveTrashedAt: new Date().toISOString(),
    error: null,
  })
}

async function finalizeArchivedPengajuanInGas(
  runtimeConfig: ArchiveSyncRuntimeConfig,
  token: string,
  idPengajuan: string,
) {
  return await callAppsScriptAction<Record<string, unknown>>(runtimeConfig, 'finalizeArchivedPengajuan', {
    token,
    idPengajuan,
  })
}

async function syncArchiveFile(
  database: Database,
  runtimeConfig: ArchiveSyncRuntimeConfig,
  token: string,
  archiveFile: {
    id: string
    idPengajuan: string
    kind: string
    sequence: number
    fileName: string
    publicPath: string
    localPath: string | null
    status: string
    sourceDriveFileId: string | null
  },
) {
  const localPath = resolveArchiveLocalPath(archiveFile.publicPath, resolveArchivePaths(runtimeConfig))

  if (archiveFile.status === 'drive_trashed') {
    if (!existsSync(localPath)) {
      const message = 'File lokal belum tersedia setelah Drive di-trash.'
      await markArchiveFileMissing(database, archiveFile.id, message)
      return {
        id: archiveFile.id,
        fileName: archiveFile.fileName,
        status: 'missing' as const,
        source: 'local' as const,
        localPath,
        message,
      }
    }

    return {
      id: archiveFile.id,
      fileName: archiveFile.fileName,
      status: 'drive_trashed' as const,
      source: 'local' as const,
      localPath,
    }
  }

  try {
    const remote = await getArchiveFileFromGas(runtimeConfig, token, {
      idPengajuan: archiveFile.idPengajuan,
      kind: archiveFile.kind,
      sequence: archiveFile.sequence,
      fileName: archiveFile.fileName,
    })
    const bytes = Buffer.from(remote.base64, 'base64')
    mkdirSync(dirname(localPath), { recursive: true })
    await writeFile(localPath, bytes)
    const sha256 = createHash('sha256').update(bytes).digest('hex')

    await markArchiveFileDownloaded(database, {
      id: archiveFile.id,
      sourceDriveFileId: remote.sourceDriveFileId || null,
      mimeType: remote.mimeType || (archiveFile.kind === 'hardcopy' ? 'application/pdf' : 'image/jpeg'),
      sizeBytes: remote.sizeBytes || bytes.length,
      sha256,
    }, localPath)

    return {
      id: archiveFile.id,
      fileName: archiveFile.fileName,
      status: 'downloaded' as const,
      source: 'remote' as const,
      localPath,
    }
  } catch (error) {
    const message = getErrorMessage(error)
    if (/tidak ditemukan|not found|missing/i.test(message)) {
      await markArchiveFileMissing(database, archiveFile.id, message)
      return {
        id: archiveFile.id,
        fileName: archiveFile.fileName,
        status: 'missing' as const,
        source: 'remote' as const,
        localPath,
        message,
      }
    }

    await markArchiveFileError(database, archiveFile.id, message)
    return {
      id: archiveFile.id,
      fileName: archiveFile.fileName,
      status: 'error' as const,
      source: 'remote' as const,
      localPath,
      message,
    }
  }
}

async function syncArchiveDetail(
  database: Database,
  runtimeConfig: ArchiveSyncRuntimeConfig,
  token: string,
  idPengajuan: string,
  request: ArchiveSyncRequest,
  runId: string,
) {
  const detail = await callAppsScriptAction<unknown>(runtimeConfig, 'getDetail', {
    token,
    idPengajuan,
  })

  const upsertResult = await upsertGasArchiveDetail(detail, {
    database,
    mode: 'detail',
    source: ARCHIVE_SYNC_DETAIL_SOURCE,
    runId: `${runId}:${idPengajuan}`,
    archiveDir: runtimeConfig.archiveFileDirectory,
    archivePublicBasePath: runtimeConfig.public?.archiveFileBasePath,
  })

  const archiveFileRows = await loadArchiveFiles(database, idPengajuan)
  const fileResults: ArchiveSyncFileResult[] = []
  let downloadedCount = 0
  let missingCount = 0
  let errorCount = 0
  let reusedCount = 0

  for (const archiveFile of archiveFileRows) {
    const fileResult = await syncArchiveFile(database, runtimeConfig, token, archiveFile)
    fileResults.push(fileResult)

    if (fileResult.status === 'downloaded') downloadedCount += 1
    else if (fileResult.status === 'missing') missingCount += 1
    else if (fileResult.status === 'error') errorCount += 1

    if (fileResult.source === 'local' && fileResult.status === 'drive_trashed') reusedCount += 1
  }

  const refreshedFiles = await loadArchiveFiles(database, idPengajuan)
  const readyForFinalize = request.finalize
    && refreshedFiles.length > 0
    && refreshedFiles.every((file) => file.status === 'downloaded' || file.status === 'drive_trashed')

  let finalized = false
  if (readyForFinalize) {
    await finalizeArchivedPengajuanInGas(runtimeConfig, token, idPengajuan)
    for (const file of refreshedFiles) {
      await markArchiveFileTrashed(database, file.id)
    }
    finalized = true
  }

  return {
    idPengajuan,
    synced: true,
    finalized,
    fileResults,
    downloadedCount,
    missingCount,
    errorCount,
    reusedCount,
    message: `detail:${upsertResult.runId}`,
  } satisfies ArchiveSyncDetailResult
}

export async function runArchiveSync(
  input: unknown,
  options: {
    database?: Database
    runtimeConfig: ArchiveSyncRuntimeConfig
    runId?: string
  },
) {
  const database = options.database || defaultDb
  const request = archiveSyncRequestSchema.parse(input)
  const runId = options.runId || randomUUID()
  const startedAt = new Date().toISOString()
  const source = ARCHIVE_SYNC_SOURCE

  await database.insert(syncLog).values({
    runId,
    mode: request.mode,
    source,
    status: 'running',
    idPengajuan: request.idPengajuan || null,
    startedAt,
    rowsFetched: 0,
    rowsChanged: 0,
  })

  await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastRunId, runId)
  await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastStartedAt, startedAt)
  await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastStatus, 'running')
  await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastMode, request.mode)
  await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastMessage, 'Sinkronisasi arsip berjalan')
  await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastError, '')

  try {
    const ids = request.mode === 'detail'
      ? [request.idPengajuan as string]
      : await fetchCompletedArchiveIds(options.runtimeConfig, request.token, request.limit)

    const details: ArchiveSyncDetailResult[] = []
    let downloadedCount = 0
    let missingCount = 0
    let errorCount = 0
    let finalizedCount = 0

    for (const idPengajuan of ids) {
      try {
        const detailResult = await syncArchiveDetail(
          database,
          options.runtimeConfig,
          request.token,
          idPengajuan,
          request,
          runId,
        )
        details.push(detailResult)
        downloadedCount += detailResult.downloadedCount
        missingCount += detailResult.missingCount
        errorCount += detailResult.errorCount
        if (detailResult.finalized) finalizedCount += 1
      } catch (error) {
        const message = getErrorMessage(error)
        details.push({
          idPengajuan,
          synced: false,
          finalized: false,
          fileResults: [],
          downloadedCount: 0,
          missingCount: 0,
          errorCount: 1,
          reusedCount: 0,
          message,
        })
        errorCount += 1
      }
    }

    const successCount = details.filter((detail) => detail.synced && detail.missingCount === 0 && detail.errorCount === 0).length
    const failureCount = details.length - successCount
    const status = failureCount > 0 ? 'failed' : 'success'
    const finishedAt = new Date().toISOString()
    const message = failureCount > 0
      ? `Sinkronisasi selesai dengan ${failureCount} kegagalan.`
      : `Sinkronisasi selesai untuk ${details.length} pengajuan.`

    await database
      .update(syncLog)
      .set({
        status,
        finishedAt,
        rowsFetched: ids.length,
        rowsChanged: successCount,
        message,
        error: failureCount > 0 ? details.filter((detail) => detail.errorCount > 0).map((detail) => `${detail.idPengajuan}: ${detail.message || 'error'}`).join(' | ') : null,
        metaJson: JSON.stringify({
          requested: request,
          processedIds: ids,
          successCount,
          failureCount,
          downloadedCount,
          missingCount,
          errorCount,
          finalizedCount,
          details,
        }),
      })
      .where(eq(syncLog.runId, runId))

    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastFinishedAt, finishedAt)
    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastStatus, status)
    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastMessage, message)
    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastProcessedCount, ids.length)
    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastSuccessCount, successCount)
    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastFailureCount, failureCount)
    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastDownloadedCount, downloadedCount)
    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastMissingCount, missingCount)
    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastErrorCount, errorCount)
    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastFinalizedCount, finalizedCount)

    return {
      success: true,
      runId,
      mode: request.mode,
      startedAt,
      finishedAt,
      processedIds: ids,
      successCount,
      failureCount,
      downloadedCount,
      missingCount,
      errorCount,
      finalizedCount,
      details,
    }
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const message = getErrorMessage(error)

    await database
      .update(syncLog)
      .set({
        status: 'failed',
        finishedAt,
        error: message,
        message,
      })
      .where(eq(syncLog.runId, runId))

    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastFinishedAt, finishedAt)
    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastStatus, 'failed')
    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastError, message)
    await setSyncMeta(database, ARCHIVE_SYNC_META_KEYS.lastMessage, message)

    throw error
  }
}

export async function readArchiveSyncStatus(database: Database = defaultDb): Promise<ArchiveSyncStatusResponse> {
  const history = await loadArchiveSyncHistory(database)
  const [latestRun] = history
  const meta = await loadArchiveSyncMeta(database)
  const fileSummary = await loadArchiveFileSummary(database)

  return {
    inProgress: history.some((row) => row.status === 'running'),
    latestRun: latestRun || null,
    history,
    meta,
    fileSummary,
  }
}

export function parseArchiveSyncRequest(input: unknown) {
  return archiveSyncRequestSchema.parse(input)
}
