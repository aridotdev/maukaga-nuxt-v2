import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'
import type { Auth } from '../../server/lib/auth'

export const authClient = createAuthClient({
  baseURL: '/api/auth',
  plugins: [inferAdditionalFields<Auth>()],
})

export type AuthClient = typeof authClient
