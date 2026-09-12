import { createError, getRouterParam, readBody } from 'h3'
import {
  checkDraftPengajuanStatus,
  getDraftPengajuan,
  getModelProduk,
  loadDraftPengajuanById,
  saveDraftPengajuan,
  submitDraftPengajuan,
  type PengajuanApiResult,
  type SaveDraftInput,
  type SubmitDraftInput,
} from '../../../repositories/pengajuan-repository'

const PENGAJUAN_ACTIONS = new Set([
  'getModelProduk',
  'saveDraftPengajuan',
  'loadDraftPengajuanById',
  'getDraftPengajuan',
  'checkDraftPengajuanStatus',
  'submitDraftPengajuan',
])

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error || 'Request gagal.')
}

export default defineEventHandler(async (event): Promise<PengajuanApiResult<unknown>> => {
  const action = String(getRouterParam(event, 'action') || '').trim()
  if (!PENGAJUAN_ACTIONS.has(action)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Action Pengajuan tidak tersedia.',
    })
  }

  try {
    if (action === 'getModelProduk') {
      return { success: true, data: await getModelProduk() }
    }

    if (action === 'loadDraftPengajuanById') {
      const body = await readBody<{ idPengajuan?: string }>(event)
      return {
        success: true,
        data: await loadDraftPengajuanById(String(body?.idPengajuan || '')),
      }
    }

    if (action === 'getDraftPengajuan') {
      const body = await readBody<{ idPengajuan?: string, resumeToken?: string }>(event)
      return {
        success: true,
        data: await getDraftPengajuan(
          String(body?.idPengajuan || ''),
          String(body?.resumeToken || ''),
        ),
      }
    }

    if (action === 'checkDraftPengajuanStatus') {
      const body = await readBody<{ idPengajuan?: string }>(event)
      return {
        success: true,
        data: await checkDraftPengajuanStatus(String(body?.idPengajuan || '')),
      }
    }

    const runtimeConfig = useRuntimeConfig(event)
    const publicConfig = runtimeConfig.public as { maxItems?: unknown, maxUploadMb?: unknown }
    const maxItems = Number(publicConfig.maxItems || 10)

    if (action === 'submitDraftPengajuan') {
      const body = await readBody<SubmitDraftInput>(event)
      return {
        success: true,
        data: await submitDraftPengajuan(body, undefined, {
          maxItems,
          maxUploadMb: Number(publicConfig.maxUploadMb || 10),
        }),
      }
    }

    const body = await readBody<SaveDraftInput>(event)
    return {
      success: true,
      data: await saveDraftPengajuan(body, undefined, { maxItems }),
    }
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error),
    }
  }
})
