import { sql } from 'drizzle-orm'
import { type MaukagaDatabase, useDb } from '../database'
import { letterSequence } from '../database/schema'
import {
  getApplicationTimeZone,
  getPengajuanSequenceDate,
} from './pengajuan-id-service'

export const DEFAULT_LETTER_SEQUENCE_MAX_RETRIES = 5
export const DEFAULT_LETTER_SEQUENCE_RETRY_DELAY_MS = 25
export const REJECTED_UNIT_LETTER_SEQUENCE_KIND = 'rejected-unit-letter'
export const DEFAULT_REJECTED_UNIT_LETTER_NUMBER_PREFIX = 'SPKG'
export const DEFAULT_LETTER_NUMBER_PADDING = 4

type TransactionCallback = Parameters<MaukagaDatabase['transaction']>[0]
type TransactionClient = Parameters<TransactionCallback>[0]

export type LetterSequenceTransaction = Pick<TransactionClient, 'insert'>

export interface AllocateLetterSequenceInTransactionOptions {
  letterKind: string
  now?: Date
  timeZone?: string
}

export interface AllocateLetterSequenceOptions extends AllocateLetterSequenceInTransactionOptions {
  database?: Pick<MaukagaDatabase, 'transaction'>
  maxRetries?: number
  retryDelayMs?: number
}

export interface AllocatedLetterSequence {
  letterKind: string
  sequencePeriod: string
  currentValue: number
}

export function formatLetterNumber(
  sequencePeriod: string,
  sequenceValue: number,
  prefix = DEFAULT_REJECTED_UNIT_LETTER_NUMBER_PREFIX,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sequencePeriod)) {
    throw new Error('Invalid letter sequence period')
  }

  if (!Number.isInteger(sequenceValue) || sequenceValue < 1) {
    throw new Error('Invalid letter sequence value')
  }

  const normalizedPrefix = prefix.trim()
  if (!normalizedPrefix) {
    throw new Error('Letter number prefix is required')
  }

  return [
    normalizedPrefix,
    sequencePeriod.replaceAll('-', ''),
    String(sequenceValue).padStart(DEFAULT_LETTER_NUMBER_PADDING, '0'),
  ].join('/')
}

export function getLetterSequencePeriod(
  date = new Date(),
  timeZone = getApplicationTimeZone(),
) {
  return getPengajuanSequenceDate(date, timeZone)
}

export async function allocateLetterSequenceInTransaction(
  tx: LetterSequenceTransaction,
  options: AllocateLetterSequenceInTransactionOptions,
): Promise<AllocatedLetterSequence> {
  const sequencePeriod = getLetterSequencePeriod(
    options.now,
    options.timeZone ?? getApplicationTimeZone(),
  )
  const [sequence] = await tx
    .insert(letterSequence)
    .values({
      letterKind: options.letterKind,
      sequencePeriod,
      currentValue: 1,
    })
    .onConflictDoUpdate({
      target: [letterSequence.letterKind, letterSequence.sequencePeriod],
      set: {
        currentValue: sql`${letterSequence.currentValue} + 1`,
        updatedAt: options.now ?? new Date(),
      },
    })
    .returning({
      letterKind: letterSequence.letterKind,
      sequencePeriod: letterSequence.sequencePeriod,
      currentValue: letterSequence.currentValue,
    })

  if (!sequence) {
    throw new Error('Unable to allocate letter sequence')
  }

  return sequence
}

export async function allocateLetterSequence(
  options: AllocateLetterSequenceOptions,
): Promise<AllocatedLetterSequence> {
  const database = options.database ?? useDb()
  const maxRetries = options.maxRetries ?? DEFAULT_LETTER_SEQUENCE_MAX_RETRIES
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_LETTER_SEQUENCE_RETRY_DELAY_MS

  return withTransactionRetry(
    () => database.transaction((tx) => allocateLetterSequenceInTransaction(tx, options)),
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
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * retries))
      }
    }
  }
}

function isRetriableTransactionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const code = 'code' in error ? String(error.code) : ''
  const message = error.message.toLowerCase()
  const isBusyCode = ['SQLITE_BUSY', 'SQLITE_LOCKED', 'LIBSQL_CLIENT_BUSY'].includes(code)
  const hasBusyMessage = message.includes('database is locked')
    || message.includes('database table is locked')
    || message.includes('transaction conflict')

  if (isBusyCode || hasBusyMessage) return true

  return 'cause' in error && isRetriableTransactionError(error.cause)
}
