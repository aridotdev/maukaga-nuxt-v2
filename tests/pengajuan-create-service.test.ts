import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, rmSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createMaukagaDatabase } from '../server/database'
import { eq } from 'drizzle-orm'
import {
  modelProduk,
  pengajuan,
  pengajuanItems,
  user,
} from '../server/database/schema'
import {
  createPengajuan,
  getPengajuan,
  getPengajuanFile,
} from '../server/services/pengajuan-service'
import { resolvePengajuanStoragePath } from '../server/utils/pengajuan-file-storage'

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
    bagian: 'Bagian Create',
    cabang: 'Cabang Create',
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
      origin: 'import',
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
    assert.equal(created.items[0]?.jenisKartu, 'Import')

    const [item] = await fixture.database
      .select()
      .from(pengajuanItems)
    assert.equal(item?.modelProdukId, 'model-produk-verified')
    assert.equal(item?.jenisKartu, 'Import')
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

test('exposes file IDs and restricts file lookup to the owning pengajuan', async () => {
  const fixture = await createTestDatabase()
  const previousStoragePath = process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
  process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = fixture.storagePath

  try {
    await seedActor(fixture.database)
    await fixture.database.insert(modelProduk).values({
      id: 'model-produk-file-view',
      model: 'MODEL FILE VIEW',
      produk: 'Produk File View',
      origin: 'local',
      status: 'verified',
    })

    const created = await createPengajuan(
      createInput('MODEL FILE VIEW'),
      [
        ...createHardcopy(),
        {
          kind: 'evidence',
          sequence: 0,
          originalName: 'bukti.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 4,
          data: Buffer.from('jpeg'),
        },
        {
          kind: 'attachment',
          sequence: 0,
          originalName: 'tambahan.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4,
          data: Buffer.from('%PDF'),
        },
      ],
      {
        actorId: 'pengajuan-create-admin',
        database: fixture.database,
      },
    )

    const detail = await getPengajuan(created.idPengajuan, fixture.database)
    assert.equal(detail.files.length, 3)
    assert.ok(detail.files.every(file => file.id))
    assert.deepEqual(
      detail.files.map(file => [file.kind, file.name]),
      [
        ['attachment', 'tambahan.pdf'],
        ['evidence', 'bukti.jpg'],
        ['hardcopy', 'hardcopy.pdf'],
      ],
    )

    const selectedFile = detail.files.find(file => file.kind === 'evidence')
    assert.ok(selectedFile)

    const storedFile = await getPengajuanFile(
      created.idPengajuan,
      selectedFile.id,
      fixture.database,
    )
    assert.equal(storedFile.id, selectedFile.id)
    assert.equal(storedFile.storageKey.includes(selectedFile.id), false)

    await assert.rejects(
      getPengajuanFile('KG-20990101-0001', selectedFile.id, fixture.database),
      assertStatus(404),
    )

    await fixture.database
      .update(pengajuan)
      .set({ deletedAt: new Date() })
      .where(eq(pengajuan.idPengajuan, created.idPengajuan))

    await assert.rejects(
      getPengajuanFile(created.idPengajuan, selectedFile.id, fixture.database),
      assertStatus(404),
    )

    assert.throws(
      () => resolvePengajuanStoragePath('../outside-file.pdf'),
      /Invalid pengajuan storage path/,
    )
  } finally {
    if (previousStoragePath === undefined) delete process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
    else process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = previousStoragePath
    fixture.cleanup()
  }
})
