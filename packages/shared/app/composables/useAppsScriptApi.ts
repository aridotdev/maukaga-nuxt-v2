import type { ApiResult } from '../types/print'

type AppsScriptPayload = Record<string, unknown>

type AppsScriptCallOptions = {
  token?: string
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

    const body: AppsScriptPayload = { action, ...payload }
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
      if (result.success) return result
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
