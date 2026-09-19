import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import * as z from 'zod'
import { useDb, type MaukagaDatabase } from '../database'
import {
  countActiveAdminRecords,
  findMemberByEmail,
  findMemberRecord,
  insertMemberAuditLog,
  insertMemberRecord,
  listMemberRecords,
  deleteMemberSessions,
  updateMemberRecord,
} from '../repositories/member-repository'
import { auth } from '../lib/auth'

export const MEMBER_ROLES = ['admin', 'management', 'qrcc'] as const
export type MemberRole = typeof MEMBER_ROLES[number]

export const createMemberInputSchema = z.object({
  email: z.string().trim().pipe(z.email('Format email tidak valid')),
  name: z.string().trim().max(120, 'Nama terlalu panjang').optional().default(''),
  password: z.string().min(8, 'Password minimal 8 karakter').max(200, 'Password terlalu panjang'),
  role: z.enum(MEMBER_ROLES),
})

export const updateMemberInputSchema = z.object({
  name: z.string().trim().max(120, 'Nama terlalu panjang').optional(),
  role: z.enum(MEMBER_ROLES).optional(),
  isActive: z.boolean().optional(),
}).refine(input => Object.keys(input).length > 0, {
  message: 'Tidak ada data yang diperbarui',
})

export type MemberServiceOptions = {
  database?: MaukagaDatabase
  actorId: string
  hashPassword?: (password: string) => Promise<string>
  now?: Date
}

export type MemberDto = {
  id: string
  email: string
  name: string
  role: MemberRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type MemberListDto = {
  rows: MemberDto[]
  summary: {
    total: number
    active: number
    inactive: number
    admins: number
  }
}

export async function listMembers(database = useDb()): Promise<MemberListDto> {
  const rows = (await listMemberRecords(database)).map(mapMemberDto)

  return {
    rows,
    summary: {
      total: rows.length,
      active: rows.filter(row => row.isActive).length,
      inactive: rows.filter(row => !row.isActive).length,
      admins: rows.filter(row => row.role === 'admin' && row.isActive).length,
    },
  }
}

export async function createMember(
  input: unknown,
  options: MemberServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = normalizeCreateInput(input)
  const hashPassword = options.hashPassword ?? hashPasswordWithBetterAuth
  const now = options.now ?? new Date()

  try {
    return await database.transaction(async (tx) => {
      const existing = await findMemberByEmail(tx, data.email)
      if (existing) throw duplicateEmailError()

      const created = await insertMemberRecord(tx, {
        id: randomUUID(),
        email: data.email,
        name: data.name || data.email,
        role: data.role,
        passwordHash: await hashPassword(data.password),
        createdAt: now,
      })

      await insertMemberAuditLog(tx, {
        actorId: options.actorId,
        action: 'member.create',
        entityType: 'user',
        entityId: created.id,
        metadataJson: JSON.stringify({
          email: created.email,
          role: created.role,
        }),
      })

      return mapMemberDto(created)
    })
  } catch (error) {
    throw normalizeMemberDatabaseError(error)
  }
}

export async function updateMember(
  id: string,
  input: unknown,
  options: MemberServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = updateMemberInputSchema.parse(input)

  try {
    return await database.transaction(async (tx) => {
      const current = await findMemberRecord(tx, id)
      if (!current) throw notFoundMemberError()

      await validateMemberUpdate(tx, current, data, options.actorId)

      const updated = await updateMemberRecord(tx, id, {
        name: data.name === undefined ? undefined : normalizeName(data.name, current.email),
        role: data.role,
        isActive: data.isActive,
      })
      if (!updated) throw notFoundMemberError()

      if (data.isActive === false) {
        await deleteMemberSessions(tx, id)
      }

      await insertMemberAuditLog(tx, {
        actorId: options.actorId,
        action: data.isActive === undefined ? 'member.update' : 'member.status',
        entityType: 'user',
        entityId: id,
        metadataJson: JSON.stringify({
          before: {
            name: current.name,
            role: current.role,
            isActive: current.isActive,
          },
          after: {
            name: updated.name,
            role: updated.role,
            isActive: updated.isActive,
          },
        }),
      })

      return mapMemberDto(updated)
    })
  } catch (error) {
    throw normalizeMemberDatabaseError(error)
  }
}

async function hashPasswordWithBetterAuth(password: string) {
  const context = await auth.$context
  return context.password.hash(password)
}

function normalizeCreateInput(input: unknown) {
  const data = createMemberInputSchema.parse(input)
  const email = data.email.trim().toLowerCase()

  return {
    ...data,
    email,
    name: normalizeName(data.name, email),
  }
}

function normalizeName(value: string, email: string) {
  return value.trim().replace(/\s+/g, ' ') || email
}

function mapMemberDto(record: {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): MemberDto {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: normalizeRole(record.role),
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function normalizeRole(value: string): MemberRole {
  return MEMBER_ROLES.includes(value as MemberRole)
    ? value as MemberRole
    : 'management'
}

async function validateMemberUpdate(
  database: Parameters<typeof countActiveAdminRecords>[0],
  current: {
    id: string
    role: string
    isActive: boolean
  },
  input: z.infer<typeof updateMemberInputSchema>,
  actorId: string,
) {
  const isSelf = current.id === actorId
  const willDeactivate = input.isActive === false
  const willDemote = current.role === 'admin'
    && input.role !== undefined
    && input.role !== 'admin'

  if (isSelf && (willDeactivate || willDemote)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Akun sendiri tidak dapat dinonaktifkan atau diturunkan dari admin',
    })
  }

  if (!willDeactivate && !willDemote) return

  if (current.role !== 'admin' || !current.isActive) return

  const remainingAdmins = await countActiveAdminRecords(database, current.id)
  if (remainingAdmins === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Minimal harus ada satu admin aktif',
    })
  }
}

function duplicateEmailError() {
  return createError({
    statusCode: 409,
    statusMessage: 'Email sudah terdaftar',
  })
}

function notFoundMemberError() {
  return createError({
    statusCode: 404,
    statusMessage: 'Anggota tidak ditemukan',
  })
}

function normalizeMemberDatabaseError(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) return error
  if (error instanceof z.ZodError) return error

  if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
    return duplicateEmailError()
  }

  return error
}
