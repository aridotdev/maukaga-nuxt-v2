import type { ApiResult } from '../types/print'

type AppsScriptPayload = Record<string, unknown>

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
      body: JSON.stringify({ action, ...payload })
    })

    if (!response.ok) {
      throw new Error(`Google Apps Script merespons ${response.status}.`)
    }

    return response.json() as Promise<ApiResult<T>>
  }

  return {
    appsScriptApiUrl,
    callApi
  }
}
