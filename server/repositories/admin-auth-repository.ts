import { eq } from 'drizzle-orm'
import { getHeader, type H3Event } from 'h3'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../lib/auth'
import { db } from '../database'
import { session as authSession, user as authUser } from '../database/schema/user'

export type AdminRole = 'admin' | 'management' | 'qrcc'

export type AdminAuthSessionUser = {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
}

export type AdminAuthSession = {
  token: string
  user: AdminAuthSessionUser
}

function normalizeRole(value: unknown) {
  return String(value || '').trim()
}

function resolveBearerToken(event: H3Event) {
  const authorization = String(getHeader(event, 'authorization') || '')
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

async function fetchSessionFromBetterAuth(event: H3Event): Promise<AdminAuthSession | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(event.node.req.headers),
  })

  if (!session?.session || !session.user) return null

  return {
    token: session.session.token,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: normalizeRole((session.user as Record<string, unknown>).role) || 'admin',
      isActive: (session.user as Record<string, unknown>).isActive !== false,
    },
  }
}

async function fetchSessionFromBearerToken(token: string): Promise<AdminAuthSession | null> {
  if (!token) return null

  const rows = await db
    .select({
      token: authSession.token,
      userId: authUser.id,
      email: authUser.email,
      name: authUser.name,
      role: authUser.role,
      isActive: authUser.isActive,
    })
    .from(authSession)
    .innerJoin(authUser, eq(authSession.userId, authUser.id))
    .where(eq(authSession.token, token))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return {
    token: row.token,
    user: {
      id: row.userId,
      email: row.email,
      name: row.name,
      role: normalizeRole(row.role) || 'admin',
      isActive: row.isActive !== false,
    },
  }
}

export async function resolveAdminSession(event: H3Event) {
  return await fetchSessionFromBetterAuth(event)
    || await fetchSessionFromBearerToken(resolveBearerToken(event))
}
