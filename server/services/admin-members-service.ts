import { createError, type H3Event } from 'h3'
import * as z from 'zod'
import { auth } from '../lib/auth'
import {
  adminMembersRepository,
  type AdminMemberRecord,
  type AdminMemberRole,
  type AdminMembersRepository,
} from '../repositories/admin-members-repository'
import { requireAdminSession, type AdminSession } from './admin-auth-service'

const ADMIN_MEMBER_ROLES = ['admin', 'management', 'qrcc'] as const
const DEFAULT_BOOTSTRAP_TOKEN_ENV = 'ADMIN_BOOTSTRAP_TOKEN'

const createMemberSchema = z.object({
  email: z.string().trim().email('Format email tidak valid'),
  full_name: z.string().trim().optional(),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  role: z.enum(ADMIN_MEMBER_ROLES),
})

const updateMemberSchema = z.object({
  full_name: z.string().trim().optional(),
  role: z.enum(ADMIN_MEMBER_ROLES).optional(),
  is_active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Tidak ada data yang diperbarui.',
})

const bootstrapAdminSchema = z.object({
  email: z.email('Format email tidak valid').trim(),
  full_name: z.string().trim().optional(),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  bootstrapToken: z.string().optional(),
})

type CreateMemberBody = z.infer<typeof createMemberSchema>
type UpdateMemberBody = z.infer<typeof updateMemberSchema>
type BootstrapAdminBody = z.infer<typeof bootstrapAdminSchema>

export type AdminMemberResponse = {
  id: string
  email: string
  full_name: string | null
  role: AdminMemberRole
  is_active: boolean
  created_at: string
}

export type AdminMembersServiceDependencies = {
  repository?: AdminMembersRepository
  requireAdminSession?: (event: H3Event) => Promise<AdminSession>
  hashPassword?: (password: string) => Promise<string>
  env?: NodeJS.ProcessEnv
}

const defaultDependencies = {
  repository: adminMembersRepository,
  requireAdminSession,
  hashPassword: hashPasswordWithBetterAuth,
  env: process.env,
} satisfies Required<AdminMembersServiceDependencies>

function resolveDependencies(dependencies: AdminMembersServiceDependencies = {}) {
  return {
    ...defaultDependencies,
    ...dependencies,
  }
}

async function hashPasswordWithBetterAuth(password: string): Promise<string> {
  const context = await auth.$context
  return await context.password.hash(password)
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeName(name: string | undefined, email: string): string {
  return String(name || '').trim() || email
}

function normalizeRole(role: string): AdminMemberRole {
  if (ADMIN_MEMBER_ROLES.includes(role as AdminMemberRole)) return role as AdminMemberRole
  return 'qrcc'
}

function toMemberResponse(record: AdminMemberRecord): AdminMemberResponse {
  return {
    id: record.id,
    email: record.email,
    full_name: record.name || null,
    role: normalizeRole(record.role),
    is_active: record.isActive,
    created_at: record.createdAt.toISOString(),
  }
}

function assertAdminAccess(session: AdminSession): void {
  if (session.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }
}

function assertValidId(id: string): void {
  if (!id.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User tidak valid.',
    })
  }
}

function toHttpError(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) throw error

  if (error instanceof z.ZodError) {
    return createError({
      statusCode: 400,
      statusMessage: error.issues[0]?.message || 'Payload tidak valid.',
    })
  }

  if (isUniqueConstraintError(error)) {
    return createError({
      statusCode: 409,
      statusMessage: 'Email sudah terdaftar.',
    })
  }

  return createError({
    statusCode: 500,
    statusMessage: error instanceof Error ? error.message : String(error),
  })
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '')
  return message.toLowerCase().includes('unique')
}

async function ensureEmailAvailable(
  repository: AdminMembersRepository,
  email: string,
): Promise<void> {
  const existingUser = await repository.findUserByEmail(email)
  if (!existingUser) return

  throw createError({
    statusCode: 409,
    statusMessage: 'Email sudah terdaftar.',
  })
}

