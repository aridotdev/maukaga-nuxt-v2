import type { H3Event } from 'h3'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../lib/auth'

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

export async function resolveAdminSession(event: H3Event) {
  return await fetchSessionFromBetterAuth(event)
}
