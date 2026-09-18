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
  shippingBatchItems,
  shippingBatches,
  statusLog,
  user,
} from '../server/database/schema'
import {
  listShippingLabelQueue,
  markShippingLabelsShipped,
} from '../server/services/pengajuan-service'

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
  const databasePath = `/tmp/maukaga-shipping-label-${randomUUID()}.db`
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

async function seedShippingFixture(database: ReturnType<typeof createMaukagaDatabase>) {
  await database.insert(user).values({
    id: 'admin-shipping-test',
    name: 'Admin Shipping Test',
    email: 'admin-shipping@maukaga.test',
    emailVerified: true,
    role: 'admin',
    isActive: true,
  })

  const first = await insertPengajuan(database, {
    idPengajuan: 'KG-20260918-0001',
    nama: 'Pemohon Sama',
    bagianCabang: 'Cabang Jakarta',
    status: 'Disetujui',
  }, [{
    noItem: 1,
    keputusanItem: 'Disetujui',
    statusCetak: 'Dicetak',
    statusKirim: 'Belum Dikirim',
  }, {
    noItem: 2,
    keputusanItem: 'Ditolak',
    statusCetak: 'Belum Dicetak',
    statusKirim: 'Belum Dikirim',
  }])

  const second = await insertPengajuan(database, {
    idPengajuan: 'KG-20260918-0002',
    nama: 'Pemohon Sama',
    bagianCabang: 'Cabang Jakarta',
    status: 'Disetujui',
  }, [{
    noItem: 1,
    keputusanItem: 'Disetujui',
    statusCetak: 'Dicetak',
    statusKirim: 'Belum Dikirim',
  }])

  const invalid = await insertPengajuan(database, {
    idPengajuan: 'KG-20260918-0003',
    nama: 'Pemohon Invalid',
    bagianCabang: 'Cabang Bandung',
    status: 'Disetujui',
  }, [{
    noItem: 1,
    keputusanItem: 'Disetujui',
    statusCetak: 'Belum Dicetak',
    statusKirim: 'Belum Dikirim',
  }, {
    noItem: 2,
    keputusanItem: 'Menunggu',
    statusCetak: 'Dicetak',
    statusKirim: 'Belum Dikirim',
  }, {
    noItem: 3,
    keputusanItem: 'Disetujui',
    statusCetak: 'Dicetak',
    statusKirim: 'Dikirim',
  }])

  return { first, second, invalid }
}

async function insertPengajuan(
  database: ReturnType<typeof createMaukagaDatabase>,
  values: {
    idPengajuan: string
    nama: string
    bagianCabang: string
    status: 'Disetujui'
  },
  items: Array<{
    noItem: number
    keputusanItem: 'Menunggu' | 'Disetujui' | 'Ditolak'
    statusCetak: 'Belum Dicetak' | 'Dicetak'
    statusKirim: 'Belum Dikirim' | 'Dikirim'
  }>,
) {
  const [record] = await database.insert(pengajuan).values({
    ...values,
    pemilik: 'Pemilik Test',
    alasanPengajuan: 'Testing label pengiriman',
    tanggalForm: '2026-09-18',
    submittedAt: new Date('2026-09-18T01:00:00.000Z'),
  }).returning()

  assert.ok(record)

  await database.insert(pengajuanItems).values(items.map(item => ({
    pengajuanId: record.id,
    ...item,
    produk: `Produk ${values.idPengajuan}-${item.noItem}`,
    model: `MODEL-${values.idPengajuan}-${item.noItem}`,
    modelNormalized: `MODEL-${values.idPengajuan}-${item.noItem}`,
    nomorSeri: `SERIAL-${values.idPengajuan}-${item.noItem}`,
    nomorSeriNormalized: `SERIAL-${values.idPengajuan}-${item.noItem}`,
  })))

  return record
}

test('filters the shipping queue and records a shipping batch atomically', async () => {
  const fixture = await createTestDatabase()

  try {
    const records = await seedShippingFixture(fixture.database)
    const queue = await listShippingLabelQueue(fixture.database)

    assert.equal(queue.rows.length, 2)
    assert.equal(queue.summary.total, 2)
    assert.equal(queue.summary.groups, 1)
    assert.deepEqual(
      queue.rows.map(row => `${row.idPengajuan}:${row.noItem}`),
      ['KG-20260918-0001:1', 'KG-20260918-0002:1'],
    )

    await assert.rejects(
      markShippingLabelsShipped({
        items: [{ idPengajuan: records.invalid.idPengajuan, noItem: 1 }],
      }, {
        actorId: 'admin-shipping-test',
        database: fixture.database,
      }),
      /harus dicetak/,
    )

    await assert.rejects(
      markShippingLabelsShipped({
        items: [{ idPengajuan: records.invalid.idPengajuan, noItem: 2 }],
      }, {
        actorId: 'admin-shipping-test',
        database: fixture.database,
      }),
      /harus disetujui/,
    )

    await assert.rejects(
      markShippingLabelsShipped({
        items: [{ idPengajuan: records.invalid.idPengajuan, noItem: 3 }],
      }, {
        actorId: 'admin-shipping-test',
        database: fixture.database,
      }),
      /sudah dikirim/,
    )

    const result = await markShippingLabelsShipped({
      items: [
        { idPengajuan: records.first.idPengajuan, noItem: 1 },
        { idPengajuan: records.first.idPengajuan, noItem: 1 },
        { idPengajuan: records.second.idPengajuan, noItem: 1 },
      ],
    }, {
      actorId: 'admin-shipping-test',
      database: fixture.database,
      now: new Date('2026-09-18T02:00:00.000Z'),
    })

    assert.equal(result.count, 2)
    assert.deepEqual(result.updated, [
      records.first.idPengajuan,
      records.second.idPengajuan,
    ])

    const shippedItems = await fixture.database
      .select()
      .from(pengajuanItems)
      .where(eq(pengajuanItems.statusKirim, 'Dikirim'))
    const updatedPengajuan = await fixture.database
      .select()
      .from(pengajuan)
      .where(eq(pengajuan.status, 'Dikirim'))
    const batches = await fixture.database.select().from(shippingBatches)
    const batchItems = await fixture.database.select().from(shippingBatchItems)
    const itemLogs = await fixture.database
      .select()
      .from(statusLog)
      .where(eq(statusLog.statusBaru, 'Dikirim'))
    const audits = await fixture.database
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'pengajuan.shipping-batch'))

    assert.equal(shippedItems.length, 3)
    assert.equal(updatedPengajuan.length, 2)
    assert.equal(batches.length, 1)
    assert.equal(batches[0]?.id, result.batchId)
    assert.equal(batches[0]?.status, 'completed')
    assert.equal(batchItems.length, 2)
    assert.ok(batchItems.every(item => item.status === 'success'))
    assert.ok(shippedItems
      .filter(item => item.pengajuanId === records.first.id || item.pengajuanId === records.second.id)
      .every(item => item.lastShippingBatchId === result.batchId && item.shippedAt))
    assert.equal(itemLogs.length, 4)
    assert.equal(audits.length, 1)
  } finally {
    fixture.cleanup()
  }
})
