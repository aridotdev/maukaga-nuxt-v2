import { createError, getRouterParam, readBody } from 'h3'
import {
  checkDraftPengajuanStatusLocal,
  getDraftPengajuanLocal,
  getLocalModelProduk,
  loadDraftPengajuanByIdLocal,
  saveDraftPengajuanLocal,
  submitDraftPengajuanLocal,
  type CsLocalApiResult,
  type SaveDraftInput,
  type SubmitDraftInput,
} from '../../../repositories/cs-pengajuan-local-repository'

const LOCAL_CS_ACTIONS = new Set([
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

export default defineEventHandler(async (event): Promise<CsLocalApiResult<unknown>> => {
  const action = String(getRouterParam(event, 'action') || '').trim()
  if (!LOCAL_CS_ACTIONS.has(action)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Action CS lokal tidak tersedia.',
    })
  }

  try {
    if (action === 'getModelProduk') {
      return { success: true, data: await getLocalModelProduk() }
    }

    if (action === 'loadDraftPengajuanById') {
      const body = await readBody<{ idPengajuan?: string }>(event)
      return {
        success: true,
        data: await loadDraftPengajuanByIdLocal(String(body?.idPengajuan || '')),
      }
    }

    if (action === 'getDraftPengajuan') {
      const body = await readBody<{ idPengajuan?: string, resumeToken?: string }>(event)
      return {
        success: true,
        data: await getDraftPengajuanLocal(
          String(body?.idPengajuan || ''),
          String(body?.resumeToken || ''),
        ),
      }
    }

    if (action === 'checkDraftPengajuanStatus') {
      const body = await readBody<{ idPengajuan?: string }>(event)
      return {
        success: true,
        data: await checkDraftPengajuanStatusLocal(String(body?.idPengajuan || '')),
      }
    }

    const runtimeConfig = useRuntimeConfig(event)
    const publicConfig = runtimeConfig.public as { maxItems?: unknown, maxUploadMb?: unknown }
    const maxItems = Number(publicConfig.maxItems || 10)

    if (action === 'submitDraftPengajuan') {
      const body = await readBody<SubmitDraftInput>(event)
      return {
        success: true,
        data: await submitDraftPengajuanLocal(body, undefined, {
          maxItems,
          maxUploadMb: Number(publicConfig.maxUploadMb || 10),
        }),
      }
    }

    const body = await readBody<SaveDraftInput>(event)
    return {
      success: true,
      data: await saveDraftPengajuanLocal(body, undefined, { maxItems }),
    }
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error),
    }
  }
})
