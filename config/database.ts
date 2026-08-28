import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_DATABASE_URL = 'file:.data/maukaga.db'
export const DEFAULT_ARCHIVE_FILE_DIRECTORY = 'public/arsip_file'
export const DEFAULT_ARCHIVE_PUBLIC_BASE_PATH = '/arsip_file'

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return (env.DATABASE_URL || env.NUXT_DATABASE_URL || DEFAULT_DATABASE_URL).trim()
}

export function getLocalDatabasePath(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) return null

  const rawPath = databaseUrl.slice('file:'.length)
  if (!rawPath || rawPath === ':memory:') return null

  return databaseUrl.startsWith('file://') ? fileURLToPath(databaseUrl) : rawPath
}

export function ensureDatabaseDirectory(databaseUrl = resolveDatabaseUrl()) {
  const localPath = getLocalDatabasePath(databaseUrl)
  if (!localPath) return null

  const absolutePath = resolve(localPath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  return absolutePath
}

export function resolveArchiveFileDirectory(env: NodeJS.ProcessEnv = process.env) {
  return (env.ARCHIVE_FILE_DIRECTORY || env.NUXT_ARCHIVE_FILE_DIRECTORY || DEFAULT_ARCHIVE_FILE_DIRECTORY).trim()
}

export function resolveArchivePublicBasePath(env: NodeJS.ProcessEnv = process.env) {
  const value = (env.NUXT_PUBLIC_ARCHIVE_FILE_BASE_PATH || DEFAULT_ARCHIVE_PUBLIC_BASE_PATH).trim()
  if (!value) return DEFAULT_ARCHIVE_PUBLIC_BASE_PATH
  return value.startsWith('/') ? value : `/${value}`
}