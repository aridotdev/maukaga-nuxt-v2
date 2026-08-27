export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const { profile, fetchProfile, isAdmin, isManagement } = useUserProfile()

  if (!profile.value) {
    await fetchProfile()
  }

  const path = to.path

  if (path.startsWith('/dashboard/settings/members')) {
    if (!isAdmin.value) return navigateTo('/403')
    return
  }

  if (isManagement.value) {
    const allowed =
      path === '/dashboard' ||
      path === '/dashboard/pengajuan' ||
      path.startsWith('/dashboard/pengajuan/')

    if (!allowed) return navigateTo('/403')
  }
})