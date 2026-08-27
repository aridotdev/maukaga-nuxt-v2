export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const isDashboardRoute = to.path === '/dashboard' || to.path.startsWith('/dashboard/')
  const isLoginRoute = to.path === '/login'

  if (!isDashboardRoute && !isLoginRoute) return

  const { getSession } = useCurrentSession()
  const { profile, fetchProfile, hasValidRole, isActive, isAdmin, isManagement } = useUserProfile()
  const { clearLegacySession, syncLegacySession } = useAuthBridge()
  const session = await getSession()

  if (!session) {
    clearLegacySession()
    if (isDashboardRoute) return navigateTo('/login')
    return
  }

  if (!profile.value) {
    await fetchProfile()
  }

  if (!hasValidRole.value || !isActive.value) {
    clearLegacySession()
    if (isDashboardRoute) return navigateTo('/403')
    return
  }

  await syncLegacySession()

  if (isLoginRoute) {
    return navigateTo('/dashboard')
  }

  if (to.path.startsWith('/dashboard/settings/members')) {
    if (!isAdmin.value) return navigateTo('/403')
    return
  }

  if (isManagement.value) {
    const allowed =
      to.path === '/dashboard' ||
      to.path === '/dashboard/pengajuan' ||
      to.path.startsWith('/dashboard/pengajuan/')

    if (!allowed) return navigateTo('/403')
  }
})
