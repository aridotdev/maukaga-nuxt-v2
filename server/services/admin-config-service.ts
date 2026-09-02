import { createError, type H3Event } from 'h3'
import {
  localConfigRepository,
  type LocalConfigRecord,
  type LocalConfigRepository,
} from '../repositories/config-repository'
import { requireAdminSession, type AdminSession } from './admin-auth-service'

export type AdminConfigResponse = {
  key: string
  value: string
  updated_at: string
}

export type AdminConfigServiceDependencies = {
  repository?: LocalConfigRepository
  requireAdminSession?: (event: H3Event) => Promise<AdminSession>
}

const defaultDependencies = {
  repository: localConfigRepository,
  requireAdminSession,
} satisfies Required<AdminConfigServiceDependencies>

function resolveDependencies(dependencies: AdminConfigServiceDependencies = {}) {
  return {
    ...defaultDependencies,
    ...dependencies,
  }
}

function clean(value: unknown) {
  return String(value || '').trim()
}

function toIso(value: unknown) {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()

  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toISOString()
}

function badRequest(message: string) {
  return createError({
    statusCode: 400,
    statusMessage: message,
  })
}

function toHttpError(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) throw error

  return createError({
    statusCode: 500,
    statusMessage: error instanceof Error ? error.message : String(error),
  })
}

function assertAdminAccess(session: AdminSession): void {
  if (session.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }
}

function getBodyRecord(body: unknown) {
  if (!body || typeof body !== 'object') return {}
  return body as Record<string, unknown>
}

function normalizeConfigValues(body: unknown) {
  const input = getBodyRecord(body)
  const values = getBodyRecord(input.values)

  if (Object.keys(values).length) return values

  const key = clean(input.key)
  if (!key) throw badRequest('Key config wajib diisi.')

  return {
    [key]: input.value ?? '',
  }
}

function toConfigResponse(record: LocalConfigRecord): AdminConfigResponse {
  return {
    key: record.key,
    value: String(record.value || ''),
    updated_at: toIso(record.updatedAt),
  }
}

export async function listAdminConfig(
  event: H3Event,
  dependencies: AdminConfigServiceDependencies = {},
): Promise<AdminConfigResponse[]> {
  const resolved = resolveDependencies(dependencies)
  const session = await resolved.requireAdminSession(event)
  assertAdminAccess(session)

  try {
    const rows = await resolved.repository.listConfig()
    return rows.map(toConfigResponse)
  } catch (error) {
    throw toHttpError(error)
  }
}

export async function saveAdminConfig(
  event: H3Event,
  body: unknown,
  dependencies: AdminConfigServiceDependencies = {},
): Promise<AdminConfigResponse[]> {
  const resolved = resolveDependencies(dependencies)
  const session = await resolved.requireAdminSession(event)
  assertAdminAccess(session)

  try {
    await resolved.repository.setValues(normalizeConfigValues(body))
    const rows = await resolved.repository.listConfig()
    return rows.map(toConfigResponse)
  } catch (error) {
    throw toHttpError(error)
  }
}
