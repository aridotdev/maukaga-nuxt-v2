import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, type MaukagaDatabase } from '../database'
import { account, user } from '../database/schema'
import { createMaukagaAuth } from '../lib/auth'

export const DEFAULT_ADMIN_SEED_EMAIL = 'admin@maukaga.com'
export const DEFAULT_ADMIN_SEED_NAME = 'administrator'

export interface SeedAdminInput {
  email: string
  name: string
  password: string
}

export interface SeedAdminOptions {
  database?: MaukagaDatabase
}

export interface SeedAdminResult {
  created: boolean
  email: string
  userId: string
}

export async function seedAdminUser(
  input: SeedAdminInput,
  options: SeedAdminOptions = {},
): Promise<SeedAdminResult> {
  const database = options.database ?? db
  const email = normalizeEmail(input.email)
  const name = input.name.trim()

  validateSeedInput(email, name, input.password)

  const existingUser = await findUserByEmail(database, email)
  if (existingUser) {
    const credentialAccount = await findCredentialAccount(database, existingUser.id)
    if (!credentialAccount) {
      throw new Error(
        `User ${email} exists without a credential account; reset or set its password before seeding`,
      )
    }

    await ensureAdminAccess(database, existingUser)

    return {
      created: false,
      email,
      userId: existingUser.id,
    }
  }

  const auth = createMaukagaAuth({
    database,
    disableSignUp: false,
    autoSignIn: false,
  })

  let result: Awaited<ReturnType<typeof auth.api.signUpEmail>>

  try {
    result = await auth.api.signUpEmail({
      body: {
        email,
        name,
        password: input.password,
      },
      headers: new Headers({ host: 'localhost' }),
    })
  } catch (error) {
    const concurrentUser = await findUserByEmail(database, email)
    if (!concurrentUser) throw error

    const credentialAccount = await findCredentialAccount(database, concurrentUser.id)
    if (!credentialAccount) throw error

    await ensureAdminAccess(database, concurrentUser)

    return {
      created: false,
      email,
      userId: concurrentUser.id,
    }
  }

  const seededUser = await findUserById(database, result.user.id)
  if (!seededUser) {
    throw new Error(`Seeded user ${result.user.id} could not be found`)
  }

  await ensureAdminAccess(database, seededUser)

  return {
    created: true,
    email,
    userId: result.user.id,
  }
}

async function findUserByEmail(database: MaukagaDatabase, email: string) {
  const [existingUser] = await database
    .select({
      id: user.id,
      role: user.role,
      isActive: user.isActive,
    })
    .from(user)
    .where(eq(user.email, email))

  return existingUser
}

async function findUserById(database: MaukagaDatabase, userId: string) {
  const [existingUser] = await database
    .select({
      id: user.id,
      role: user.role,
      isActive: user.isActive,
    })
    .from(user)
    .where(eq(user.id, userId))

  return existingUser
}

async function findCredentialAccount(database: MaukagaDatabase, userId: string) {
  const [credentialAccount] = await database
    .select({
      id: account.id,
      password: account.password,
    })
    .from(account)
    .where(and(
      eq(account.userId, userId),
      eq(account.providerId, 'credential'),
    ))

  return credentialAccount?.password ? credentialAccount : null
}

async function ensureAdminAccess(
  database: MaukagaDatabase,
  existingUser: { id: string; role?: string; isActive?: boolean },
) {
  if (existingUser.role === 'admin' && existingUser.isActive) return

  await database
    .update(user)
    .set({
      role: 'admin',
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(user.id, existingUser.id))
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function validateSeedInput(email: string, name: string, password: string) {
  if (!z.email().safeParse(email).success) {
    throw new Error('Admin seed email must be a valid email address')
  }

  if (!name) {
    throw new Error('Admin seed name is required')
  }

  if (password.length < 8) {
    throw new Error('Admin seed password must be at least 8 characters')
  }
}
