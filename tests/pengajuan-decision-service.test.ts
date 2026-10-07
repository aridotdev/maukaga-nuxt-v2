import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, rmSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { eq } from 'drizzle-orm'
import { createMaukagaDatabase } from '../server/database'
import {
  auditLog,
  pengajuan,
  pengajuanFileItems,
  pengajuanFiles,
  pengajuanItems,
  statusLog,
  user,
} from '../server/database/schema'
import {
  uploadSignedStatement,
  updateItemsDecision,
  updatePengajuanStatus,
} from '../server/services/pengajuan-service'

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
    storagePath: `/tmp/maukaga-decision-files-${randomUUID()}`,
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
    bagian: 'Bagian Decision',
    cabang: 'Cabang Decision',
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

test('keeps rejected submissions final and records an admin restore', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedDecisionFixture(fixture.database)
    await fixture.database
      .update(pengajuan)
      .set({ status: 'Ditolak' })
      .where(eq(pengajuan.idPengajuan, 'KG-20260919-0001'))

    await assert.rejects(
      updateItemsDecision('KG-20260919-0001', {
        items: [{
          noItem: 1,
          decision: 'Disetujui',
        }],
      }, {
        actorId: 'admin-decision',
        actorRole: 'qrcc',
        database: fixture.database,
      }),
      assertStatus(409),
    )

    await assert.rejects(
      updatePengajuanStatus('KG-20260919-0001', {
        status: 'Baru',
        note: 'Coba pulihkan dari role QRCC.',
      }, {
        actorId: 'admin-decision',
        actorRole: 'qrcc',
        database: fixture.database,
      }),
      assertStatus(403),
    )

    await assert.rejects(
      updatePengajuanStatus('KG-20260919-0001', {
        status: 'Disetujui',
        note: 'Tidak boleh melewati pemulihan.',
      }, {
        actorId: 'admin-decision',
        actorRole: 'admin',
        database: fixture.database,
      }),
      assertStatus(409),
    )

    const restored = await updatePengajuanStatus('KG-20260919-0001', {
      status: 'Baru',
      note: 'Pengajuan dipulihkan untuk review ulang.',
    }, {
      actorId: 'admin-decision',
      actorRole: 'admin',
      database: fixture.database,
      now: new Date('2026-09-19T03:00:00.000Z'),
    })

    assert.equal(restored.status, 'Baru')

    const logs = await fixture.database
      .select()
      .from(statusLog)
      .where(eq(statusLog.scope, 'pengajuan'))
    assert.equal(logs.at(-1)?.catatan, 'Pengajuan dipulihkan untuk review ulang.')

    const restoreAudits = await fixture.database
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'pengajuan.status-restore'))
    assert.equal(restoreAudits.length, 1)
    assert.match(restoreAudits[0]?.metadataJson ?? '', /dipulihkan/)
  } finally {
    fixture.cleanup()
  }
})

test('requires a reason and follows the normal status transition map', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedDecisionFixture(fixture.database)

    await assert.rejects(
      updatePengajuanStatus('KG-20260919-0001', {
        status: 'Ditolak',
      }, {
        actorId: 'admin-decision',
        actorRole: 'admin',
        database: fixture.database,
      }),
      assertStatus(400),
    )

    await assert.rejects(
      updatePengajuanStatus('KG-20260919-0001', {
        status: 'Diprint',
        note: 'Lewati proses cetak.',
      }, {
        actorId: 'admin-decision',
        actorRole: 'admin',
        database: fixture.database,
      }),
      assertStatus(409),
    )

    const rejected = await updatePengajuanStatus('KG-20260919-0001', {
      status: 'Ditolak',
      note: 'Dokumen tidak memenuhi ketentuan.',
    }, {
      actorId: 'admin-decision',
      actorRole: 'admin',
      database: fixture.database,
    })

    assert.equal(rejected.status, 'Ditolak')
  } finally {
    fixture.cleanup()
  }
})

