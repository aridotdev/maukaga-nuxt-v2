import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { eq } from 'drizzle-orm'
import { createMaukagaDatabase } from '../server/database'
import {
  account,
  auditLog,
  config,
  user,
} from '../server/database/schema'
import { bootstrapAdmin } from '../server/services/admin-bootstrap-service'
import {
  listAdminConfig,
  saveAdminConfig,
} from '../server/services/admin-config-service'

function loadMigration() {
  const migrationsRoot = join(process.cwd(), 'server/database/migrations')
  const migrationDirectory = readdirSync(migrationsRoot)
    .filter(entry => entry !== 'meta')
    .sort()
    .at(-1)

  assert.ok(migrationDirectory)

  return readFileSync(
    join(migrationsRoot, migrationDirectory, 'migration.sql'),
    'utf8',
  )
}

async function createTestDatabase() {
  const databasePath = `/tmp/maukaga-admin-config-${randomUUID()}.db`
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

function assertStatus(statusCode: number) {
  return (error: unknown) => {
    assert.equal((error as { statusCode?: number }).statusCode, statusCode)
    return true
  }
}

test('bootstraps the first admin once and stores a hashed password', async () => {
  const fixture = await createTestDatabase()

  try {
    const created = await bootstrapAdmin({
      email: ' OWNER@Example.Test ',
      name: ' Owner ',
      password: 'password-123',
      bootstrapToken: 'secret-token',
    }, {
      database: fixture.database,
      bootstrapToken: 'secret-token',
      hashPassword: async password => `hashed:${password}`,
    })

    assert.equal(created.email, 'owner@example.test')
    assert.equal(created.name, 'Owner')
    assert.equal(created.role, 'admin')

    const [credential] = await fixture.database
      .select()
      .from(account)
      .where(eq(account.userId, created.id))
    assert.equal(credential?.password, 'hashed:password-123')

    await assert.rejects(
      bootstrapAdmin({
        email: 'second@example.test',
        password: 'password-456',
        bootstrapToken: 'secret-token',
      }, {
        database: fixture.database,
        bootstrapToken: 'secret-token',
        hashPassword: async password => `hashed:${password}`,
      }),
      assertStatus(409),
    )

    const audits = await fixture.database
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'admin.bootstrap'))
    assert.equal(audits.length, 1)
  } finally {
    fixture.cleanup()
  }
})

test('rejects an invalid bootstrap token before creating a user', async () => {
  const fixture = await createTestDatabase()

  try {
    await assert.rejects(
      bootstrapAdmin({
        email: 'owner@example.test',
        password: 'password-123',
        bootstrapToken: 'wrong-token',
      }, {
        database: fixture.database,
        bootstrapToken: 'secret-token',
        hashPassword: async password => `hashed:${password}`,
      }),
      assertStatus(403),
    )

    const users = await fixture.database.select().from(user)
    assert.equal(users.length, 0)
  } finally {
    fixture.cleanup()
  }
})

test('saves config values atomically and records changed keys in audit log', async () => {
  const fixture = await createTestDatabase()

  try {
    await fixture.database.insert(user).values({
      id: 'admin-config-test',
      email: 'admin-config@maukaga.test',
      name: 'Admin Config',
      role: 'admin',
      isActive: true,
      emailVerified: true,
    })

    const first = await saveAdminConfig({
      values: {
        ACTIVE_PRINT_LAYOUT_LOCAL: 'local-default',
        ACTIVE_PRINT_LAYOUT_IMPORT: 'import-default',
      },
    }, {
      actorId: 'admin-config-test',
      database: fixture.database,
    })

    assert.deepEqual(
      first.map(row => [row.key, row.value]),
      [
        ['ACTIVE_PRINT_LAYOUT_IMPORT', 'import-default'],
        ['ACTIVE_PRINT_LAYOUT_LOCAL', 'local-default'],
      ],
    )

    await saveAdminConfig({
      key: 'ACTIVE_PRINT_LAYOUT_LOCAL',
      value: 'local-custom',
    }, {
      actorId: 'admin-config-test',
      database: fixture.database,
    })

    const rows = await listAdminConfig(fixture.database)
    assert.equal(rows.find(row => row.key === 'ACTIVE_PRINT_LAYOUT_LOCAL')?.value, 'local-custom')

    const stored = await fixture.database.select().from(config)
    assert.equal(stored.length, 2)

    const audits = await fixture.database
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'admin.config-update'))
    assert.equal(audits.length, 3)
  } finally {
    fixture.cleanup()
  }
})
