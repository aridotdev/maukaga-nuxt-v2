type UserRole = 'admin' | 'management' | 'qrcc'

type UserProfile = {
  role: UserRole
  is_active: boolean
  full_name: string | null
}

export function useUserProfile() {
  const supabase = useSupabaseClient()
  const { getSession } = useCurrentSession()

  const profile = useState<UserProfile | null>('user-profile', () => null)

  async function fetchProfile() {
    const session = await getSession()

    if (!session) {
      profile.value = null
      return null
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    const userId = userData.user?.id

    if (userError || !userId) {
      profile.value = null
      return null
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('role, is_active, full_name')
      .eq('id', userId)
      .single()

    if (error || !data) {
      profile.value = null
      return null
    }

    profile.value = data as UserProfile
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
    hasValidRole
  }
}