test('admin signed statement overrides a rejected submission and restores rejected items', async () => {
  const fixture = await createTestDatabase()
  const previousStoragePath = process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
  process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = fixture.storagePath

  try {
    await seedDecisionFixture(fixture.database)
    await fixture.database
      .update(pengajuanItems)
      .set({
        keputusanItem: 'Ditolak',
        catatanKeputusan: 'Ditolak untuk pengujian override.',
      })
    await fixture.database
      .update(pengajuan)
      .set({ status: 'Ditolak' })
      .where(eq(pengajuan.idPengajuan, 'KG-20260919-0001'))

    const updated = await uploadSignedStatement(
      'KG-20260919-0001',
      {
        kind: 'signed_statement',
        sequence: 0,
        originalName: 'surat-Permohonan.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 8,
        data: Buffer.from('%PDF-test'),
      },
      {
        actorId: 'admin-decision',
        actorRole: 'admin',
        database: fixture.database,
        now: new Date('2026-09-19T04:00:00.000Z'),
      },
    )

    assert.equal(updated.status, 'Disetujui')
    assert.equal(updated.approvalOverrideReason, 'signed_statement')
    assert.deepEqual(
      updated.items.map(item => item.keputusanItem),
      ['Disetujui', 'Disetujui'],
    )
    assert.equal(updated.files[0]?.kind, 'signed_statement')

    const [storedFile] = await fixture.database
      .select()
      .from(pengajuanFiles)
    assert.equal(storedFile?.kind, 'signed_statement')
    assert.equal(storedFile?.itemId, null)
    assert.equal(storedFile?.mimeType, 'application/pdf')
    assert.ok(storedFile?.storageKey)
    assert.equal(existsSync(`${fixture.storagePath}/${storedFile?.storageKey}`), true)

    const fileItems = await fixture.database
      .select()
      .from(pengajuanFileItems)
    assert.equal(fileItems.length, 2)

    const overrideAudits = await fixture.database
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'pengajuan.approval-override'))
    assert.equal(overrideAudits.length, 1)
  } finally {
    if (previousStoragePath === undefined) delete process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
    else process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = previousStoragePath
    rmSync(fixture.storagePath, { recursive: true, force: true })
    fixture.cleanup()
  }
})

test('item signed statement restores only the rejected item', async () => {
  const fixture = await createTestDatabase()
  const previousStoragePath = process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
  process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = fixture.storagePath

  try {
    await seedDecisionFixture(fixture.database)
    await fixture.database
      .update(pengajuanItems)
      .set({ keputusanItem: 'Disetujui' })
      .where(eq(pengajuanItems.noItem, 1))
    await fixture.database
      .update(pengajuanItems)
      .set({
        keputusanItem: 'Ditolak',
        catatanKeputusan: 'Item perlu surat Permohonan.',
      })
      .where(eq(pengajuanItems.noItem, 2))

    const [targetItem] = await fixture.database
      .select()
      .from(pengajuanItems)
      .where(eq(pengajuanItems.noItem, 2))
    assert.ok(targetItem)

    const updated = await uploadSignedStatement(
      'KG-20260919-0001',
      {
        kind: 'signed_statement',
        sequence: 0,
        originalName: 'surat-item-2.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 8,
        data: Buffer.from('%PDF-item'),
      },
      {
        actorId: 'admin-decision',
        actorRole: 'admin',
        database: fixture.database,
        now: new Date('2026-09-19T04:30:00.000Z'),
      },
      { noItem: 2 },
    )

    assert.equal(updated.status, 'Disetujui')
    assert.equal(updated.approvalOverrideReason, null)
    assert.deepEqual(
      updated.items.map(item => [item.noItem, item.keputusanItem, item.approvalOverrideReason]),
      [[1, 'Disetujui', null], [2, 'Disetujui', 'signed_statement']],
    )
    assert.deepEqual(
      updated.files.map(file => [file.kind, file.itemNo]),
      [['signed_statement', 2]],
    )

    const [storedFile] = await fixture.database
      .select()
      .from(pengajuanFiles)
    assert.equal(storedFile?.itemId, targetItem.id)

    const itemLogs = await fixture.database
      .select()
      .from(statusLog)
      .where(eq(statusLog.scope, 'item'))
    assert.equal(itemLogs.length, 1)
    assert.equal(itemLogs[0]?.itemId, targetItem.id)

    const overrideAudits = await fixture.database
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'pengajuan.item-signed-statement-upload'))
    assert.equal(overrideAudits.length, 1)
  } finally {
    if (previousStoragePath === undefined) delete process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
    else process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = previousStoragePath
    rmSync(fixture.storagePath, { recursive: true, force: true })
    fixture.cleanup()
  }
})

