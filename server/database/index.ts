import { drizzle } from 'drizzle-orm/libsql'
import { ensureDatabaseDirectory, resolveDatabaseUrl } from '../../config/database'
import { relations } from './schema'

export function createMaukagaDatabase(databaseUrl = resolveDatabaseUrl()) {
  ensureDatabaseDirectory(databaseUrl)

  return drizzle({
    connection: { url: databaseUrl },
    relations,
  })
}

export type MaukagaDatabase = ReturnType<typeof createMaukagaDatabase>

const globalForDatabase = globalThis as typeof globalThis & {
  __maukagaDb?: MaukagaDatabase
}

export const db = globalForDatabase.__maukagaDb ?? (globalForDatabase.__maukagaDb = createMaukagaDatabase())
export const useDb = () => db
export type Database = MaukagaDatabase