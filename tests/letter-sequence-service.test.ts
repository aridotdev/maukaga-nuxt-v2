import assert from 'node:assert/strict'
import { readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import { test } from 'node:test'
import { createMaukagaDatabase } from '../server/database'
import { letterSequence } from '../server/database/schema'
import {
  allocateLetterSequence,
  allocateLetterSequenceInTransaction,
  formatLetterNumber,
  getLetterSequencePeriod,
} from '../server/services/letter-sequence-service'

function loadMigration(): string {
  const migrationsRoot = join(process.cwd(), 'server/database/migrations')
  const migrationDirectories = readdirSync(migrationsRoot)
    .filter((entry) => entry !== 'meta' && readdirSync(join(migrationsRoot, entry)).includes('migration.sql'))
    .sort()
  assert.ok(migrationDirectories.length, 'A generated database migration is required')

  return migrationDirectories
    .map(directory => readFileSync(join(migrationsRoot, directory, 'migration.sql'), 'utf8'))
    .join('\n--> statement-breakpoint\n')
}

async function createTestDatabase() {
  const databasePath = `/tmp/maukaga-letter-sequence-${randomUUID()}.db`
  const database = createMaukagaDatabase(`file:${databasePath}`)
  const statements = loadMigration()
    .split('--> statement-breakpoint')
    .map(statement => statement.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await database.$client.execute(statement)
  }

  return {
    database,
    cleanup: () => {
      database.$client.close()
      unlinkSync(databasePath)
    },
  }
}

test('allocates an atomic sequence for the same letter kind and period', async () => {
  const fixture = await createTestDatabase()

  try {
    const options = {
      database: fixture.database,
      letterKind: 'rejected-unit-letter',
      now: new Date('2026-10-05T02:00:00.000Z'),
      timeZone: 'UTC',
    }

    const first = await allocateLetterSequence(options)
    const second = await allocateLetterSequence(options)

    assert.equal(first.currentValue, 1)
    assert.equal(second.currentValue, 2)
    assert.equal(first.sequencePeriod, '2026-10-05')
    assert.equal(second.sequencePeriod, '2026-10-05')

    const [sequence] = await fixture.database
      .select()
      .from(letterSequence)
      .where(and(
        eq(letterSequence.letterKind, 'rejected-unit-letter'),
        eq(letterSequence.sequencePeriod, '2026-10-05'),
      ))

    assert.equal(sequence?.currentValue, 2)
  } finally {
    fixture.cleanup()
  }
})

test('starts a new sequence for a new period and letter kind', async () => {
  const fixture = await createTestDatabase()

  try {
    const first = await allocateLetterSequence({
      database: fixture.database,
      letterKind: 'rejected-unit-letter',
      now: new Date('2026-10-05T02:00:00.000Z'),
      timeZone: 'UTC',
    })
    const nextPeriod = await allocateLetterSequence({
      database: fixture.database,
      letterKind: 'rejected-unit-letter',
      now: new Date('2026-10-06T02:00:00.000Z'),
      timeZone: 'UTC',
    })
    const otherKind = await allocateLetterSequence({
      database: fixture.database,
      letterKind: 'another-letter',
      now: new Date('2026-10-05T02:00:00.000Z'),
      timeZone: 'UTC',
    })

    assert.equal(first.currentValue, 1)
    assert.equal(nextPeriod.currentValue, 1)
    assert.equal(otherKind.currentValue, 1)
  } finally {
    fixture.cleanup()
  }
})

test('resolves letter sequence periods using Asia/Jakarta', () => {
  const utcDate = new Date('2026-10-05T17:00:00.000Z')

  assert.equal(getLetterSequencePeriod(utcDate, 'UTC'), '2026-10-05')
  assert.equal(getLetterSequencePeriod(utcDate, 'Asia/Jakarta'), '2026-10-06')
})

test('formats a letter number from the server-side sequence', () => {
  assert.equal(
    formatLetterNumber('2026-10-05', 1),
    'SPKG/20261005/0001',
  )
  assert.equal(
    formatLetterNumber('2026-10-05', 12, 'CUSTOM'),
    'CUSTOM/20261005/0012',
  )
})

test('rejects invalid letter number input', () => {
  assert.throws(
    () => formatLetterNumber('20261005', 1),
    /Invalid letter sequence period/,
  )
  assert.throws(
    () => formatLetterNumber('2026-10-05', 0),
    /Invalid letter sequence value/,
  )
  assert.throws(
    () => formatLetterNumber('2026-10-05', 1, '  '),
    /Letter number prefix is required/,
  )
})

test('can allocate inside an existing transaction', async () => {
  const fixture = await createTestDatabase()

  try {
    const result = await fixture.database.transaction(tx =>
      allocateLetterSequenceInTransaction(tx, {
        letterKind: 'rejected-unit-letter',
        now: new Date('2026-10-05T02:00:00.000Z'),
        timeZone: 'UTC',
      }))

    assert.equal(result.currentValue, 1)
  } finally {
    fixture.cleanup()
  }
})