test('selected signed statement restores only selected rejected items', async () => {
  const fixture = await createTestDatabase()
  const previousStoragePath = process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
  process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = fixture.storagePath

  try {
    await seedDecisionFixture(fixture.database)

    const [record] = await fixture.database
      .select()
      .from(pengajuan)
      .where(eq(pengajuan.idPengajuan, 'KG-20260919-0001'))
    assert.ok(record)

    await fixture.database.insert(pengajuanItems).values({
      pengajuanId: record.id,
      noItem: 3,
      produk: 'Produk C',
      model: 'MODEL-C',
      modelNormalized: 'MODEL-C',
      nomorSeri: 'SERIAL-C',
      nomorSeriNormalized: 'SERIAL-C',
    })
    await fixture.database
      .update(pengajuanItems)
      .set({ keputusanItem: 'Disetujui' })
      .where(eq(pengajuanItems.noItem, 1))
    await fixture.database
      .update(pengajuanItems)
      .set({
        keputusanItem: 'Ditolak',
        catatanKeputusan: 'Item memerlukan surat Permohonan.',
      })
      .where(eq(pengajuanItems.noItem, 2))
    await fixture.database
      .update(pengajuanItems)
      .set({
        keputusanItem: 'Ditolak',
        catatanKeputusan: 'Item tetap ditolak.',
      })
      .where(eq(pengajuanItems.noItem, 3))
    await fixture.database
      .update(pengajuan)
      .set({ status: 'Ditolak' })
      .where(eq(pengajuan.idPengajuan, 'KG-20260919-0001'))

    const updated = await uploadSignedStatement(
      'KG-20260919-0001',
      {
        kind: 'signed_statement',
        sequence: 0,
        originalName: 'surat-item-terpilih.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 8,
        data: Buffer.from('%PDF-selected'),
      },
      {
        actorId: 'admin-decision',
        actorRole: 'admin',
        database: fixture.database,
      },
      { scope: 'selected_items', itemNos: [2] },
    )

    assert.deepEqual(
      updated.items.map(item => [
        item.noItem,
        item.keputusanItem,
        item.approvalOverrideReason,
        item.statusCetak,
        item.statusKirim,
      ]),
      [
        [1, 'Disetujui', null, 'Belum Dicetak', 'Belum Dikirim'],
        [2, 'Disetujui', 'signed_statement', 'Belum Dicetak', 'Belum Dikirim'],
        [3, 'Ditolak', null, 'Belum Dicetak', 'Belum Dikirim'],
      ],
    )
    assert.deepEqual(
      updated.files.map(file => [file.kind, file.itemNo, file.itemNos]),
      [['signed_statement', 2, [2]]],
    )

    const fileItems = await fixture.database
      .select()
      .from(pengajuanFileItems)
    assert.equal(fileItems.length, 1)
  } finally {
    if (previousStoragePath === undefined) delete process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
    else process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = previousStoragePath
    rmSync(fixture.storagePath, { recursive: true, force: true })
    fixture.cleanup()
  }
})

