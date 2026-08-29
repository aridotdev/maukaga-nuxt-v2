export type AdminAuthRuntimeConfig = {
  supabaseUrl?: unknown
  supabasePublishableKey?: unknown
  supabaseSecretKey?: unknown
}

export type SupabaseAuthUser = {
  id: string
  email?: string
}

export type SupabaseAdminProfile = {
  role: string
  is_active: boolean
  full_name: string | null
}

export class AdminAuthRepositoryError extends Error {
  statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'AdminAuthRepositoryError'
    this.statusCode = statusCode
  }
}

function normalizeSupabaseUrl(value: unknown) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function resolveSupabaseConfig(runtimeConfig: AdminAuthRuntimeConfig) {
  const url = normalizeSupabaseUrl(runtimeConfig.supabaseUrl)
  const apiKey = String(runtimeConfig.supabasePublishableKey || runtimeConfig.supabaseSecretKey || '').trim()

  if (!url || !apiKey) {
    throw new AdminAuthRepositoryError(500, 'Konfigurasi Supabase server belum lengkap.')
  }

  return { url, apiKey }
}

async function readSupabaseJson(response: Response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new AdminAuthRepositoryError(502, `Respon Supabase bukan JSON valid: ${text.slice(0, 300)}`)
  }
}

function getSupabaseErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback

  const record = payload as Record<string, unknown>
  return String(record.message || record.msg || record.error_description || record.error || fallback)
}

async function fetchSupabaseJson(
  runtimeConfig: AdminAuthRuntimeConfig,
  token: string,
  path: string,
) {
  const { url, apiKey } = resolveSupabaseConfig(runtimeConfig)
  const response = await fetch(`${url}${path}`, {
    method: 'GET',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
    },
  })
  const payload = await readSupabaseJson(response)

  if (!response.ok) {
    throw new AdminAuthRepositoryError(
      response.status,
      getSupabaseErrorMessage(payload, `Supabase merespons ${response.status}`),
    )
  }

  return payload
}

export async function fetchSupabaseAuthUser(
  runtimeConfig: AdminAuthRuntimeConfig,
  token: string,
) {
  const payload = await fetchSupabaseJson(runtimeConfig, token, '/auth/v1/user')
  if (!payload || typeof payload !== 'object') return null

  const record = payload as Record<string, unknown>
  const id = String(record.id || '').trim()
  if (!id) return null

  return {
    id,
    email: typeof record.email === 'string' ? record.email : undefined,
  } satisfies SupabaseAuthUser
}

export async function fetchSupabaseAdminProfile(
  runtimeConfig: AdminAuthRuntimeConfig,
  token: string,
  userId: string,
) {
  const query = new URLSearchParams({
    select: 'role,is_active,full_name',
    id: `eq.${userId}`,
    limit: '1',
  })
  const payload = await fetchSupabaseJson(runtimeConfig, token, `/rest/v1/profiles?${query}`)
  const row = Array.isArray(payload) ? payload[0] : null
  if (!row || typeof row !== 'object') return null

  const record = row as Record<string, unknown>
  return {
    role: String(record.role || '').trim(),
    is_active: record.is_active === true,
    full_name: typeof record.full_name === 'string' ? record.full_name : null,
  } satisfies SupabaseAdminProfile
}
