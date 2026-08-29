import { createError, getHeader, type H3Event } from 'h3'
import {
  AdminAuthRepositoryError,
  fetchSupabaseAdminProfile,
  fetchSupabaseAuthUser,
  type AdminAuthRuntimeConfig,
} from '../repositories/admin-auth-repository'

type AdminRole = 'admin' | 'management' | 'qrcc'

export type AdminSession = {
  token: string
  userId: string
  email?: string
  role: AdminRole
  fullName: string | null
}

type AdminAuthEventContext = H3Event['context'] & {
  adminSessionPromise?: Promise<AdminSession>
}

export type AdminAuthDependencies = {
  fetchAuthUser?: typeof fetchSupabaseAuthUser
  fetchAdminProfile?: typeof fetchSupabaseAdminProfile
  getRuntimeConfig?: (event: H3Event) => AdminAuthRuntimeConfig
}

const ADMIN_ROLES = new Set<AdminRole>(['admin', 'management', 'qrcc'])

const defaultAdminAuthDependencies = {
  fetchAuthUser: fetchSupabaseAuthUser,
  fetchAdminProfile: fetchSupabaseAdminProfile,
  getRuntimeConfig: (event: H3Event) => useRuntimeConfig(event),
} satisfies Required<AdminAuthDependencies>

export function requireAdminBearerToken(event: H3Event) {
  const authorization = String(getHeader(event, 'authorization') || '')
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  return token
}

function isAdminRole(value: string): value is AdminRole {
  return ADMIN_ROLES.has(value as AdminRole)
}

function toAuthError(error: unknown) {
  if (error instanceof AdminAuthRepositoryError) {
    const statusCode = error.statusCode === 401 || error.statusCode === 403 ? 401 : 502

    return createError({
      statusCode,
      statusMessage: statusCode === 401 ? 'Unauthorized' : error.message,
    })
  }

  return createError({
    statusCode: 502,
    statusMessage: error instanceof Error ? error.message : String(error),
  })
}

function resolveAdminAuthDependencies(dependencies: AdminAuthDependencies = {}) {
  return {
    ...defaultAdminAuthDependencies,
    ...dependencies,
  }
}

async function validateAdminSession(
  event: H3Event,
  token: string,
  dependencies: Required<AdminAuthDependencies>,
): Promise<AdminSession> {
  try {
    const runtimeConfig = dependencies.getRuntimeConfig(event)
    const user = await dependencies.fetchAuthUser(runtimeConfig, token)

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    }

    const profile = await dependencies.fetchAdminProfile(runtimeConfig, token, user.id)

    if (!profile || !profile.is_active || !isAdminRole(profile.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
      })
    }

    return {
      token,
      userId: user.id,
      email: user.email,
      role: profile.role,
      fullName: profile.full_name,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw toAuthError(error)
  }
}

export async function requireAdminSession(event: H3Event) {
  return await requireAdminSessionWithDependencies(event)
}

export async function requireAdminSessionWithDependencies(
  event: H3Event,
  dependencies: AdminAuthDependencies = {},
) {
  const context = event.context as AdminAuthEventContext

  if (!context.adminSessionPromise) {
    const resolvedDependencies = resolveAdminAuthDependencies(dependencies)
    const token = requireAdminBearerToken(event)
    context.adminSessionPromise = validateAdminSession(event, token, resolvedDependencies)
  }

  return await context.adminSessionPromise
}
