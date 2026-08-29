import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({
  baseURL: '/api/auth',
})

export type AuthClient = typeof authClient
