import type { ApiResult } from '../types/print'

type PengajuanPayload = Record<string, unknown>

export function usePengajuanApi() {
  async function callApi<T = Record<string, unknown>>(
    action: string,
    payload: PengajuanPayload = {}
  ): Promise<ApiResult<T>> {
    return await $fetch<ApiResult<T>>(`/api/pengajuan/actions/${encodeURIComponent(action)}`, {
      method: 'POST',
      body: payload
    })
  }

  return {
    callApi
  }
}

