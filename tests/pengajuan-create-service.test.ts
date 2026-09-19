import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, rmSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createMaukagaDatabase } from '../server/database'
import {
  modelProduk,
  pengajuan,
  pengajuanItems,
  user,
} from '../server/database/schema'
import { createPengajuan } from '../server/services/pengajuan-service'

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
  const databasePath = `/tmp/maukaga-pengajuan-create-${randomUUID()}.db`
  const storagePath = `/tmp/maukaga-pengajuan-files-${randomUUID()}`
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
    databasePath,
    storagePath,
    cleanup: () => {
      database.$client.close()
      unlinkSync(databasePath)
      rmSync(storagePath, { recursive: true, force: true })
    },
  }
}

async function seedActor(database: ReturnType<typeof createMaukagaDatabase>) {
  await database.insert(user).values({
    id: 'pengajuan-create-admin',
    name: 'Pengajuan Create Test',
    email: 'pengajuan-create@maukaga.test',
    emailVerified: true,
    role: 'admin',
    isActive: true,
  })
}

function createInput(model: string) {
  return {
    nama: 'Pemohon Create',
    bagianCabang: 'Cabang Create',
    pemilik: 'Pemilik Create',
    alasanPengajuan: 'Pengujian create pengajuan',
    tanggalForm: '2026-09-19',
    catatanTambahan: '',
    items: [{
      model,
      nomorSeri: 'SERIAL-CREATE-001',
      produk: 'Produk dari input',
    }],
  }
}

function createHardcopy(size = 4) {
  return [{
    kind: 'hardcopy' as const,
    sequence: 0,
    originalName: 'hardcopy.pdf',
    mimeType: 'application/pdf',
    sizeBytes: size,
    data: Buffer.alloc(size, 0),
  }]
}

function assertStatus(statusCode: number) {
  return (error: unknown) => {
    assert.equal((error as { statusCode?: number }).statusCode, statusCode)
    return true
  }
}

test('validates model against verified master and stores its snapshot', async () => {
  const fixture = await createTestDatabase()
  const previousStoragePath = process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
  process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = fixture.storagePath

  try {
    await seedActor(fixture.database)
    await fixture.database.insert(modelProduk).values({
      id: 'model-produk-verified',
      model: 'MODEL 001',
      produk: 'Produk Master',
      origin: 'local',
      status: 'verified',
    })

    const created = await createPengajuan(
      createInput(' model   001 '),
      createHardcopy(),
      {
        actorId: 'pengajuan-create-admin',
        database: fixture.database,
        now: new Date('2026-09-19T03:00:00.000Z'),
      },
    )

    assert.equal(created.items[0]?.model, 'MODEL 001')
    assert.equal(created.items[0]?.produk, 'Produk Master')

    const [item] = await fixture.database
      .select()
      .from(pengajuanItems)
    assert.equal(item?.modelProdukId, 'model-produk-verified')
  } finally {
    if (previousStoragePath === undefined) delete process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
    else process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = previousStoragePath
    fixture.cleanup()
  }
})

test('rejects missing or unverified product models before creating a submission', async () => {
  const fixture = await createTestDatabase()
  const previousStoragePath = process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
  process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = fixture.storagePath

  try {
    await seedActor(fixture.database)
    await fixture.database.insert(modelProduk).values({
      id: 'model-produk-review',
      model: 'MODEL REVIEW',
      produk: 'Produk Review',
      origin: 'import',
      status: 'needs_review',
    })

    await assert.rejects(
      createPengajuan(
        createInput('MODEL UNKNOWN'),
        createHardcopy(),
        { actorId: 'pengajuan-create-admin', database: fixture.database },
      ),
      assertStatus(400),
    )

    await assert.rejects(
      createPengajuan(
        createInput('MODEL REVIEW'),
        createHardcopy(),
        { actorId: 'pengajuan-create-admin', database: fixture.database },
      ),
      assertStatus(400),
    )

    const submissions = await fixture.database.select().from(pengajuan)
    assert.equal(submissions.length, 0)
  } finally {
    if (previousStoragePath === undefined) delete process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
    else process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = previousStoragePath
    fixture.cleanup()
  }
})

test('rejects oversized hardcopy and evidence files on the server', async () => {
  const fixture = await createTestDatabase()
  const previousStoragePath = process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
  process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = fixture.storagePath

  try {
    await seedActor(fixture.database)
    await fixture.database.insert(modelProduk).values({
      id: 'model-produk-upload-limit',
      model: 'MODEL UPLOAD LIMIT',
      produk: 'Produk Upload Limit',
      origin: 'local',
      status: 'verified',
    })

    await assert.rejects(
      createPengajuan(
        createInput('MODEL UPLOAD LIMIT'),
        createHardcopy(1024 * 1024 + 1),
        {
          actorId: 'pengajuan-create-admin',
          database: fixture.database,
          maxUploadMb: 1,
        },
      ),
      assertStatus(400),
    )

    await assert.rejects(
      createPengajuan(
        createInput('MODEL UPLOAD LIMIT'),
        [
          ...createHardcopy(),
          {
            kind: 'evidence' as const,
            sequence: 0,
            originalName: 'evidence.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 1024 * 1024 + 1,
            data: Buffer.alloc(1024 * 1024 + 1, 0),
          },
        ],
        {
          actorId: 'pengajuan-create-admin',
          database: fixture.database,
          maxUploadMb: 1,
        },
      ),
      assertStatus(400),
    )

    const submissions = await fixture.database.select().from(pengajuan)
    assert.equal(submissions.length, 0)
  } finally {
    if (previousStoragePath === undefined) delete process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
    else process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = previousStoragePath
    fixture.cleanup()
  }
})
