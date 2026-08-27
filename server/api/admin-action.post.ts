type ApiResult<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}

const roleValues = ['admin', 'management', 'qrcc'] as const
type UserRole = typeof roleValues[number]

type AdminUser = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

type SupabaseUser = {
  id?: string
  email?: string
}

type AdminProfile = Pick<AdminUser, 'id' | 'email' | 'full_name' | 'role' | 'is_active'>

type AdminConfig = {
  supabaseUrl: string
  publishableKey: string
  secretKey: string
  appUrl: string
}

const allowedAdminActions = new Set([
  'adminUsersList',
  'adminUsersInvite',
  'adminUsersUpdate',
  'adminUsersDeactivate',
  'adminUsersReactivate'
])

export default defineEventHandler(async (event): Promise<ApiResult> => {
  const body = await readBody<Record<string, unknown>>(event)
  const action = clean(body?.action)
  const token = clean(body?.token)

  if (!allowedAdminActions.has(action)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Action admin tidak valid.'
    })
  }

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Tidak ada session aktif.'
    })
  }

  const config = getAdminConfig(event)
  requireAdminConfig(config)
  const caller = await requireAdminSession(config, token)

  switch (action) {
    case 'adminUsersList':
      return {
        success: true,
        data: await listAdminUsers(config)
      }

    case 'adminUsersInvite':
      return {
        success: true,
        data: await inviteAdminUser(event, config, body)
      }

    case 'adminUsersUpdate':
      return {
        success: true,
        data: await updateAdminUser(config, body)
      }

    case 'adminUsersDeactivate':
      return {
        success: true,
        data: await setAdminUserActive(config, body, false, caller.userId)
      }

    case 'adminUsersReactivate':
      return {
        success: true,
        data: await setAdminUserActive(config, body, true, caller.userId)
      }

    default:
      throw createError({
        statusCode: 400,
        statusMessage: 'Action admin tidak valid.'
      })
  }
})

function getAdminConfig(event: Parameters<typeof useRuntimeConfig>[0]): AdminConfig {
  const config = useRuntimeConfig(event)

  return {
    supabaseUrl: clean(config.supabaseUrl).replace(/\/+$/, ''),
    publishableKey: clean(config.supabasePublishableKey),
    secretKey: clean(config.supabaseSecretKey),
    appUrl: clean(config.appUrl).replace(/\/+$/, '')
  }
}

function requireAdminConfig(config: AdminConfig) {
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

  if (!config.secretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase admin key server belum dikonfigurasi. Set NUXT_SUPABASE_SECRET_KEY atau NUXT_SUPABASE_SERVICE_ROLE_KEY di environment server.'
    })
  }
}

async function requireAdminSession(config: AdminConfig, token: string) {
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

  if (profile.is_active !== true) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Unauthorized: akun tidak aktif.'
    })
  }

  if (role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Unauthorized: bukan admin.'
    })
  }

  return {
    userId: user.id,
    email: user.email || profile.email || '',
    fullName: profile.full_name || ''
  }
}

async function listAdminUsers(config: AdminConfig) {
  return await fetchSupabaseJson<AdminUser[]>(
    `${config.supabaseUrl}/rest/v1/profiles?select=id,email,full_name,role,is_active,created_at&order=created_at.desc`,
    {
      method: 'GET',
      headers: supabaseAdminHeaders(config)
    }
  ) || []
}

