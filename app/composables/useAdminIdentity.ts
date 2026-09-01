export function useAdminIdentity() {
  const { user: sessionUser } = useCurrentSession()
  const { profile } = useUserProfile()

  const displayName = computed(() => (
    profile.value?.full_name
    || sessionUser.value?.name
    || sessionUser.value?.email
    || 'Admin'
  ))

  const displayEmail = computed(() => sessionUser.value?.email || '')

  return {
    displayName,
    displayEmail,
  }
}
