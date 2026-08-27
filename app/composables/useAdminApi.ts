export function useAdminApi() {
  const { getSession } = useCurrentSession()

  async function callAdminAction<T>(
    action: string,
    payload: Record<string, unknown> = {}
  ) {
    const session = await getSession()
    if (!session) throw new Error('Tidak ada session aktif.')

    const response = await fetch('/api/admin-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        token: session.access_token,
        ...payload
      })
    })

    if (!response.ok) {
      const errorBody = await readErrorBody(response)
      throw new Error(errorBody || `Request admin merespons ${response.status}.`)
    }

    const result = await response.json() as {
      success: boolean
      data?: T
      error?: string
    }

    if (!result.success) {
      throw new Error(result.error || 'Request gagal.')
    }

    return result.data as T
  }

  return { callAdminAction }
}

async function readErrorBody(response: Response) {
  try {
    const body = await response.json() as {
      message?: string
      statusMessage?: string
      error?: string
    }

    return body.message || body.statusMessage || body.error || ''
  } catch {
    return ''
  }
}
