import type { H3Event } from 'h3'
import { createError, getRequestHeaders } from 'h3'
import { auth } from '../lib/auth'

export const API_ROLES = ['admin', 'qrcc', 'management'] as const
export type ApiRole = typeof API_ROLES[number]

export interface ApiSessionUser {
  id: string
  email: string
  name: string
  role: ApiRole
  isActive: boolean
}

export async function requireApiSession(
  event: H3Event,
  allowedRoles: ApiRole[] = [...API_ROLES],
) {
  const session = await auth.api.getSession({
    headers: new Headers(
      Object.entries(getRequestHeaders(event))
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
  })

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = normalizeApiUser(session.user)
  if (!user || !user.isActive) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  if (!allowedRoles.includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  return {
    session: session.session,
    user,
  }
}

function normalizeApiUser(user: {
  id: string
  email: string
  name: string
  role?: unknown
  isActive?: unknown
}): ApiSessionUser | null {
  const role = String(user.role || '').trim()
  if (!isApiRole(role)) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    isActive: user.isActive !== false,
  }
}

function isApiRole(value: string): value is ApiRole {
  return API_ROLES.includes(value as ApiRole)
}
