import { randomUUID } from 'node:crypto'
import { and, asc, count, eq, ne, type SQL } from 'drizzle-orm'
import { db, type Database } from '../database'
import { account, user } from '../database/schema/user'

const CREDENTIAL_PROVIDER_ID = 'credential'
const CREDENTIAL_ISSUER = 'local:credential'

export type AdminMemberRole = 'admin' | 'management' | 'qrcc'

export type AdminMemberRecord = {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: Date
}

export type CreateAdminMemberInput = {
  email: string
  name: string
  role: AdminMemberRole
  passwordHash: string
}

export type UpdateAdminMemberInput = {
  name?: string
  role?: AdminMemberRole
  isActive?: boolean
}

const memberSelection = {
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
}

export type AdminMembersRepository = {
  countUsers: () => Promise<number>
  countActiveAdmins: (excludeUserId?: string) => Promise<number>
  listUsers: () => Promise<AdminMemberRecord[]>
  findUserById: (id: string) => Promise<AdminMemberRecord | null>
  findUserByEmail: (email: string) => Promise<AdminMemberRecord | null>
  createUserWithCredential: (input: CreateAdminMemberInput) => Promise<AdminMemberRecord>
  updateUser: (id: string, input: UpdateAdminMemberInput) => Promise<AdminMemberRecord | null>
}

export function createAdminMembersRepository(database: Database = db): AdminMembersRepository {
  async function countUsers(): Promise<number> {
    const rows = await database.select({ value: count() }).from(user)
    return Number(rows[0]?.value || 0)
  }

  async function countActiveAdmins(excludeUserId?: string): Promise<number> {
    const clauses: SQL[] = [
      eq(user.role, 'admin'),
      eq(user.isActive, true),
    ]

    if (excludeUserId) {
      clauses.push(ne(user.id, excludeUserId))
    }

    const rows = await database
      .select({ value: count() })
      .from(user)
      .where(and(...clauses))

    return Number(rows[0]?.value || 0)
  }

  async function listUsers(): Promise<AdminMemberRecord[]> {
    return await database
      .select(memberSelection)
      .from(user)
      .orderBy(asc(user.email))
  }

  async function findUserById(id: string): Promise<AdminMemberRecord | null> {
    const rows = await database
      .select(memberSelection)
      .from(user)
      .where(eq(user.id, id))
      .limit(1)

    return rows[0] ?? null
  }

  async function findUserByEmail(email: string): Promise<AdminMemberRecord | null> {
    const rows = await database
      .select(memberSelection)
      .from(user)
      .where(eq(user.email, email))
      .limit(1)

    return rows[0] ?? null
  }

  async function createUserWithCredential(input: CreateAdminMemberInput): Promise<AdminMemberRecord> {
    const userId = randomUUID()
    const now = new Date()

    await database.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        email: input.email,
        name: input.name,
        role: input.role,
        isActive: true,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })

      await tx.insert(account).values({
        id: randomUUID(),
        userId,
        providerId: CREDENTIAL_PROVIDER_ID,
        issuer: CREDENTIAL_ISSUER,
        accountId: userId,
        password: input.passwordHash,
        createdAt: now,
        updatedAt: now,
      })
    })

    const createdUser = await findUserById(userId)
    if (!createdUser) throw new Error('User gagal dibuat.')

    return createdUser
  }

  async function updateUser(id: string, input: UpdateAdminMemberInput): Promise<AdminMemberRecord | null> {
    await database
      .update(user)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(user.id, id))

    return await findUserById(id)
  }

  return {
    countUsers,
    countActiveAdmins,
    listUsers,
    findUserById,
    findUserByEmail,
    createUserWithCredential,
    updateUser,
  }
}

export const adminMembersRepository = createAdminMembersRepository()