test('selected signed statement rejects duplicate and non-rejected items', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedDecisionFixture(fixture.database)
    await fixture.database
      .update(pengajuanItems)
      .set({
        keputusanItem: 'Ditolak',
        catatanKeputusan: 'Item perlu surat Permohonan.',
      })
      .where(eq(pengajuanItems.noItem, 2))

    const file = {
      kind: 'signed_statement' as const,
      sequence: 0,
      originalName: 'surat-validasi.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 8,
      data: Buffer.from('%PDF-invalid-target'),
    }

    await assert.rejects(
      uploadSignedStatement('KG-20260919-0001', file, {
        actorId: 'admin-decision',
        actorRole: 'admin',
        database: fixture.database,
      }, { scope: 'selected_items', itemNos: [2, 2] }),
      assertStatus(400),
    )

    await assert.rejects(
      uploadSignedStatement('KG-20260919-0001', file, {
        actorId: 'admin-decision',
        actorRole: 'admin',
        database: fixture.database,
      }, { scope: 'selected_items', itemNos: [1] }),
      assertStatus(409),
    )
  } finally {
    fixture.cleanup()
  }
})

test('item signed statement can restore one of all rejected items and prevents duplicate files', async () => {
  const fixture = await createTestDatabase()
  const previousStoragePath = process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
  process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = fixture.storagePath

  try {
    await seedDecisionFixture(fixture.database)
    await fixture.database
      .update(pengajuanItems)
      .set({
        keputusanItem: 'Ditolak',
        catatanKeputusan: 'Item ditolak untuk pengujian banding.',
      })
    await fixture.database
      .update(pengajuan)
      .set({ status: 'Ditolak' })
      .where(eq(pengajuan.idPengajuan, 'KG-20260919-0001'))

    const updated = await uploadSignedStatement(
      'KG-20260919-0001',
      {
        kind: 'signed_statement',
        sequence: 0,
        originalName: 'surat-item-1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 8,
        data: Buffer.from('%PDF-item'),
      },
      {
        actorId: 'admin-decision',
        actorRole: 'admin',
        database: fixture.database,
      },
      { noItem: 1 },
    )

    assert.equal(updated.status, 'Disetujui')
    assert.deepEqual(
      updated.items.map(item => [item.noItem, item.keputusanItem]),
      [[1, 'Disetujui'], [2, 'Ditolak']],
    )

    await fixture.database
      .update(pengajuanItems)
      .set({ keputusanItem: 'Ditolak' })
      .where(eq(pengajuanItems.noItem, 1))

    await assert.rejects(
      uploadSignedStatement(
        'KG-20260919-0001',
        {
          kind: 'signed_statement',
          sequence: 0,
          originalName: 'surat-item-1-kedua.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 8,
          data: Buffer.from('%PDF-item-2'),
        },
        {
          actorId: 'admin-decision',
          actorRole: 'admin',
          database: fixture.database,
        },
        { noItem: 1 },
      ),
      assertStatus(409),
    )
  } finally {
    if (previousStoragePath === undefined) delete process.env.NUXT_PENGAJUAN_FILE_DIRECTORY
    else process.env.NUXT_PENGAJUAN_FILE_DIRECTORY = previousStoragePath
    rmSync(fixture.storagePath, { recursive: true, force: true })
    fixture.cleanup()
  }
})

test('signed statement upload requires admin and a PDF', async () => {
  const fixture = await createTestDatabase()

  try {
    await seedDecisionFixture(fixture.database)
    await fixture.database
      .update(pengajuan)
      .set({ status: 'Ditolak' })
      .where(eq(pengajuan.idPengajuan, 'KG-20260919-0001'))

    const file = {
      kind: 'signed_statement' as const,
      sequence: 0,
      originalName: 'surat-Permohonan.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4,
      data: Buffer.from('test'),
    }

    await assert.rejects(
      uploadSignedStatement('KG-20260919-0001', file, {
        actorId: 'admin-decision',
        actorRole: 'qrcc',
        database: fixture.database,
      }),
      assertStatus(403),
    )

    await assert.rejects(
      uploadSignedStatement('KG-20260919-0001', file, {
        actorId: 'admin-decision',
        actorRole: 'admin',
        database: fixture.database,
      }),
      assertStatus(400),
    )
  } finally {
    fixture.cleanup()
  }
})
