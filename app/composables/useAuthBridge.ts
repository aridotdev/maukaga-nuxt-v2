export function useAuthBridge() {
  const { getSession } = useCurrentSession()
  const user = useSupabaseUser()
  const { profile, fetchProfile } = useUserProfile()

  function clearLegacySession() {
    if (import.meta.server) return

    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_nama')
    sessionStorage.removeItem('admin_username')
  }

  async function syncLegacySession() {
    if (import.meta.server) return null

    const session = await getSession()
    if (!session) {
      clearLegacySession()
      return null
    }

    const currentProfile = profile.value || await fetchProfile()
    const email = user.value?.email || ''
    const name = currentProfile?.full_name || email || 'User'

    sessionStorage.setItem('admin_token', session.access_token)
    sessionStorage.setItem('admin_nama', name)
    sessionStorage.setItem('admin_username', email || name)

    return session
  }

  return {
    clearLegacySession,
    syncLegacySession
  }
}
