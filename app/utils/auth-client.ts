import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'
import type { Auth } from '../../server/lib/auth'

const authBaseURL = globalThis.location?.origin ?? 'http://localhost:3000'

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  basePath: '/api/auth',
  plugins: [inferAdditionalFields<Auth>()],
})

export type AuthClient = typeof authClient
