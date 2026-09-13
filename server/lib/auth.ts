import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db, type MaukagaDatabase } from '../database'
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

export interface CreateMaukagaAuthOptions {
  database?: MaukagaDatabase
  disableSignUp?: boolean
  autoSignIn?: boolean
}

export function createMaukagaAuth(options: CreateMaukagaAuthOptions = {}) {
  return betterAuth({
    appName: envString('NUXT_PUBLIC_APP_NAME') ?? 'Mau KaGa',
    baseURL: envString('BETTER_AUTH_URL') ?? envString('NUXT_APP_URL') ?? envString('NUXT_PUBLIC_APP_URL'),
    basePath: '/api/auth',
    trustedOrigins: envList('BETTER_AUTH_TRUSTED_ORIGINS'),
    database: drizzleAdapter(options.database ?? db, {
      provider: 'sqlite',
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: options.disableSignUp ?? true,
      autoSignIn: options.autoSignIn,
      minPasswordLength: 8,
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          input: false,
          defaultValue: 'admin',
        },
        isActive: {
          type: 'boolean',
          input: false,
          defaultValue: true,
        },
      },
    },
    advanced: {
      cookiePrefix: 'maukaga-auth',
    },
  })
}

export const auth = createMaukagaAuth()

export type Auth = typeof auth
