import { createError, type H3Event } from 'h3'
import {
  getArchiveChart,
  getArchiveDashboard,
  getArchiveDetail,
  getArchiveSyncStatus,
  syncArchive,
  type ArchiveRuntimeConfig,
} from '../repositories/archive-repository'
import { requireAdminSession } from './admin-auth-service'

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function parseSyncBody(value: unknown) {
  if (typeof value !== 'string') return toRecord(value)

  try {
    return toRecord(JSON.parse(value))
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Body sync arsip bukan JSON valid.',
    })
  }
}

function getArchiveRuntimeConfig(event: H3Event): ArchiveRuntimeConfig {
  const runtimeConfig = useRuntimeConfig(event)

  return {
    appsScriptApiUrl: runtimeConfig.appsScriptApiUrl,
    archiveFileDirectory: runtimeConfig.archiveFileDirectory,
    public: {
      archiveFileBasePath: runtimeConfig.public.archiveFileBasePath,
    },
  }
}

export async function readArchiveDashboardForAdmin(event: H3Event) {
  await requireAdminSession(event)
  return await getArchiveDashboard(getQuery(event))
}

export async function readArchiveChartForAdmin(event: H3Event) {
  await requireAdminSession(event)
  return await getArchiveChart(getQuery(event))
}

export async function readArchiveDetailForAdmin(event: H3Event, idPengajuan: string) {
  await requireAdminSession(event)
  return await getArchiveDetail(idPengajuan)
}

export async function readArchiveSyncStatusForAdmin(event: H3Event) {
  await requireAdminSession(event)
  return await getArchiveSyncStatus()
}

export async function runArchiveSyncForAdmin(event: H3Event, rawBody: unknown) {
  const session = await requireAdminSession(event)
  const body = parseSyncBody(rawBody)

  return await syncArchive({
    ...body,
    token: session.token,
  }, getArchiveRuntimeConfig(event))
}
