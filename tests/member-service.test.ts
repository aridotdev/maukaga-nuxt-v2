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
  session,
  user,
} from '../server/database/schema'
import {
  createMember,
  listMembers,
  updateMember,
} from '../server/services/member-service'

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
  const databasePath = `/tmp/maukaga-member-${randomUUID()}.db`
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

async function seedUser(
  database: ReturnType<typeof createMaukagaDatabase>,
  input: {
    id: string
    email: string
    role: 'admin' | 'management' | 'qrcc'
    isActive?: boolean
  },
) {
  const now = new Date('2026-09-19T00:00:00.000Z')

  await database.insert(user).values({
    id: input.id,
    email: input.email,
    name: input.email,
    role: input.role,
    isActive: input.isActive ?? true,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  })
}

function assertStatus(statusCode: number) {
  return (error: unknown) => {
    assert.equal((error as { statusCode?: number }).statusCode, statusCode)
    return true
  }
}

test('lists, creates, updates, and audits member accounts', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedUser(fixture.database, {
      id: 'admin-1',
      email: 'admin@maukaga.test',
      role: 'admin',
    })

    const created = await createMember({
      email: ' QRCC@Example.Test ',
      name: '  QRCC  Operator ',
      role: 'qrcc',
      password: 'password-123',
    }, {
      actorId: 'admin-1',
      database: fixture.database,
      hashPassword: async password => `hashed:${password}`,
    })

    assert.equal(created.email, 'qrcc@example.test')
    assert.equal(created.name, 'QRCC Operator')
    assert.equal(created.role, 'qrcc')
    assert.equal(created.isActive, true)

    const [credential] = await fixture.database
      .select()
      .from(account)
      .where(eq(account.userId, created.id))
    assert.equal(credential?.password, 'hashed:password-123')

    const updated = await updateMember(created.id, {
      name: 'QRCC Updated',
      role: 'management',
    }, {
      actorId: 'admin-1',
      database: fixture.database,
    })
    assert.equal(updated.name, 'QRCC Updated')
    assert.equal(updated.role, 'management')

    const listed = await listMembers(fixture.database)
    assert.equal(listed.summary.total, 2)
    assert.equal(listed.summary.active, 2)
    assert.equal(listed.summary.admins, 1)

    const logs = await fixture.database
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, created.id))
    assert.deepEqual(
      logs.map(log => log.action),
      ['member.create', 'member.update'],
    )
  } finally {
    fixture.cleanup()
  }
})

test('rejects duplicate email and protects the last active admin', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedUser(fixture.database, {
      id: 'admin-1',
      email: 'admin@maukaga.test',
      role: 'admin',
    })

    await assert.rejects(
      createMember({
        email: 'ADMIN@MAUKAGA.TEST',
        role: 'qrcc',
        password: 'password-123',
      }, {
        actorId: 'admin-1',
        database: fixture.database,
        hashPassword: async password => `hashed:${password}`,
      }),
      assertStatus(409),
    )

    await assert.rejects(
      updateMember('admin-1', { isActive: false }, {
        actorId: 'system-operator',
        database: fixture.database,
      }),
      assertStatus(400),
    )

    await assert.rejects(
      updateMember('admin-1', { role: 'management' }, {
        actorId: 'admin-1',
        database: fixture.database,
      }),
      assertStatus(400),
    )
  } finally {
    fixture.cleanup()
  }
})

test('deactivating a member revokes its active sessions', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedUser(fixture.database, {
      id: 'admin-1',
      email: 'admin@maukaga.test',
      role: 'admin',
    })
    const member = await createMember({
      email: 'member@maukaga.test',
      role: 'qrcc',
      password: 'password-123',
    }, {
      actorId: 'admin-1',
      database: fixture.database,
      hashPassword: async password => `hashed:${password}`,
    })

    await fixture.database.insert(session).values({
      id: 'session-1',
      token: 'session-token-1',
      userId: member.id,
      expiresAt: new Date('2026-09-20T00:00:00.000Z'),
      createdAt: new Date('2026-09-19T00:00:00.000Z'),
      updatedAt: new Date('2026-09-19T00:00:00.000Z'),
    })

    const updated = await updateMember(member.id, { isActive: false }, {
      actorId: 'admin-1',
      database: fixture.database,
    })
    assert.equal(updated.isActive, false)

    const sessions = await fixture.database
      .select()
      .from(session)
      .where(eq(session.userId, member.id))
    assert.equal(sessions.length, 0)
  } finally {
    fixture.cleanup()
  }
})
