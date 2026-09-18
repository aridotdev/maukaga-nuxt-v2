import { asc, eq } from 'drizzle-orm'
import type { MaukagaDatabase } from '../database'
import {
  config,
  type Config,
  type InsertConfig,
} from '../database/schema'

type TransactionCallback = Parameters<MaukagaDatabase['transaction']>[0]
export type ConfigTransaction = Parameters<TransactionCallback>[0]
export type ConfigDatabase = MaukagaDatabase | ConfigTransaction

export async function listConfigRecords(database: ConfigDatabase) {
  return database
    .select()
    .from(config)
    .orderBy(asc(config.key))
}

export async function findConfigRecord(database: ConfigDatabase, key: string) {
  const [record] = await database
    .select()
    .from(config)
    .where(eq(config.key, key))

  return record ?? null
}

export async function upsertConfigRecord(
  database: ConfigDatabase,
  values: InsertConfig,
) {
  await database
    .insert(config)
    .values(values)
    .onConflictDoUpdate({
      target: config.key,
      set: {
        value: values.value ?? null,
        updatedAt: new Date(),
      },
    })
}

export type { Config }
