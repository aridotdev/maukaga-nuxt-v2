import { asc, eq } from 'drizzle-orm'
import { db, type Database } from '../database'
import { config } from '../database/schema/config'

export type LocalConfigRecord = typeof config.$inferSelect

export type LocalConfigRepository = {
  listConfig: () => Promise<LocalConfigRecord[]>
  getValue: (key: string) => Promise<string>
  getValues: (keys: string[]) => Promise<Record<string, string>>
  setValue: (key: string, value: unknown) => Promise<void>
  setValues: (values: Record<string, unknown>) => Promise<void>
}

function normalizeConfigKey(key: string) {
  return String(key || '').trim()
}

function normalizeConfigValue(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function createLocalConfigRepository(database: Database = db): LocalConfigRepository {
  async function listConfig(): Promise<LocalConfigRecord[]> {
    return await database
      .select()
      .from(config)
      .orderBy(asc(config.key))
  }

  async function getValue(key: string): Promise<string> {
    const normalizedKey = normalizeConfigKey(key)
    if (!normalizedKey) return ''

    const rows = await database
      .select()
      .from(config)
      .where(eq(config.key, normalizedKey))
      .limit(1)

    return String(rows[0]?.value || '')
  }

  async function getValues(keys: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {}

    for (const key of keys) {
      const normalizedKey = normalizeConfigKey(key)
      if (normalizedKey) result[normalizedKey] = await getValue(normalizedKey)
    }

    return result
  }

  async function setValue(key: string, value: unknown): Promise<void> {
    const normalizedKey = normalizeConfigKey(key)
    if (!normalizedKey) return

    const normalizedValue = normalizeConfigValue(value)

    await database
      .insert(config)
      .values({ key: normalizedKey, value: normalizedValue })
      .onConflictDoUpdate({
        target: config.key,
        set: {
          value: normalizedValue,
          updatedAt: new Date(),
        },
      })
  }

  async function setValues(values: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      await setValue(key, value)
    }
  }

  return {
    listConfig,
    getValue,
    getValues,
    setValue,
    setValues,
  }
}

export const localConfigRepository = createLocalConfigRepository()
