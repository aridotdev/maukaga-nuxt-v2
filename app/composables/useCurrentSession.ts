import { authClient } from '~/utils/auth-client'

type CurrentSession = {
  id: string
  createdAt: Date
  updatedAt: Date
  userId: string
  expiresAt: Date
  token: string
  ipAddress?: string | null
  userAgent?: string | null
  access_token: string
}

type CurrentUser = {
  id: string
  email: string
  name: string
  role?: string
  isActive?: boolean
}

type CurrentSessionResponse = {
  session: CurrentSession
  user: CurrentUser
  access_token: string
} | null

export function useCurrentSession() {
  const sessionState = authClient.useSession()

  const session = computed<CurrentSessionResponse>(() => {
    const data = sessionState.value.data
    if (!data?.session || !data.user) return null

    return {
      session: {
        ...data.session,
        access_token: data.session.token,
      },
      user: data.user as CurrentUser,
      access_token: data.session.token,
    }
  })

  const user = computed(() => session.value?.user ?? null)

  async function getSession() {
    if (!sessionState.value.data && !sessionState.value.isPending) {
      await sessionState.value.refetch()
    }

    return session.value
  }

  async function refreshSession() {
    await sessionState.value.refetch()
    return session.value
  }

  return {
    session,
    user,
    getSession,
    refreshSession,
  }
}
