import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { eq } from 'drizzle-orm'
import { createMaukagaDatabase } from '../server/database'
import {
  auditLog,
  pengajuan,
  pengajuanItems,
  statusLog,
  user,
} from '../server/database/schema'
import { updateItemsDecision } from '../server/services/pengajuan-service'

function loadMigration(): string {
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
  const databasePath = `/tmp/maukaga-decision-${randomUUID()}.db`
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

async function seedDecisionFixture(
  database: ReturnType<typeof createMaukagaDatabase>,
) {
  await database.insert(user).values({
    id: 'admin-decision',
    name: 'Admin Decision',
    email: 'admin-decision@maukaga.test',
    emailVerified: true,
    role: 'admin',
    isActive: true,
  })

  const [record] = await database.insert(pengajuan).values({
    idPengajuan: 'KG-20260919-0001',
    nama: 'Pemohon Decision',
    bagianCabang: 'Cabang Decision',
    pemilik: 'Pemilik Decision',
    alasanPengajuan: 'Review beberapa item',
    tanggalForm: '2026-09-19',
    status: 'Baru',
    submittedAt: new Date('2026-09-19T01:00:00.000Z'),
  }).returning()

  assert.ok(record)

  await database.insert(pengajuanItems).values([{
    pengajuanId: record.id,
    noItem: 1,
    produk: 'Produk A',
    model: 'MODEL-A',
    modelNormalized: 'MODEL-A',
    nomorSeri: 'SERIAL-A',
    nomorSeriNormalized: 'SERIAL-A',
  }, {
    pengajuanId: record.id,
    noItem: 2,
    produk: 'Produk B',
    model: 'MODEL-B',
    modelNormalized: 'MODEL-B',
    nomorSeri: 'SERIAL-B',
    nomorSeriNormalized: 'SERIAL-B',
  }])
}

function assertStatus(statusCode: number) {
  return (error: unknown) => {
    assert.equal((error as { statusCode?: number }).statusCode, statusCode)
    return true
  }
}

test('updates multiple item decisions in one transaction', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedDecisionFixture(fixture.database)

    const updated = await updateItemsDecision('KG-20260919-0001', {
      items: [{
        noItem: 1,
        decision: 'Disetujui',
      }, {
        noItem: 2,
        decision: 'Ditolak',
        note: 'Nomor seri tidak sesuai.',
      }],
    }, {
      actorId: 'admin-decision',
      database: fixture.database,
      now: new Date('2026-09-19T02:00:00.000Z'),
    })

    assert.deepEqual(
      updated.items.map(item => [item.noItem, item.keputusanItem]),
      [[1, 'Disetujui'], [2, 'Ditolak']],
    )
    assert.equal(updated.status, 'Disetujui')

    const itemLogs = await fixture.database
      .select()
      .from(statusLog)
      .where(eq(statusLog.scope, 'item'))
    assert.equal(itemLogs.length, 2)

    const decisionAudits = await fixture.database
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'pengajuan.items-decision'))
    assert.equal(decisionAudits.length, 1)
  } finally {
    fixture.cleanup()
  }
})

test('rejects invalid batch decisions before changing any item', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedDecisionFixture(fixture.database)

    await assert.rejects(
      updateItemsDecision('KG-20260919-0001', {
        items: [{
          noItem: 1,
          decision: 'Disetujui',
        }, {
          noItem: 2,
          decision: 'Ditolak',
        }],
      }, {
        actorId: 'admin-decision',
        database: fixture.database,
      }),
      assertStatus(400),
    )

    await assert.rejects(updateItemsDecision('KG-20260919-0001', {
      items: [{
        noItem: 1,
        decision: 'Disetujui',
      }, {
        noItem: 1,
        decision: 'Ditolak',
        note: 'Duplikat item.',
      }],
    }, {
      actorId: 'admin-decision',
      database: fixture.database,
    }))

    const items = await fixture.database
      .select()
      .from(pengajuanItems)
      .orderBy(pengajuanItems.noItem)
    assert.deepEqual(items.map(item => item.keputusanItem), ['Menunggu', 'Menunggu'])
  } finally {
    fixture.cleanup()
  }
})
