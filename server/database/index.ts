import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/libsql'
import { resolveDatabaseUrl } from '../../config/database'
import { relations } from './schema'

function getLocalDatabasePath(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) return null

  const rawPath = databaseUrl.slice('file:'.length)
  if (!rawPath || rawPath === ':memory:') return null

  return databaseUrl.startsWith('file://') ? fileURLToPath(databaseUrl) : rawPath
}

function ensureLocalDatabaseDirectory(databaseUrl: string) {
  const localPath = getLocalDatabasePath(databaseUrl)
  if (!localPath) return

  mkdirSync(dirname(resolve(localPath)), { recursive: true })
}

function createDatabase() {
  const databaseUrl = resolveDatabaseUrl()
  ensureLocalDatabaseDirectory(databaseUrl)

  return drizzle({
    connection: { url: databaseUrl },
    relations,
  })
}

type MaukagaDatabase = ReturnType<typeof createDatabase>

declare global {
  var __maukagaDb: MaukagaDatabase | undefined
}

export const db = globalThis.__maukagaDb ?? (globalThis.__maukagaDb = createDatabase())
export type Database = MaukagaDatabase