async function inviteAdminUser(
  event: Parameters<typeof getRequestURL>[0],
  config: AdminConfig,
  body: Record<string, unknown>
) {
  const email = clean(body.email).toLowerCase()
  const fullName = clean(body.full_name || body.fullName)
  const role = normalizeUserRole(body.role)

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email wajib diisi.'
    })
  }

  if (!role) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Role tidak valid.'
    })
  }

  const redirectTo = `${getAppUrl(event, config)}/confirm`
  const invitedUser = await fetchSupabaseJson<SupabaseUser>(
    `${config.supabaseUrl}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: 'POST',
      headers: {
        ...supabaseAdminHeaders(config),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        data: {
          full_name: fullName,
          role
        }
      })
    }
  )

  if (invitedUser?.id) {
    await upsertSupabaseProfile(config, invitedUser.id, {
      email: invitedUser.email || email,
      full_name: fullName,
      role,
      is_active: true
    })
  }

  return {
    id: invitedUser?.id,
    email: invitedUser?.email || email
  }
}

async function updateAdminUser(config: AdminConfig, body: Record<string, unknown>) {
  const targetUserId = clean(body.targetUserId || body.id)
  const patch: Partial<Pick<AdminUser, 'full_name' | 'role'>> = {}

  if (!targetUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'targetUserId wajib diisi.'
    })
  }

  if (body.full_name !== undefined || body.fullName !== undefined) {
    patch.full_name = clean(body.full_name ?? body.fullName)
  }

  if (body.role !== undefined) {
    const role = normalizeUserRole(body.role)

    if (!role) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Role tidak valid.'
      })
    }

    if (role !== 'admin') {
      await assertNotLastActiveAdmin(config, targetUserId, 'Tidak boleh downgrade admin terakhir.')
    }

    patch.role = role
  }

  if (!Object.keys(patch).length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tidak ada data user yang diubah.'
    })
  }

  await patchSupabaseProfile(config, targetUserId, patch)
  return { id: targetUserId }
}

async function setAdminUserActive(
  config: AdminConfig,
  body: Record<string, unknown>,
  isActive: boolean,
  callerUserId: string
) {
  const targetUserId = clean(body.targetUserId || body.id)

  if (!targetUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'targetUserId wajib diisi.'
    })
  }

  if (!isActive) {
    await assertNotLastActiveAdmin(config, targetUserId, 'Tidak boleh menonaktifkan admin terakhir.')
  }

  await patchSupabaseProfile(config, targetUserId, { is_active: isActive })

  return {
    id: targetUserId,
    deactivatedBy: isActive ? undefined : callerUserId
  }
}

async function upsertSupabaseProfile(config: AdminConfig, id: string, values: Record<string, unknown>) {
  await fetchSupabaseJson<null>(`${config.supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...supabaseAdminHeaders(config),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({
      id,
      ...values
    })
  })
}

async function patchSupabaseProfile(config: AdminConfig, id: string, patch: Record<string, unknown>) {
  await fetchSupabaseJson<null>(
    `${config.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseAdminHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(patch)
    }
  )
}

async function assertNotLastActiveAdmin(config: AdminConfig, targetUserId: string, message: string) {
  const admins = await fetchSupabaseJson<Array<Pick<AdminUser, 'id'>>>(
    `${config.supabaseUrl}/rest/v1/profiles?role=eq.admin&is_active=eq.true&select=id`,
    {
      method: 'GET',
      headers: supabaseAdminHeaders(config)
    }
  ) || []

  if (admins.length === 1 && admins[0]?.id === targetUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: message
    })
  }
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

function supabaseUserHeaders(config: AdminConfig, token: string) {
  return {
    'User-Agent': 'MauKaGa-Nuxt-Server/1.0',
    apikey: config.publishableKey,
    Authorization: `Bearer ${token}`
  }
}

function supabaseAdminHeaders(config: AdminConfig) {
  const headers: Record<string, string> = {
    'User-Agent': 'MauKaGa-Nuxt-Server/1.0',
    apikey: config.secretKey
  }

  if (!config.secretKey.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${config.secretKey}`
  }

  return headers
}

function getAppUrl(event: Parameters<typeof getRequestURL>[0], config: AdminConfig) {
  if (config.appUrl) return config.appUrl

  return getRequestURL(event).origin.replace(/\/+$/, '')
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

  return [
    value.message,
    value.error_description,
    value.error,
    value.msg
  ].find((item): item is string => typeof item === 'string' && item.length > 0) || ''
}

function getProxyStatusCode(status: number) {
  if (status === 401 || status === 403) return status
  if (status >= 400 && status < 500) return 400
  return 502
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function clean(value: unknown) {
  return String(value ?? '').trim()
}
