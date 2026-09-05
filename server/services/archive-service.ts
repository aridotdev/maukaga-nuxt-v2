import { createError, getQuery, type H3Event } from 'h3'
import {
  getArchiveChart,
  getArchiveDashboard,
  getArchiveDetail,
  getArchiveSyncStatus,
  syncArchive,
  type ArchiveRuntimeConfig,
} from '../repositories/archive-repository'
import { requireAdminSession } from './admin-auth-service'

type ArchiveServiceDependencies = {
  getDashboard?: typeof getArchiveDashboard
  getChart?: typeof getArchiveChart
  getDetail?: typeof getArchiveDetail
  getSyncStatus?: typeof getArchiveSyncStatus
  sync?: typeof syncArchive
  requireAdminSession?: typeof requireAdminSession
  getRuntimeConfig?: (event: H3Event) => ArchiveRuntimeConfig
}

const defaultArchiveServiceDependencies = {
  getDashboard: getArchiveDashboard,
  getChart: getArchiveChart,
  getDetail: getArchiveDetail,
  getSyncStatus: getArchiveSyncStatus,
  sync: syncArchive,
  requireAdminSession,
  getRuntimeConfig: getArchiveRuntimeConfig,
} satisfies Required<ArchiveServiceDependencies>

function resolveArchiveServiceDependencies(dependencies: ArchiveServiceDependencies = {}) {
  return {
    ...defaultArchiveServiceDependencies,
    ...dependencies,
  }
}

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

const RESERVED_ARCHIVE_SYNC_BODY_KEYS = new Set(['action', 'token', 'bridge', 'bridgeActor', 'bridgeSignature'])

function sanitizeArchiveSyncBody(body: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => !RESERVED_ARCHIVE_SYNC_BODY_KEYS.has(key)),
  )
}

function getArchiveRuntimeConfig(event: H3Event): ArchiveRuntimeConfig {
  const runtimeConfig = useRuntimeConfig(event)

  return {
    appsScriptApiUrl: runtimeConfig.appsScriptApiUrl,
    gasBridgeSecret: runtimeConfig.gasBridgeSecret,
    archiveFileDirectory: runtimeConfig.archiveFileDirectory,
    public: {
      archiveFileBasePath: runtimeConfig.public.archiveFileBasePath,
    },
  }
}

export async function readArchiveDashboardForAdmin(
  event: H3Event,
  dependencies: ArchiveServiceDependencies = {},
) {
  const resolvedDependencies = resolveArchiveServiceDependencies(dependencies)
  await resolvedDependencies.requireAdminSession(event)
  return await resolvedDependencies.getDashboard(getQuery(event))
}

export async function readArchiveChartForAdmin(
  event: H3Event,
  dependencies: ArchiveServiceDependencies = {},
) {
  const resolvedDependencies = resolveArchiveServiceDependencies(dependencies)
  await resolvedDependencies.requireAdminSession(event)
  return await resolvedDependencies.getChart(getQuery(event))
}

export async function readArchiveDetailForAdmin(
  event: H3Event,
  idPengajuan: string,
  dependencies: ArchiveServiceDependencies = {},
) {
  const resolvedDependencies = resolveArchiveServiceDependencies(dependencies)
  await resolvedDependencies.requireAdminSession(event)
  return await resolvedDependencies.getDetail(idPengajuan)
}

export async function readArchiveSyncStatusForAdmin(
  event: H3Event,
  dependencies: ArchiveServiceDependencies = {},
) {
  const resolvedDependencies = resolveArchiveServiceDependencies(dependencies)
  await resolvedDependencies.requireAdminSession(event)
  return await resolvedDependencies.getSyncStatus()
}

export async function runArchiveSyncForAdmin(
  event: H3Event,
  rawBody: unknown,
  dependencies: ArchiveServiceDependencies = {},
) {
  const resolvedDependencies = resolveArchiveServiceDependencies(dependencies)
  const session = await resolvedDependencies.requireAdminSession(event)
  const body = sanitizeArchiveSyncBody(parseSyncBody(rawBody))

  return await resolvedDependencies.sync({
    ...body,
    bridgeActor: session,
  }, resolvedDependencies.getRuntimeConfig(event))
}
