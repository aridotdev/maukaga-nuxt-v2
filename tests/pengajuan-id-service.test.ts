import assert from 'node:assert/strict'
import { readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createMaukagaDatabase, type MaukagaDatabase } from '../server/database'
import { dailySequence } from '../server/database/schema'
import {
  generatePengajuanId,
  generatePengajuanIdInTransaction,
  getPengajuanSequenceDate,
  type GeneratePengajuanIdOptions,
} from '../server/services/pengajuan-id-service'

function loadMigration(): string {
  const migrationsRoot = join(process.cwd(), 'server/database/migrations')
  const migrationDirectory = readdirSync(migrationsRoot)
    .filter((entry) => entry !== 'meta')
    .sort()
    .at(-1)

  assert.ok(migrationDirectory, 'A generated database migration is required')

  return readFileSync(
    join(migrationsRoot, migrationDirectory, 'migration.sql'),
    'utf8',
  )
}

async function createTestDatabase() {
  const databasePath = `/tmp/maukaga-pengajuan-id-${randomUUID()}.db`
  const database = createMaukagaDatabase(`file:${databasePath}`)
  const statements = loadMigration()
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
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

test('generates deterministic daily pengajuan IDs in a transaction', async () => {
  const fixture = await createTestDatabase()

  try {
    const now = new Date('2026-09-13T02:00:00.000Z')
    const firstId = await generatePengajuanId({
      database: fixture.database,
      now,
      timeZone: 'UTC',
    })
    const secondId = await generatePengajuanId({
      database: fixture.database,
      now,
      timeZone: 'UTC',
    })

    assert.equal(firstId, 'KG-20260913-0001')
    assert.equal(secondId, 'KG-20260913-0002')

    const [sequence] = await fixture.database
      .select()
      .from(dailySequence)
      .where(eq(dailySequence.sequenceDate, '2026-09-13'))

    assert.equal(sequence?.currentValue, 2)
  } finally {
    fixture.cleanup()
  }
})

test('resets the pengajuan ID counter on a different application date', async () => {
  const fixture = await createTestDatabase()

  try {
    const firstId = await generatePengajuanId({
      database: fixture.database,
      now: new Date('2026-09-13T23:59:59.000Z'),
      timeZone: 'UTC',
    })
    const nextDayId = await generatePengajuanId({
      database: fixture.database,
      now: new Date('2026-09-14T00:00:00.000Z'),
      timeZone: 'UTC',
    })

    assert.equal(firstId, 'KG-20260913-0001')
    assert.equal(nextDayId, 'KG-20260914-0001')
  } finally {
    fixture.cleanup()
  }
})

test('uses the configured application timezone when resolving the sequence date', () => {
  const utcDate = new Date('2026-09-13T17:00:00.000Z')

  assert.equal(getPengajuanSequenceDate(utcDate, 'UTC'), '2026-09-13')
  assert.equal(getPengajuanSequenceDate(utcDate, 'Asia/Jakarta'), '2026-09-14')
})

test('retries a transient transaction conflict without skipping the counter', async () => {
  const fixture = await createTestDatabase()

  try {
    let attempts = 0

    const flakyDatabase: GeneratePengajuanIdOptions['database'] = {
      transaction: async <T>(callback: Parameters<MaukagaDatabase['transaction']>[0]) => {
        attempts += 1

        if (attempts === 1) {
          const error = new Error('database is locked')
          Object.assign(error, { code: 'SQLITE_BUSY' })
          throw error
        }

        return fixture.database.transaction(callback) as Promise<T>
      },
    }

    const id = await generatePengajuanId({
      database: flakyDatabase,
      now: new Date('2026-09-13T02:00:00.000Z'),
      timeZone: 'UTC',
      maxRetries: 2,
      retryDelayMs: 0,
    })

    assert.equal(id, 'KG-20260913-0001')
    assert.equal(attempts, 2)
  } finally {
    fixture.cleanup()
  }
})

test('can be called inside a larger pengajuan creation transaction', async () => {
  const fixture = await createTestDatabase()

  try {
    const id = await fixture.database.transaction((tx) =>
      generatePengajuanIdInTransaction(tx, {
        now: new Date('2026-09-13T02:00:00.000Z'),
        timeZone: 'UTC',
      }),
    )

    assert.equal(id, 'KG-20260913-0001')
  } finally {
    fixture.cleanup()
  }
})
