import type { ApiResult } from '~/types/print'

export function useActiveApi() {
  const { getSession } = useCurrentSession()

  async function callApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<ApiResult<T>> {
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')

    const result = await $fetch<ApiResult<T>>(`/api/active/actions/${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: payload,
    })

    if (!result.success) throw new Error(result.error || 'Request gagal.')

    return result
  }

  return {
    callApi,
  }
}
