export function useAuthBridge() {
  const { getSession } = useCurrentSession()
  const { profile, fetchProfile } = useUserProfile()

  function clearLegacySession() {
    if (import.meta.server) return

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
    const email = session.user?.email || ''
    const name = currentProfile?.full_name || session.user?.name || email || 'User'

    sessionStorage.setItem('admin_nama', name)
    sessionStorage.setItem('admin_username', email || name)

    return session
  }

  return {
    clearLegacySession,
    syncLegacySession,
  }
}
