import { sql } from 'drizzle-orm'
import { dailySequence } from '../database/schema'
import { type MaukagaDatabase, useDb } from '../database'

export const DEFAULT_PENGAJUAN_ID_PREFIX = 'KG'
export const DEFAULT_APPLICATION_TIME_ZONE = 'Asia/Jakarta'
export const DEFAULT_PENGAJUAN_ID_MAX_RETRIES = 3

type TransactionCallback = Parameters<MaukagaDatabase['transaction']>[0]
type TransactionClient = Parameters<TransactionCallback>[0]

export type PengajuanIdTransaction = Pick<TransactionClient, 'insert'>

export interface GeneratePengajuanIdInTransactionOptions {
  now?: Date
  prefix?: string
  timeZone?: string
}

export interface GeneratePengajuanIdOptions extends GeneratePengajuanIdInTransactionOptions {
  database?: Pick<MaukagaDatabase, 'transaction'>
  maxRetries?: number
  retryDelayMs?: number
}

export function getApplicationTimeZone() {
  return process.env.TZ || DEFAULT_APPLICATION_TIME_ZONE
}

export function getPengajuanSequenceDate(
  date = new Date(),
  timeZone = getApplicationTimeZone(),
) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    throw new Error('Unable to resolve pengajuan sequence date')
  }

  return `${year}-${month}-${day}`
}

export function formatPengajuanId(
  sequenceDate: string,
  sequenceValue: number,
  prefix = DEFAULT_PENGAJUAN_ID_PREFIX,
) {
  return `${prefix}-${sequenceDate.replaceAll('-', '')}-${String(sequenceValue).padStart(4, '0')}`
}

export async function generatePengajuanIdInTransaction(
  tx: PengajuanIdTransaction,
  options: GeneratePengajuanIdInTransactionOptions = {},
) {
  const sequenceDate = getPengajuanSequenceDate(options.now, options.timeZone)
  const [sequence] = await tx
    .insert(dailySequence)
    .values({ sequenceDate, currentValue: 1 })
    .onConflictDoUpdate({
      target: dailySequence.sequenceDate,
      set: {
        currentValue: sql`${dailySequence.currentValue} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ currentValue: dailySequence.currentValue })

  if (!sequence) {
    throw new Error('Unable to generate pengajuan sequence')
  }

  return formatPengajuanId(
    sequenceDate,
    sequence.currentValue,
    options.prefix,
  )
}

export async function generatePengajuanId(options: GeneratePengajuanIdOptions = {}) {
  const database = options.database ?? useDb()
  const maxRetries = options.maxRetries ?? DEFAULT_PENGAJUAN_ID_MAX_RETRIES
  const retryDelayMs = options.retryDelayMs ?? 25

  return withTransactionRetry(
    () => database.transaction((tx) => generatePengajuanIdInTransaction(tx, options)),
    maxRetries,
    retryDelayMs,
  )
}

async function withTransactionRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  retryDelayMs: number,
) {
  let retries = 0

  while (true) {
    try {
      return await operation()
    } catch (error) {
      if (retries >= maxRetries || !isRetriableTransactionError(error)) {
        throw error
      }

      retries += 1

      if (retryDelayMs > 0) {
        await delay(retryDelayMs * retries)
      }
    }
  }
}

function isRetriableTransactionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const code = 'code' in error ? String(error.code) : ''
  const message = error.message.toLowerCase()

  const isBusyCode = [
    'SQLITE_BUSY',
    'SQLITE_LOCKED',
    'LIBSQL_CLIENT_BUSY',
  ].includes(code)
  const hasBusyMessage =
    message.includes('database is locked') ||
    message.includes('database table is locked') ||
    message.includes('transaction conflict')

  if (isBusyCode || hasBusyMessage) return true

  return 'cause' in error && isRetriableTransactionError(error.cause)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