async function ensureAdminCanUpdateTarget(
  repository: AdminMembersRepository,
  currentSession: AdminSession,
  currentUser: AdminMemberRecord,
  update: UpdateMemberBody,
): Promise<void> {
  const isSelf = currentUser.id === currentSession.userId
  const willDeactivate = update.is_active === false
  const willDemoteAdmin = currentUser.role === 'admin' && update.role && update.role !== 'admin'

  if (isSelf && (willDeactivate || willDemoteAdmin)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tidak bisa menonaktifkan atau menurunkan role akun sendiri.',
    })
  }

  if (!willDeactivate && !willDemoteAdmin) return

  const remainingAdmins = await repository.countActiveAdmins(currentUser.id)
  if (remainingAdmins > 0) return

  throw createError({
    statusCode: 400,
    statusMessage: 'Minimal harus ada satu admin aktif.',
  })
}

export async function listAdminMembers(
  event: H3Event,
  dependencies: AdminMembersServiceDependencies = {},
): Promise<AdminMemberResponse[]> {
  const resolved = resolveDependencies(dependencies)
  const session = await resolved.requireAdminSession(event)
  assertAdminAccess(session)

  const users = await resolved.repository.listUsers()
  return users.map(toMemberResponse)
}

export async function createAdminMember(
  event: H3Event,
  body: unknown,
  dependencies: AdminMembersServiceDependencies = {},
): Promise<AdminMemberResponse> {
  const resolved = resolveDependencies(dependencies)
  const session = await resolved.requireAdminSession(event)
  assertAdminAccess(session)

  try {
    const parsedBody = createMemberSchema.parse(body)
    return await createMemberFromParsedBody(parsedBody, resolved.repository, resolved.hashPassword)
  } catch (error) {
    throw toHttpError(error)
  }
}

export async function updateAdminMember(
  event: H3Event,
  id: string,
  body: unknown,
  dependencies: AdminMembersServiceDependencies = {},
): Promise<AdminMemberResponse> {
  const resolved = resolveDependencies(dependencies)
  const session = await resolved.requireAdminSession(event)
  assertAdminAccess(session)
  assertValidId(id)

  try {
    const parsedBody = updateMemberSchema.parse(body)
    const currentUser = await resolved.repository.findUserById(id)

    if (!currentUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User tidak ditemukan.',
      })
    }

    await ensureAdminCanUpdateTarget(resolved.repository, session, currentUser, parsedBody)

    const updatedUser = await resolved.repository.updateUser(id, {
      name: parsedBody.full_name,
      role: parsedBody.role,
      isActive: parsedBody.is_active,
    })

    if (!updatedUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User tidak ditemukan.',
      })
    }

    return toMemberResponse(updatedUser)
  } catch (error) {
    throw toHttpError(error)
  }
}

export async function bootstrapFirstAdmin(
  body: unknown,
  dependencies: AdminMembersServiceDependencies = {},
): Promise<AdminMemberResponse> {
  const resolved = resolveDependencies(dependencies)

  try {
    const parsedBody = bootstrapAdminSchema.parse(body)
    const totalUsers = await resolved.repository.countUsers()

    if (totalUsers > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Bootstrap admin sudah tidak tersedia.',
      })
    }

    assertBootstrapToken(parsedBody, resolved.env)

    return await createMemberFromParsedBody(
      {
        email: parsedBody.email,
        full_name: parsedBody.full_name,
        password: parsedBody.password,
        role: 'admin',
      },
      resolved.repository,
      resolved.hashPassword,
    )
  } catch (error) {
    throw toHttpError(error)
  }
}

async function createMemberFromParsedBody(
  body: CreateMemberBody,
  repository: AdminMembersRepository,
  hashPassword: (password: string) => Promise<string>,
): Promise<AdminMemberResponse> {
  const email = normalizeEmail(body.email)
  await ensureEmailAvailable(repository, email)

  const passwordHash = await hashPassword(body.password)
  const createdUser = await repository.createUserWithCredential({
    email,
    name: normalizeName(body.full_name, email),
    role: body.role,
    passwordHash,
  })

  return toMemberResponse(createdUser)
}

function assertBootstrapToken(body: BootstrapAdminBody, env: NodeJS.ProcessEnv): void {
  const expectedToken = env[DEFAULT_BOOTSTRAP_TOKEN_ENV]?.trim()

  if (!expectedToken && env.NODE_ENV !== 'production') return

  if (body.bootstrapToken && body.bootstrapToken === expectedToken) return

  throw createError({
    statusCode: 403,
    statusMessage: 'Bootstrap token tidak valid.',
  })
}
