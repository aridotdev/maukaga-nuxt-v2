type UserRole = 'admin' | 'management' | 'qrcc'

type UserProfile = {
  role: UserRole
  is_active: boolean
  full_name: string | null
}

type SessionShape = {
  user?: {
    role?: unknown
    isActive?: boolean
    name?: string | null
  } | null
} | null

function normalizeRole(value: unknown): UserRole | null {
  const role = String(value || '').trim()
  return ['admin', 'management', 'qrcc'].includes(role) ? role as UserRole : null
}

function resolveProfileFromSession(session: SessionShape): UserProfile | null {
  if (!session?.user) return null

  const role = normalizeRole(session.user.role)
  if (!role) return null

  return {
    role,
    is_active: session.user.isActive !== false,
    full_name: session.user.name || null,
  }
}

export function useUserProfile() {
  const { getSession } = useCurrentSession()
  const profile = useState<UserProfile | null>('user-profile', () => null)

  async function fetchProfile() {
    const session = await getSession()
    profile.value = resolveProfileFromSession(session)
    return profile.value
  }

  const isAdmin = computed(() => profile.value?.role === 'admin')
  const isManagement = computed(() => profile.value?.role === 'management')
  const isQrcc = computed(() => profile.value?.role === 'qrcc')
  const isActive = computed(() => profile.value?.is_active === true)
  const hasValidRole = computed(() =>
    ['admin', 'management', 'qrcc'].includes(profile.value?.role ?? '')
  )

  return {
    profile,
    fetchProfile,
    isAdmin,
    isManagement,
    isQrcc,
    isActive,
    hasValidRole,
  }
}
