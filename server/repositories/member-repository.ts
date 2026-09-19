import { randomUUID } from 'node:crypto'
import { and, asc, count, eq, ne } from 'drizzle-orm'
import type { MaukagaDatabase } from '../database'
import {
  account,
  auditLog,
  session,
  user,
  type InsertAuditLog,
  type User,
} from '../database/schema'

type TransactionCallback = Parameters<MaukagaDatabase['transaction']>[0]
export type MemberTransaction = Parameters<TransactionCallback>[0]
export type MemberDatabase = MaukagaDatabase | MemberTransaction

export type MemberRecord = Pick<
  User,
  'id' | 'email' | 'name' | 'role' | 'isActive' | 'createdAt' | 'updatedAt'
>

export type CreateMemberRecordInput = {
  id: string
  email: string
  name: string
  role: string
  passwordHash: string
  createdAt: Date
}

export type UpdateMemberRecordInput = {
  name?: string
  role?: string
  isActive?: boolean
}

const memberSelection = {
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
} satisfies Record<keyof MemberRecord, unknown>

export async function listMemberRecords(database: MemberDatabase) {
  return database
    .select(memberSelection)
    .from(user)
    .orderBy(asc(user.email))
}

export async function findMemberRecord(database: MemberDatabase, id: string) {
  const [record] = await database
    .select(memberSelection)
    .from(user)
    .where(eq(user.id, id))

  return record ?? null
}

export async function findMemberByEmail(
  database: MemberDatabase,
  email: string,
) {
  const [record] = await database
    .select(memberSelection)
    .from(user)
    .where(eq(user.email, email))

  return record ?? null
}

export async function countMemberRecords(database: MemberDatabase) {
  const [record] = await database
    .select({ value: count() })
    .from(user)

  return Number(record?.value ?? 0)
}

export async function countActiveAdminRecords(
  database: MemberDatabase,
  excludeId?: string,
) {
  const conditions = [
    eq(user.role, 'admin'),
    eq(user.isActive, true),
  ]

  if (excludeId) conditions.push(ne(user.id, excludeId))

  const [record] = await database
    .select({ value: count() })
    .from(user)
    .where(and(...conditions))

  return Number(record?.value ?? 0)
}

export async function insertMemberRecord(
  database: MemberDatabase,
  input: CreateMemberRecordInput,
) {
  await database.insert(user).values({
    id: input.id,
    email: input.email,
    name: input.name,
    role: input.role,
    isActive: true,
    emailVerified: true,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  })

  await database.insert(account).values({
    id: randomUUID(),
    issuer: 'local:credential',
    accountId: input.id,
    providerId: 'credential',
    userId: input.id,
    password: input.passwordHash,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  })

  const record = await findMemberRecord(database, input.id)
  if (!record) throw new Error('Anggota gagal dibuat')

  return record
}

export async function updateMemberRecord(
  database: MemberDatabase,
  id: string,
  input: UpdateMemberRecordInput,
) {
  const [record] = await database
    .update(user)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(user.id, id))
    .returning()

  return record ? findMemberRecord(database, record.id) : null
}

export async function deleteMemberSessions(
  database: MemberDatabase,
  userId: string,
) {
  await database
    .delete(session)
    .where(eq(session.userId, userId))
}

export async function insertMemberAuditLog(
  database: MemberDatabase,
  values: InsertAuditLog,
) {
  await database.insert(auditLog).values(values)
}
