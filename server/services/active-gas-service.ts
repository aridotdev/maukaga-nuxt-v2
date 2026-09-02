import { createError, type H3Event } from 'h3'
import { callActiveGasAction, type ActiveGasResult } from '../repositories/active-gas-repository'
import { requireAdminSession, type AdminSession } from './admin-auth-service'

type ActiveGasDependencies = {
  callGasAction?: typeof callActiveGasAction
  getRuntimeConfig?: (event: H3Event) => Parameters<typeof callActiveGasAction>[0]
  requireAdminSession?: (event: H3Event) => Promise<AdminSession>
}

const ACTIVE_GAS_ACTIONS = new Set([
  'getDashboard',
  'getDashboardSummary',
  'getDashboardLatest',
  'getPengajuanList',
  'getDashboardChartAggregate',
  'getDetail',
  'updateStatus',
  'updateItemDecision',
  'updatePengajuanAdmin',
  'deletePengajuan',
  'getProductReviewQueue',
  'approveModelProduk',
  'getModelProduk',
  'getWarrantyPrintQueue',
  'getShippingLabelQueue',
  'getArchiveFile',
  'saveWarrantyCardTypes',
  'markWarrantyItemsPrinted',
  'markWarrantyItemsShipped',
])

const ACTIVE_GAS_ACTION_ALIASES: Record<string, string> = {
  markWarrantyCardsPrinted: 'markWarrantyItemsPrinted',
  markShippingLabelsShipped: 'markWarrantyItemsShipped',
}

const defaultActiveGasDependencies = {
  callGasAction: callActiveGasAction,
  getRuntimeConfig: (event: H3Event) => useRuntimeConfig(event),
  requireAdminSession,
} satisfies Required<ActiveGasDependencies>

function resolveActiveGasDependencies(dependencies: ActiveGasDependencies = {}) {
  return {
    ...defaultActiveGasDependencies,
    ...dependencies,
  }
}

function resolveActiveGasAction(action: string) {
  const normalizedAction = String(action || '').trim()
  const gasAction = ACTIVE_GAS_ACTION_ALIASES[normalizedAction] || normalizedAction

  if (!ACTIVE_GAS_ACTIONS.has(gasAction)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Action active tidak tersedia.',
    })
  }

  return gasAction
}

function toHttpError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const statusCode = /unauthorized|token|session/i.test(message) ? 401 : 502

  return createError({
    statusCode,
    statusMessage: message,
  })
}

export async function callActiveGasResult<T>(
  event: H3Event,
  action: string,
  payload: Record<string, unknown> = {},
  dependencies: ActiveGasDependencies = {},
): Promise<ActiveGasResult<T>> {
  const resolvedDependencies = resolveActiveGasDependencies(dependencies)
  const session = await resolvedDependencies.requireAdminSession(event)
  const gasAction = resolveActiveGasAction(action)

  try {
    return await resolvedDependencies.callGasAction<T>(
      resolvedDependencies.getRuntimeConfig(event),
      gasAction,
      session,
      payload,
    )
  } catch (error) {
    throw toHttpError(error)
  }
}

export async function callActiveGasData<T>(
  event: H3Event,
  action: string,
  payload: Record<string, unknown> = {},
  dependencies: ActiveGasDependencies = {},
): Promise<T> {
  const result = await callActiveGasResult<T>(event, action, payload, dependencies)
  const data = result.data as T
  if (action === 'getDetail') return normalizeActiveDetailPayload(data)
  return data
}

export async function updateActivePengajuanStatus<T>(
  event: H3Event,
  idPengajuan: string,
  body: Record<string, unknown>,
) {
  return await callActiveGasData<T>(event, 'updateStatus', {
    ...body,
    idPengajuan,
  })
}

export async function updateActivePengajuanItemDecision<T>(
  event: H3Event,
  idPengajuan: string,
  body: Record<string, unknown>,
) {
  return await callActiveGasData<T>(event, 'updateItemDecision', {
    ...body,
    idPengajuan,
  })
}

function normalizeActiveDetailPayload<T>(value: T): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value

  const detail = value as Record<string, unknown>
  const idPengajuan = String(detail.idPengajuan || '')
  const hardcopyArchivePath = String(detail.hardcopyArchivePath || '')
  const evidenceArchivePaths = Array.isArray(detail.evidenceArchivePaths)
    ? detail.evidenceArchivePaths.map((path) => String(path || '')).filter(Boolean)
    : []
  const fileHardCopyUrl = buildActiveArchiveFileUrl(idPengajuan, 'hardcopy')
  const evidenceAttachmentUrls = evidenceArchivePaths.length
    ? evidenceArchivePaths.map((_, index) => buildActiveArchiveFileUrl(idPengajuan, 'bukti', index + 1))
    : Array.isArray(detail.evidenceAttachmentUrls)
      ? detail.evidenceAttachmentUrls
      : []

  return {
    ...detail,
    fileHardCopyUrl,
    fileHardCopyId: hardcopyArchivePath || String(detail.fileHardCopyId || ''),
    hardcopyArchivePath,
    evidenceAttachmentUrls,
    evidenceAttachmentIds: Array.isArray(detail.evidenceAttachmentIds) ? detail.evidenceAttachmentIds : [],
    evidenceArchivePaths,
  } as T
}

function buildActiveArchiveFileUrl(idPengajuan: string, kind: 'hardcopy' | 'bukti', sequence = 0) {
  const id = String(idPengajuan || '').trim()
  if (!id) return ''

  const url = new URL(`/api/active/pengajuan/${encodeURIComponent(id)}/file`, 'http://localhost')
  url.searchParams.set('kind', kind)
  if (kind === 'bukti') {
    url.searchParams.set('sequence', String(sequence))
  }

  return `${url.pathname}${url.search}`
}
