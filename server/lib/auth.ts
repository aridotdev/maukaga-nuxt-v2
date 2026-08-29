import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../database'
import * as authSchema from '../database/schema/user'

function envString(name: string) {
  const value = process.env[name]?.trim()
  return value || undefined
}

function envList(name: string) {
  return envString(name)
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export const auth = betterAuth({
  appName: envString('NUXT_PUBLIC_APP_NAME') ?? 'Mau KaGa',
  baseURL: envString('BETTER_AUTH_URL') ?? envString('NUXT_APP_URL') ?? envString('NUXT_PUBLIC_APP_URL'),
  basePath: '/api/auth',
  trustedOrigins: envList('BETTER_AUTH_TRUSTED_ORIGINS'),
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
  },
  advanced: {
    cookiePrefix: 'maukaga-auth',
  },
})

export type Auth = typeof auth
