export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const isDashboardRoute = to.path === '/dashboard' || to.path.startsWith('/dashboard/')
  const isLoginRoute = to.path === '/login'

  if (!isDashboardRoute && !isLoginRoute) return

  const { getSession } = useCurrentSession()
  const { profile, fetchProfile, hasValidRole, isActive, isManagement } = useUserProfile()
  const session = await getSession()

  if (!session) {
    if (isDashboardRoute) return navigateTo('/login')
    return
  }

  if (!profile.value) {
    await fetchProfile()
  }

  if (!hasValidRole.value || !isActive.value) {
    if (isDashboardRoute) return navigateTo('/403')
    return
  }

  if (isLoginRoute) {
    return navigateTo('/dashboard')
  }

  if (isManagement.value && to.path !== '/dashboard') {
    return navigateTo('/403')
  }
})
