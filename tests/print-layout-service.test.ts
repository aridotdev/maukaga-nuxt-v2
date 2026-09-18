import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { eq } from 'drizzle-orm'
import { createMaukagaDatabase } from '../server/database'
import {
  auditLog,
  config,
  printLayouts,
  user,
} from '../server/database/schema'
import {
  deletePrintLayout,
  listPrintLayouts,
  savePrintLayout,
  setActivePrintLayout,
} from '../server/services/print-layout-service'

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
  const databasePath = `/tmp/maukaga-print-layout-${randomUUID()}.db`
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
    id: 'layout-admin',
    name: 'Layout Admin',
    email: 'layout-admin@maukaga.test',
    emailVerified: true,
    role: 'admin',
    isActive: true,
  })
}

test('manages built-in and custom print layouts with active config and audit logs', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedActor(fixture.database)

    const initial = await listPrintLayouts(fixture.database)
    assert.equal(initial.layouts.length, 2)
    assert.equal(initial.active.local, 'local-default')
    assert.equal(initial.activeLayouts.import?.id, 'import-default')

    const [localConfig] = await fixture.database
      .select()
      .from(config)
      .where(eq(config.key, 'ACTIVE_PRINT_LAYOUT_LOCAL'))
    assert.equal(localConfig?.value, 'local-default')

    const saved = await savePrintLayout({
      layout: {
        type: 'local',
        name: 'Local Geser',
        offsetX: 1.5,
        offsetY: -0.5,
        gapProductModel: 0.25,
        gapModelSerial: 0.75,
      },
    }, {
      actorId: 'layout-admin',
      database: fixture.database,
    })

    const savedId = saved.savedLayoutId || ''
    assert.match(savedId, /^local-/)
    assert.equal(saved.layouts.find(layout => layout.id === savedId)?.offsetX, 1.5)

    const updated = await savePrintLayout({
      layout: {
        id: savedId,
        type: 'local',
        name: 'Local Geser Updated',
        offsetX: 2,
        offsetY: -0.5,
        gapProductModel: 0.25,
        gapModelSerial: 0.75,
      },
    }, {
      actorId: 'layout-admin',
      database: fixture.database,
    })
    assert.equal(updated.layouts.find(layout => layout.id === savedId)?.name, 'Local Geser Updated')
    assert.equal(updated.layouts.find(layout => layout.id === savedId)?.offsetX, 2)

    const active = await setActivePrintLayout({
      type: 'local',
      id: savedId,
    }, {
      actorId: 'layout-admin',
      database: fixture.database,
    })
    assert.equal(active.active.local, savedId)
    assert.equal(active.activeLayouts.local?.gapModelSerial, 0.75)

    await assert.rejects(
      deletePrintLayout(savedId, {
        actorId: 'layout-admin',
        database: fixture.database,
      }),
      (error: unknown) => (error as { statusCode?: number }).statusCode === 400,
    )

    await assert.rejects(
      deletePrintLayout('local-default', {
        actorId: 'layout-admin',
        database: fixture.database,
      }),
      (error: unknown) => (error as { statusCode?: number }).statusCode === 400,
    )

    await setActivePrintLayout({
      type: 'local',
      id: 'local-default',
    }, {
      actorId: 'layout-admin',
      database: fixture.database,
    })

    await deletePrintLayout(savedId, {
      actorId: 'layout-admin',
      database: fixture.database,
    })

    const [deleted] = await fixture.database
      .select()
      .from(printLayouts)
      .where(eq(printLayouts.id, savedId))
    const auditRows = await fixture.database
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityType, 'print_layout'))

    assert.equal(deleted, undefined)
    assert.equal(auditRows.length, 5)
  } finally {
    fixture.cleanup()
  }
})
