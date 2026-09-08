import type { ApiResult } from '../types/print'
import { normalizePengajuanId } from '../utils'

type AppsScriptPayload = Record<string, unknown>

function normalizeAppsScriptPayload(payload: AppsScriptPayload) {
  if (!Object.prototype.hasOwnProperty.call(payload, 'idPengajuan')) return payload

  return {
    ...payload,
    idPengajuan: normalizePengajuanId(payload.idPengajuan),
  }
}

function normalizeAppsScriptResult<T>(result: ApiResult<T>): ApiResult<T> {
  if (!result.success || !result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
    return result
  }

  const data = result.data as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(data, 'idPengajuan')) return result

  return {
    ...result,
    data: {
      ...data,
      idPengajuan: normalizePengajuanId(data.idPengajuan),
    } as T,
  }
}

export function useCsAppsScriptApi() {
  const runtimeConfig = useRuntimeConfig()
  const appsScriptApiUrl = computed(() => String(runtimeConfig.public.appsScriptApiUrl || ''))

  async function callApi<T = Record<string, unknown>>(
    action: string,
    payload: AppsScriptPayload = {}
  ): Promise<ApiResult<T>> {
    if (!appsScriptApiUrl.value) {
      throw new Error('URL Google Apps Script belum dikonfigurasi.')
    }

    const response = await fetch(appsScriptApiUrl.value, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...normalizeAppsScriptPayload(payload) })
    })

    const responseText = await response.text()
    let result: ApiResult<T> | null = null

    try {
      result = JSON.parse(responseText) as ApiResult<T>
    } catch {
      result = null
    }

    if (result) {
      if (result.success) return normalizeAppsScriptResult(result)
      if (!response.ok) {
        throw new Error(result.error || `Google Apps Script merespons ${response.status}.`)
      }
      throw new Error(result.error || 'Request gagal.')
    }

    if (!response.ok) {
      throw new Error(`Google Apps Script merespons ${response.status}: ${responseText.slice(0, 300)}`)
    }

    throw new Error(`Respon Google Apps Script bukan JSON valid: ${responseText.slice(0, 300)}`)
  }

  return {
    appsScriptApiUrl,
    callApi
  }
}
