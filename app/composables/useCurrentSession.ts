export function useCurrentSession() {
  const supabase = useSupabaseClient()
  const sessionState = useSupabaseSession()

  async function getSession() {
    if (sessionState.value) return sessionState.value

    const { data, error } = await supabase.auth.getSession()
    if (error) throw error

    sessionState.value = data.session
    return data.session
  }

  return { session: sessionState, getSession }
}