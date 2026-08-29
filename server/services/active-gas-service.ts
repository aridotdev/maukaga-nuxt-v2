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
  'getPrintLayouts',
  'savePrintLayout',
  'deletePrintLayout',
  'setActivePrintLayout',
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
  const { token } = await resolvedDependencies.requireAdminSession(event)
  const gasAction = resolveActiveGasAction(action)

  try {
    return await resolvedDependencies.callGasAction<T>(
      resolvedDependencies.getRuntimeConfig(event),
      gasAction,
      token,
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
  return result.data as T
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
