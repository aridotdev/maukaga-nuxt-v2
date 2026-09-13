export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const { profile, fetchProfile } = useUserProfile()

  if (!profile.value) {
    await fetchProfile()
  }
})
