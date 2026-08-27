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

    if (!response.ok) throw new Error(`Google Apps Script merespons ${response.status}.`)

    const result = await response.json() as ApiResult<T>
    if (!result.success) throw new Error(result.error || 'Request gagal.')

    return result
  }

  return {
    appsScriptApiUrl,
    callApi
  }
}
