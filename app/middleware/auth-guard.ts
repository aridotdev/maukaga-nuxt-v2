export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const { getSession } = useCurrentSession()
  const { clearLegacySession, syncLegacySession } = useAuthBridge()
  const session = await getSession()

  if (!session) {
    clearLegacySession()
    return navigateTo('/login')
  }

  const { profile, fetchProfile, hasValidRole, isActive } = useUserProfile()

  if (!profile.value) {
    await fetchProfile()
  }

  if (!hasValidRole.value || !isActive.value) {
    clearLegacySession()
    return navigateTo('/403')
  }

  await syncLegacySession()
})
