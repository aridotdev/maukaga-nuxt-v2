import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { eq } from 'drizzle-orm'
import { createMaukagaDatabase } from '../server/database'
import { pengajuan, pengajuanItems } from '../server/database/schema'
import {
  rejectedUnitLetterInputSchema,
  resolveRejectedUnitLetterItems,
} from '../server/services/rejected-unit-letter-service'

function loadMigration(): string {
  const migrationsRoot = join(process.cwd(), 'server/database/migrations')
  const migrationDirectories = readdirSync(migrationsRoot)
    .filter(entry => entry !== 'meta' && readdirSync(join(migrationsRoot, entry)).includes('migration.sql'))
    .sort()
  assert.ok(migrationDirectories.length)

  return migrationDirectories
    .map(directory => readFileSync(join(migrationsRoot, directory, 'migration.sql'), 'utf8'))
    .join('\n--> statement-breakpoint\n')
}

async function createTestDatabase() {
  const databasePath = `/tmp/maukaga-rejected-unit-letter-${randomUUID()}.db`
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

async function seedFixture(
  database: ReturnType<typeof createMaukagaDatabase>,
  status: 'Baru' | 'Selesai' = 'Baru',
) {
  const [record] = await database.insert(pengajuan).values({
    idPengajuan: 'KG-20261006-0001',
    nama: 'Pemohon Surat',
    bagian: 'Bagian Surat',
    cabang: 'Cabang Surat',
    pemilik: 'Pemilik Surat',
    alasanPengajuan: 'Pengujian resolver surat',
    tanggalForm: '2026-10-06',
    status,
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
    keputusanItem: 'Ditolak',
    catatanKeputusan: 'Alasan A',
  }, {
    pengajuanId: record.id,
    noItem: 2,
    produk: 'Produk B',
    model: 'MODEL-B',
    modelNormalized: 'MODEL-B',
    nomorSeri: 'SERIAL-B',
    nomorSeriNormalized: 'SERIAL-B',
    keputusanItem: 'Ditolak',
    catatanKeputusan: 'Alasan B',
  }, {
    pengajuanId: record.id,
    noItem: 3,
    produk: 'Produk C',
    model: 'MODEL-C',
    modelNormalized: 'MODEL-C',
    nomorSeri: 'SERIAL-C',
    nomorSeriNormalized: 'SERIAL-C',
    keputusanItem: 'Disetujui',
  }, {
    pengajuanId: record.id,
    noItem: 4,
    produk: 'Produk D',
    model: 'MODEL-D',
    modelNormalized: 'MODEL-D',
    nomorSeri: 'SERIAL-D',
    nomorSeriNormalized: 'SERIAL-D',
    keputusanItem: 'Menunggu',
  }])

  return record
}

function assertStatus(statusCode: number) {
  return (error: unknown) => {
    assert.equal((error as { statusCode?: number }).statusCode, statusCode)
    return true
  }
}

test('validates the rejected letter input and rejects duplicate item numbers', () => {
  assert.deepEqual(
    rejectedUnitLetterInputSchema.parse({ itemNos: [2, 1] }),
    { itemNos: [2, 1] },
  )

  assert.throws(
    () => rejectedUnitLetterInputSchema.parse({ itemNos: [] }),
    /Pilih minimal satu item/,
  )
  assert.throws(
    () => rejectedUnitLetterInputSchema.parse({ itemNos: [1, 1] }),
    /Nomor item tidak boleh duplikat/,
  )
  assert.throws(
    () => rejectedUnitLetterInputSchema.parse({ itemNos: [0] }),
    /Nomor item tidak valid/,
  )
  assert.throws(
    () => rejectedUnitLetterInputSchema.parse({ itemNos: [1.5] }),
    /Nomor item tidak valid/,
  )
})

test('resolves selected rejected items in noItem order', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedFixture(fixture.database)

    const result = await resolveRejectedUnitLetterItems(
      'KG-20261006-0001',
      { itemNos: [2, 1] },
      fixture.database,
    )

    assert.equal(result.record.pengajuan.idPengajuan, 'KG-20261006-0001')
    assert.deepEqual(result.items.map(item => item.noItem), [1, 2])
    assert.deepEqual(result.items.map(item => item.catatanKeputusan), ['Alasan A', 'Alasan B'])
  } finally {
    fixture.cleanup()
  }
})

test('rejects missing, soft-deleted, completed, and unknown items', async () => {
  const fixture = await createTestDatabase()

  try {
    const record = await seedFixture(fixture.database)
    const [otherRecord] = await fixture.database.insert(pengajuan).values({
      idPengajuan: 'KG-20261006-0002',
      nama: 'Pemohon Lain',
      bagian: 'Bagian Lain',
      cabang: 'Cabang Lain',
      pemilik: 'Pemilik Lain',
      alasanPengajuan: 'Pengajuan lain',
      tanggalForm: '2026-10-06',
      status: 'Baru',
    }).returning()
    assert.ok(otherRecord)
    await fixture.database.insert(pengajuanItems).values({
      pengajuanId: otherRecord.id,
      noItem: 99,
      produk: 'Produk Lain',
      model: 'MODEL-LAIN',
      modelNormalized: 'MODEL-LAIN',
      nomorSeri: 'SERIAL-LAIN',
      nomorSeriNormalized: 'SERIAL-LAIN',
      keputusanItem: 'Ditolak',
    })

    await assert.rejects(
      resolveRejectedUnitLetterItems('KG-UNKNOWN', { itemNos: [1] }, fixture.database),
      assertStatus(404),
    )
    await assert.rejects(
      resolveRejectedUnitLetterItems('KG-20261006-0001', { itemNos: [99] }, fixture.database),
      assertStatus(400),
    )

    await fixture.database
      .update(pengajuan)
      .set({ deletedAt: new Date() })
      .where(eq(pengajuan.id, record.id))

    await assert.rejects(
      resolveRejectedUnitLetterItems('KG-20261006-0001', { itemNos: [1] }, fixture.database),
      assertStatus(404),
    )
  } finally {
    fixture.cleanup()
  }

  const completedFixture = await createTestDatabase()

  try {
    await seedFixture(completedFixture.database, 'Selesai')

    await assert.rejects(
      resolveRejectedUnitLetterItems('KG-20261006-0001', { itemNos: [1] }, completedFixture.database),
      assertStatus(409),
    )
  } finally {
    completedFixture.cleanup()
  }

  const itemFixture = await createTestDatabase()

  try {
    await seedFixture(itemFixture.database)

    await assert.rejects(
      resolveRejectedUnitLetterItems('KG-20261006-0001', { itemNos: [99] }, itemFixture.database),
      assertStatus(400),
    )
  } finally {
    itemFixture.cleanup()
  }
})

test('rejects approved or waiting items without exposing another submission', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedFixture(fixture.database)

    await assert.rejects(
      resolveRejectedUnitLetterItems('KG-20261006-0001', { itemNos: [3] }, fixture.database),
      assertStatus(409),
    )
    await assert.rejects(
      resolveRejectedUnitLetterItems('KG-20261006-0001', { itemNos: [4] }, fixture.database),
      assertStatus(409),
    )
    await assert.rejects(
      resolveRejectedUnitLetterItems('KG-20261006-0001', { itemNos: [1, 3] }, fixture.database),
      assertStatus(409),
    )
  } finally {
    fixture.cleanup()
  }
})
