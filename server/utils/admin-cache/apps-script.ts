import { clean } from './normalizers'

export type AppsScriptResult<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}

export async function callAdminAppsScript<T>(
  token: string,
  action: string,
  payload: Record<string, unknown> = {}
): Promise<AppsScriptResult<T>> {
  const config = useRuntimeConfig()
  const url = clean(config.appsScriptApiUrl || config.public.appsScriptApiUrl)

  if (!url) throw new Error('URL Google Apps Script belum dikonfigurasi.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action,
        token,
        ...payload
      }),
      signal: controller.signal
    })
    const text = await response.text()
    const json = parseAppsScriptResponse<T>(text)

    if (!response.ok) {
      throw new Error(json.error || `Google Apps Script merespons ${response.status}.`)
    }

    return json
  } finally {
    clearTimeout(timeout)
  }
}

function parseAppsScriptResponse<T>(text: string): AppsScriptResult<T> {
  if (!text) {
    return { success: false, error: 'Response kosong.' }
  }

  try {
    return JSON.parse(text) as AppsScriptResult<T>
  } catch {
    return { success: false, error: 'Response Google Apps Script tidak valid.' }
  }
}
