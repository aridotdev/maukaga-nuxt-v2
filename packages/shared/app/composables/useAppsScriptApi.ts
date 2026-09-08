import type { ApiResult } from '../types/print'
import { normalizePengajuanId } from '../utils'

type AppsScriptPayload = Record<string, unknown>

type AppsScriptCallOptions = {
  token?: string
}

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

export function useAppsScriptApi() {
  const runtimeConfig = useRuntimeConfig()
  const appsScriptApiUrl = computed(() => String(runtimeConfig.public.appsScriptApiUrl || ''))

  async function callApi<T>(
    action: string,
    payload: AppsScriptPayload = {},
    options: AppsScriptCallOptions = {}
  ): Promise<ApiResult<T>> {
    if (!appsScriptApiUrl.value) {
      throw new Error('URL Google Apps Script belum dikonfigurasi.')
    }

    const body: AppsScriptPayload = { action, ...normalizeAppsScriptPayload(payload) }
    if (options.token) body.token = options.token

    const response = await fetch(appsScriptApiUrl.value, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
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
      if (!response.ok) throw new Error(result.error || `Google Apps Script merespons ${response.status}.`)
      throw new Error(result.error || 'Request gagal.')
    }

    if (!response.ok) throw new Error(`Google Apps Script merespons ${response.status}: ${responseText.slice(0, 300)}`)

    throw new Error(`Respon Google Apps Script bukan JSON valid: ${responseText.slice(0, 300)}`)
  }

  return {
    appsScriptApiUrl,
    callApi
  }
}
