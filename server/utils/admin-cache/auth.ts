import type { H3Event } from 'h3'

type UserRole = 'admin' | 'management' | 'qrcc'

type AdminCacheConfig = {
  supabaseUrl: string
  publishableKey: string
}

type SupabaseUser = {
  id?: string
  email?: string
}

type AdminProfile = {
  id: string
  email: string | null
  full_name: string | null
  role: UserRole | string
  is_active: boolean
}

const roleValues = ['admin', 'management', 'qrcc'] as const

export async function requireAdminCacheSession(event: H3Event) {
  const token = getBearerToken(event)

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Tidak ada session aktif.'
    })
  }

  const config = getAdminCacheConfig(event)
  requireAdminCacheConfig(config)

  const user = await fetchSupabaseJson<SupabaseUser>(`${config.supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: supabaseUserHeaders(config, token)
  })

  if (!user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Token Supabase tidak valid.'
    })
  }

  const profiles = await fetchSupabaseJson<AdminProfile[]>(
    `${config.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,full_name,role,is_active`,
    {
      method: 'GET',
      headers: supabaseUserHeaders(config, token)
    }
  )
  const profile = profiles?.[0]
  const role = normalizeUserRole(profile?.role)

  if (!profile) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Profile Supabase tidak ditemukan.'
    })
  }

  if (profile.is_active !== true || !role) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Unauthorized: akun tidak aktif atau role tidak valid.'
    })
  }

  return {
    token,
    userId: user.id,
    email: user.email || profile.email || '',
    fullName: profile.full_name || '',
    role
  }
}

function getAdminCacheConfig(event: H3Event): AdminCacheConfig {
  const config = useRuntimeConfig(event)

  return {
    supabaseUrl: clean(config.supabaseUrl).replace(/\/+$/, ''),
    publishableKey: clean(config.supabasePublishableKey)
  }
}

function requireAdminCacheConfig(config: AdminCacheConfig) {
  if (!config.supabaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase URL server belum dikonfigurasi.'
    })
  }

  if (!config.publishableKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase publishable key server belum dikonfigurasi.'
    })
  }
}

function getBearerToken(event: H3Event) {
  const authorization = clean(getHeader(event, 'authorization'))
  const match = authorization.match(/^Bearer\s+(.+)$/i)

  return match?.[1]?.trim() || ''
}

async function fetchSupabaseJson<T>(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  const json = parseJson(text)

  if (!response.ok) {
    throw createError({
      statusCode: getProxyStatusCode(response.status),
      statusMessage: getSupabaseErrorMessage(json) || `Supabase error ${response.status}`
    })
  }

  return json as T
}

function supabaseUserHeaders(config: AdminCacheConfig, token: string) {
  return {
    'User-Agent': 'MauKaGa-Nuxt-Server/1.0',
    apikey: config.publishableKey,
    Authorization: `Bearer ${token}`
  }
}

function normalizeUserRole(value: unknown): UserRole | null {
  const role = clean(value).toLowerCase()
  return roleValues.includes(role as UserRole) ? role as UserRole : null
}

function parseJson(text: string) {
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function getSupabaseErrorMessage(value: unknown) {
  if (!isRecord(value)) return ''
  return clean(value.msg || value.message || value.error_description || value.error)
}

function getProxyStatusCode(status: number) {
  if ([400, 401, 403, 404, 409, 422].includes(status)) return status
  return 502
}

function clean(value: unknown) {
  return String(value ?? '').trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
