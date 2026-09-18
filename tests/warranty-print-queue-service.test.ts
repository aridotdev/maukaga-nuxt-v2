import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { eq } from 'drizzle-orm'
import { createMaukagaDatabase } from '../server/database'
import {
  pengajuan,
  pengajuanItems,
  printBatchItems,
  printBatches,
  user,
} from '../server/database/schema'
import {
  listWarrantyPrintQueue,
  markWarrantyCardsPrinted,
  saveWarrantyCardTypes,
} from '../server/services/pengajuan-service'

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
  const databasePath = `/tmp/maukaga-warranty-print-${randomUUID()}.db`
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

async function seedPrintQueueFixture(database: ReturnType<typeof createMaukagaDatabase>) {
  await database.insert(user).values({
    id: 'admin-test',
    name: 'Admin Test',
    email: 'admin-print@maukaga.test',
    emailVerified: true,
    role: 'admin',
    isActive: true,
  })

  const [record] = await database.insert(pengajuan).values({
    idPengajuan: 'KG-20260917-0001',
    nama: 'Pemohon Cetak',
    bagianCabang: 'Cabang Print',
    pemilik: 'Pemilik Print',
    alasanPengajuan: 'Cetak ulang',
    tanggalForm: '2026-09-17',
    status: 'Disetujui',
    submittedAt: new Date('2026-09-17T01:00:00.000Z'),
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
    keputusanItem: 'Disetujui',
    statusCetak: 'Belum Dicetak',
  }, {
    pengajuanId: record.id,
    noItem: 2,
    produk: 'Produk B',
    model: 'MODEL-B',
    modelNormalized: 'MODEL-B',
    nomorSeri: 'SERIAL-B',
    nomorSeriNormalized: 'SERIAL-B',
    keputusanItem: 'Menunggu',
    statusCetak: 'Belum Dicetak',
  }, {
    pengajuanId: record.id,
    noItem: 3,
    produk: 'Produk C',
    model: 'MODEL-C',
    modelNormalized: 'MODEL-C',
    nomorSeri: 'SERIAL-C',
    nomorSeriNormalized: 'SERIAL-C',
    keputusanItem: 'Disetujui',
    statusCetak: 'Dicetak',
  }])
}

test('lists approved unprinted items and prints them through a batch', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedPrintQueueFixture(fixture.database)

    const queue = await listWarrantyPrintQueue(fixture.database)
    assert.equal(queue.rows.length, 1)
    assert.equal(queue.summary.total, 1)
    assert.equal(queue.rows[0]?.idPengajuan, 'KG-20260917-0001')
    assert.equal(queue.rows[0]?.noItem, 1)
    assert.equal(queue.rows[0]?.jenisKartu, '')

    await assert.rejects(markWarrantyCardsPrinted({
      items: [{ idPengajuan: 'KG-20260917-0001', noItem: 1 }],
    }, {
      actorId: 'admin-test',
      database: fixture.database,
      now: new Date('2026-09-17T02:00:00.000Z'),
    }))

    const cardTypeResult = await saveWarrantyCardTypes({
      items: [{
        idPengajuan: 'KG-20260917-0001',
        noItem: 1,
        jenisKartu: 'Local',
      }],
    }, {
      actorId: 'admin-test',
      database: fixture.database,
    })

    assert.equal(cardTypeResult.count, 1)

    const printResult = await markWarrantyCardsPrinted({
      layoutId: 'local-default',
      items: [{
        idPengajuan: 'KG-20260917-0001',
        noItem: 1,
      }],
    }, {
      actorId: 'admin-test',
      database: fixture.database,
      now: new Date('2026-09-17T02:05:00.000Z'),
    })

    assert.equal(printResult.count, 1)
    assert.deepEqual(printResult.updated, ['KG-20260917-0001'])

    const [printedItem] = await fixture.database
      .select()
      .from(pengajuanItems)
      .where(eq(pengajuanItems.noItem, 1))
    const [updatedPengajuan] = await fixture.database
      .select()
      .from(pengajuan)
      .where(eq(pengajuan.idPengajuan, 'KG-20260917-0001'))
    const batchRows = await fixture.database.select().from(printBatches)
    const batchItemRows = await fixture.database.select().from(printBatchItems)

    assert.equal(printedItem?.jenisKartu, 'Local')
    assert.equal(printedItem?.statusCetak, 'Dicetak')
    assert.equal(printedItem?.lastPrintBatchId, printResult.batchId)
    assert.equal(updatedPengajuan?.status, 'Diprint')
    assert.equal(batchRows.length, 1)
    assert.equal(batchRows[0]?.status, 'completed')
    assert.equal(batchRows[0]?.layoutId, 'local-default')
    assert.equal(batchItemRows.length, 1)
    assert.equal(batchItemRows[0]?.status, 'success')
  } finally {
    fixture.cleanup()
  }
})
