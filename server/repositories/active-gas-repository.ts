export type ActiveGasResult<T> = {
  success: boolean
  data?: T
  error?: string
}

type ActiveGasRuntimeConfig = {
  appsScriptApiUrl?: unknown
  public?: {
    appsScriptApiUrl?: unknown
  }
}

function resolveAppsScriptApiUrl(runtimeConfig: ActiveGasRuntimeConfig) {
  const serverUrl = String(runtimeConfig.appsScriptApiUrl || '').trim()
  const publicUrl = String(runtimeConfig.public?.appsScriptApiUrl || '').trim()
  return serverUrl || publicUrl
}

export async function callActiveGasAction<T>(
  runtimeConfig: ActiveGasRuntimeConfig,
  action: string,
  token: string,
  payload: Record<string, unknown> = {},
): Promise<ActiveGasResult<T>> {
  const url = resolveAppsScriptApiUrl(runtimeConfig)
  if (!url) throw new Error('URL Google Apps Script belum dikonfigurasi.')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action,
      token,
      ...payload,
    }),
  })

  const responseText = await response.text()
  if (!response.ok) {
    throw new Error(`Google Apps Script merespons ${response.status}: ${responseText.slice(0, 300)}`)
  }

  try {
    const result = JSON.parse(responseText) as ActiveGasResult<T>
    if (!result.success) throw new Error(result.error || 'Request Google Apps Script gagal.')
    return result
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Respon Google Apps Script bukan JSON valid: ${responseText.slice(0, 300)}`)
    }

    throw error
  }
}
