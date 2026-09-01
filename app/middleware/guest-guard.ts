export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const { getSession } = useCurrentSession()
  const session = await getSession()

  if (!session) return

  const { profile, fetchProfile, hasValidRole, isActive } = useUserProfile()

  if (!profile.value) {
    await fetchProfile()
  }

  if (hasValidRole.value && isActive.value) {
    return navigateTo('/dashboard')
  }
})
