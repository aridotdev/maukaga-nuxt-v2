import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { eq } from 'drizzle-orm'
import { verifyPassword } from 'better-auth/crypto'
import { createMaukagaDatabase } from '../server/database'
import { account, user } from '../server/database/schema'
import { seedAdminUser } from '../server/services/admin-seed-service'

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
  const databasePath = `/tmp/maukaga-admin-seed-${randomUUID()}.db`
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

test('seeds an admin credential account without creating a session', async () => {
  const fixture = await createTestDatabase()

  try {
    const result = await seedAdminUser({
      email: 'ADMIN@maukaga.com ',
      name: ' administrator ',
      password: 'qwertyuiop',
    }, {
      database: fixture.database,
    })

    assert.equal(result.created, true)
    assert.equal(result.email, 'admin@maukaga.com')

    const [seededUser] = await fixture.database
      .select()
      .from(user)
      .where(eq(user.email, 'admin@maukaga.com'))
    const [credentialAccount] = await fixture.database
      .select()
      .from(account)
      .where(eq(account.userId, result.userId))
    const sessions = await fixture.database.$client.execute(
      'select count(*) as count from session where user_id = ?',
      [result.userId],
    )

    assert.equal(seededUser?.name, 'administrator')
    assert.equal(seededUser?.role, 'admin')
    assert.equal(seededUser?.isActive, true)
    assert.equal(credentialAccount?.providerId, 'credential')
    assert.equal(credentialAccount?.password ? await verifyPassword({
      hash: credentialAccount.password,
      password: 'qwertyuiop',
    }) : false, true)
    assert.equal(Number(sessions.rows[0]?.count), 0)
  } finally {
    fixture.cleanup()
  }
})

test('is idempotent and does not replace an existing password', async () => {
  const fixture = await createTestDatabase()

  try {
    const firstResult = await seedAdminUser({
      email: 'admin@maukaga.com',
      name: 'administrator',
      password: 'qwertyuiop',
    }, {
      database: fixture.database,
    })
    const secondResult = await seedAdminUser({
      email: 'ADMIN@maukaga.com',
      name: 'different name',
      password: 'different-password',
    }, {
      database: fixture.database,
    })

    assert.equal(firstResult.created, true)
    assert.equal(secondResult.created, false)
    assert.equal(secondResult.userId, firstResult.userId)

    const [seededUser] = await fixture.database
      .select()
      .from(user)
      .where(eq(user.id, firstResult.userId))
    const [credentialAccount] = await fixture.database
      .select()
      .from(account)
      .where(eq(account.userId, firstResult.userId))

    assert.equal(seededUser?.name, 'administrator')
    assert.equal(seededUser?.role, 'admin')
    assert.equal(seededUser?.isActive, true)
    assert.equal(credentialAccount?.password ? await verifyPassword({
      hash: credentialAccount.password,
      password: 'qwertyuiop',
    }) : false, true)
    assert.equal(credentialAccount?.password ? await verifyPassword({
      hash: credentialAccount.password,
      password: 'different-password',
    }) : false, false)
  } finally {
    fixture.cleanup()
  }
})
