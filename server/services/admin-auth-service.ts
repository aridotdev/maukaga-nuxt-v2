import { createError, type H3Event } from 'h3'
import {
  resolveAdminSession,
  type AdminAuthSession,
  type AdminRole,
} from '../repositories/admin-auth-repository'

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
  resolveSession?: (event: H3Event) => Promise<AdminAuthSession | null>
}

const ADMIN_ROLES = new Set<AdminRole>(['admin', 'management', 'qrcc'])

const defaultAdminAuthDependencies = {
  resolveSession: resolveAdminSession,
} satisfies Required<AdminAuthDependencies>

function isAdminRole(value: string): value is AdminRole {
  return ADMIN_ROLES.has(value as AdminRole)
}

function toAuthError(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) throw error

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
  dependencies: Required<AdminAuthDependencies>,
): Promise<AdminSession> {
  try {
    const session = await dependencies.resolveSession(event)

    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    }

    const role = String(session.user.role || '').trim()

    if (!session.user.isActive || !isAdminRole(role)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
      })
    }

    return {
      token: session.token,
      userId: session.user.id,
      email: session.user.email,
      role,
      fullName: session.user.name || null,
    }
  } catch (error) {
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
    context.adminSessionPromise = validateAdminSession(event, resolvedDependencies)
  }

  return await context.adminSessionPromise
}
