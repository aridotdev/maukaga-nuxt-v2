import { createError, type H3Event } from 'h3'
import { callActiveGasAction, type ActiveGasResult } from '../repositories/active-gas-repository'
import { requireAdminSession } from './admin-auth-service'

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
): Promise<ActiveGasResult<T>> {
  const { token } = await requireAdminSession(event)
  const gasAction = resolveActiveGasAction(action)

  try {
    return await callActiveGasAction<T>(useRuntimeConfig(event), gasAction, token, payload)
  } catch (error) {
    throw toHttpError(error)
  }
}

export async function callActiveGasData<T>(
  event: H3Event,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const result = await callActiveGasResult<T>(event, action, payload)
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
