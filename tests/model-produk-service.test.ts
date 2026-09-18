import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { eq } from 'drizzle-orm'
import { createMaukagaDatabase } from '../server/database'
import {
  auditLog,
  modelProduk,
  user,
} from '../server/database/schema'
import {
  createModelProduk,
  listModelProduk,
  updateModelProduk,
} from '../server/services/model-produk-service'

function loadMigration(): string {
  const migrationsRoot = join(process.cwd(), 'server/database/migrations')
  const migrationDirectory = readdirSync(migrationsRoot)
    .filter(entry => entry !== 'meta')
    .sort()
    .at(-1)

  assert.ok(migrationDirectory, 'A generated database migration is required')

  return readFileSync(
    join(migrationsRoot, migrationDirectory, 'migration.sql'),
    'utf8',
  )
}

async function createTestDatabase() {
  const databasePath = `/tmp/maukaga-model-produk-${randomUUID()}.db`
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

async function seedActor(database: ReturnType<typeof createMaukagaDatabase>) {
  await database.insert(user).values({
    id: 'model-produk-test-admin',
    name: 'Model Produk Test',
    email: 'model-produk-test@maukaga.test',
    emailVerified: true,
    role: 'admin',
    isActive: true,
  })
}

test('creates, lists, and updates model produk with normalization and audit logs', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedActor(fixture.database)

    const created = await createModelProduk({
      model: '  abc   123 ',
      produk: '  Produk   A ',
      origin: 'local',
    }, {
      actorId: 'model-produk-test-admin',
      database: fixture.database,
    })

    assert.equal(created.model, 'ABC 123')
    assert.equal(created.produk, 'Produk A')
    assert.equal(created.origin, 'local')
    assert.equal(created.status, 'verified')

    const listed = await listModelProduk({}, fixture.database)
    assert.equal(listed.summary.total, 1)
    assert.equal(listed.summary.verified, 1)
    assert.equal(listed.summary.needsReview, 0)

    const updated = await updateModelProduk(created.id, {
      produk: 'Produk B',
      origin: 'import',
    }, {
      actorId: 'model-produk-test-admin',
      database: fixture.database,
    })

    assert.equal(updated.id, created.id)
    assert.equal(updated.model, 'ABC 123')
    assert.equal(updated.produk, 'Produk B')
    assert.equal(updated.origin, 'import')
    assert.equal(updated.status, 'verified')

    const audits = await fixture.database
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, created.id))

    assert.deepEqual(
      audits.map(audit => audit.action).sort(),
      ['model-produk.create', 'model-produk.update'],
    )
  } finally {
    fixture.cleanup()
  }
})

test('rejects duplicate model keys after normalization', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedActor(fixture.database)

    await createModelProduk({
      model: 'MODEL-001',
      produk: 'Produk A',
      origin: 'local',
    }, {
      actorId: 'model-produk-test-admin',
      database: fixture.database,
    })

    await assert.rejects(
      createModelProduk({
        model: ' model-001 ',
        produk: 'Produk B',
        origin: 'import',
      }, {
        actorId: 'model-produk-test-admin',
        database: fixture.database,
      }),
      /sudah terdaftar/,
    )

    const records = await fixture.database.select().from(modelProduk)
    assert.equal(records.length, 1)
  } finally {
    fixture.cleanup()
  }
})
