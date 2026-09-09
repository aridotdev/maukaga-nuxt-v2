import type { ApiResult } from '../types/print'

type CsLocalPayload = Record<string, unknown>

export function useCsLocalApi() {
  async function callApi<T = Record<string, unknown>>(
    action: string,
    payload: CsLocalPayload = {}
  ): Promise<ApiResult<T>> {
    return await $fetch<ApiResult<T>>(`/api/cs/actions/${encodeURIComponent(action)}`, {
      method: 'POST',
      body: payload
    })
  }

  return {
    callApi
  }
}

