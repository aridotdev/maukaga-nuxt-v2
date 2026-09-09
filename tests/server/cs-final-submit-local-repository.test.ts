import { mkdtempSync, rmSync } from 'node:fs'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { sql } from 'drizzle-orm'
import { createMaukagaDatabase } from '../../server/database'
import {
  archiveFiles,
  pengajuan,
  pengajuanItems,
  statusLog,
} from '../../server/database/schema'
import {
  getDraftPengajuanLocal,
  loadDraftPengajuanByIdLocal,
  submitDraftPengajuanLocal,
} from '../../server/repositories/cs-pengajuan-local-repository'

const testDirectories = new Set<string>()

async function createTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'maukaga-cs-submit-'))
  testDirectories.add(directory)
  const database = createMaukagaDatabase(`file:${join(directory, 'test.db')}`)

  await database.run(sql`
    CREATE TABLE model_produk (
      model text PRIMARY KEY,
      produk text NOT NULL,
      origin text,
      status text DEFAULT 'verified',
      updated_at text,
      updated_by text,
      createdAt integer NOT NULL DEFAULT (unixepoch() * 1000),
      local_updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  await database.run(sql`
    CREATE TABLE pengajuan (
      id_pengajuan text PRIMARY KEY,
      timestamp_submit text,
      nama text,
      bagian_cabang text,
      pemilik text,
      alasan_pengajuan text,
      tanggal_form text,
      catatan_tambahan text,
      jumlah_item integer,
      jumlah_file_bukti integer,
      status text,
      catatan_admin text,
      tanggal_update_status_terakhir text,
      user_update_status text,
      resume_token text,
      draft_created_at text,
      draft_updated_at text,
      submitted_at text,
      createdAt integer NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt integer NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  await database.run(sql`
    CREATE TABLE pengajuan_items (
      id_pengajuan text NOT NULL,
      no_item integer NOT NULL,
      produk text,
      model text,
      nomor_seri text,
      keputusan_item text,
      catatan_admin_item text,
      tanggal_update_keputusan_item text,
      user_update_keputusan_item text,
      jenis_kartu text,
      status_cetak text NOT NULL DEFAULT 'Belum Dicetak',
      print_batch_id text,
      printed_at text,
      status_kirim text NOT NULL DEFAULT 'Belum Dikirim',
      ship_batch_id text,
      shipped_at text,
      model_normalized text,
      produk_status text,
      produk_sumber text,
      createdAt integer NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt integer NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY (id_pengajuan, no_item)
    )
  `)

  await database.run(sql`
    CREATE TABLE archive_files (
      id text PRIMARY KEY,
      id_pengajuan text NOT NULL,
      kind text NOT NULL,
      sequence integer NOT NULL DEFAULT 0,
      file_name text NOT NULL,
      public_path text NOT NULL,
      local_path text,
      mime_type text,
      size_bytes integer,
      sha256 text,
      source_drive_file_id text,
      status text NOT NULL DEFAULT 'pending',
      downloaded_at text,
      drive_trashed_at text,
      error text,
      createdAt integer NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt integer NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  await database.run(sql`
    CREATE TABLE status_log (
      id integer PRIMARY KEY AUTOINCREMENT,
      dedupe_key text NOT NULL UNIQUE,
      timestamp text,
      id_pengajuan text NOT NULL,
      status_lama text,
      status_baru text,
      catatan_admin text,
      user text,
      no_item text,
      createdAt integer NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt integer NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  return { database, directory }
}

afterEach(() => {
  for (const directory of testDirectories) {
    rmSync(directory, { recursive: true, force: true })
    testDirectories.delete(directory)
  }
})

const draftId = 'KG-20260910-0001'
const resumeToken = 'resume-token'
const baseDraft = {
  idPengajuan: draftId,
  timestampSubmit: '',
  nama: 'Andi',
  bagianCabang: 'Jakarta',
  pemilik: 'Andi',
  alasanPengajuan: 'Kartu rusak',
  tanggalForm: '2026-09-10',
  catatanTambahan: '',
  jumlahItem: 1,
  jumlahFileBukti: 0,
  status: 'Menunggu Upload' as const,
  catatanAdmin: '',
  tanggalUpdateStatusTerakhir: '',
  userUpdateStatus: '',
  resumeToken,
  draftCreatedAt: '2026-09-10T08:00:00.000Z',
  draftUpdatedAt: '2026-09-10T08:00:00.000Z',
  submittedAt: '',
}

describe('CS final submit local repository', () => {
  it('loads a draft and stores final files locally', async () => {
    const { database, directory } = await createTestDatabase()
    await database.insert(pengajuan).values(baseDraft)
    await database.insert(pengajuanItems).values({
      idPengajuan: draftId,
      noItem: 1,
      produk: 'AC Split',
      model: 'AC-01',
      nomorSeri: 'SN-001',
      keputusanItem: null,
      catatanAdminItem: '',
      jenisKartu: null,
      statusCetak: 'Belum Dicetak',
      printBatchId: '',
      printedAt: '',
      statusKirim: 'Belum Dikirim',
      shipBatchId: '',
      shippedAt: '',
      modelNormalized: 'AC-01',
      produkStatus: 'verified',
      produkSumber: 'auto',
      tanggalUpdateKeputusanItem: '',
      userUpdateKeputusanItem: '',
    })

    const loadedById = await loadDraftPengajuanByIdLocal(draftId, database)
    assert.equal(loadedById.resumeToken, resumeToken)
    assert.equal(loadedById.items[0]?.nomorSeri, 'SN-001')

    const loadedWithToken = await getDraftPengajuanLocal(draftId, resumeToken, database)
    assert.equal(loadedWithToken.idPengajuan, draftId)

    const pdfBytes = Buffer.from('%PDF-local-test')
    const imageBytes = Buffer.from('jpeg-local-test')
    const result = await submitDraftPengajuanLocal({
      ...baseDraft,
      fileBase64: pdfBytes.toString('base64'),
      fileExtension: 'pdf',
      fileMimeType: 'application/pdf',
      evidenceAttachments: [{
        fileName: 'unit.jpg',
        fileBase64: imageBytes.toString('base64'),
        fileExtension: 'jpg',
        fileMimeType: 'image/jpeg',
      }],
      items: [{
        produk: 'AC Split',
        model: 'AC-01',
        nomorSeri: 'SN-001',
      }],
    }, database, {
      now: new Date('2026-09-10T10:00:00.000Z'),
      archiveDir: join(directory, 'arsip_file'),
      archivePublicBasePath: '/arsip_file',
    })

    assert.deepEqual(result, { idPengajuan: draftId })

    const [savedParent] = await database.select().from(pengajuan)
    const savedItems = await database.select().from(pengajuanItems)
    const savedFiles = await database.select().from(archiveFiles)
    const savedLogs = await database.select().from(statusLog)

    assert.equal(savedParent?.status, 'Baru')
    assert.equal(savedParent?.resumeToken, '')
    assert.equal(savedParent?.jumlahFileBukti, 1)
    assert.equal(savedParent?.submittedAt, '2026-09-10T10:00:00.000Z')
    assert.equal(savedItems.length, 1)
    assert.equal(savedFiles.length, 2)
    assert.equal(savedFiles.every((file) => file.status === 'downloaded'), true)
    assert.equal(savedLogs.length, 1)
    assert.equal(savedLogs[0]?.statusBaru, 'Baru')

    const hardcopy = savedFiles.find((file) => file.kind === 'hardcopy')
    const evidence = savedFiles.find((file) => file.kind === 'bukti')
    assert.ok(hardcopy?.localPath)
    assert.ok(evidence?.localPath)
    assert.deepEqual(await readFile(hardcopy.localPath!), pdfBytes)
    assert.deepEqual(await readFile(evidence.localPath!), imageBytes)
  })

  it('rejects an invalid token before changing the draft', async () => {
    const { database, directory } = await createTestDatabase()
    await database.insert(pengajuan).values(baseDraft)
    const existingHardcopyPath = join(directory, 'arsip_file', `${draftId}_hardcopy.pdf`)
    const existingHardcopyBytes = Buffer.from('existing-hardcopy')
    await mkdir(join(directory, 'arsip_file'), { recursive: true })
    await writeFile(existingHardcopyPath, existingHardcopyBytes)

    await assert.rejects(
      () => submitDraftPengajuanLocal({
        ...baseDraft,
        resumeToken: 'wrong-token',
        fileBase64: Buffer.from('%PDF-local-test').toString('base64'),
        fileExtension: 'pdf',
        fileMimeType: 'application/pdf',
        evidenceAttachments: [],
        items: [{
          produk: 'AC Split',
          model: 'AC-01',
          nomorSeri: 'SN-001',
        }],
      }, database, {
        archiveDir: join(directory, 'arsip_file'),
      }),
      /Link lanjutkan tidak valid/,
    )

    const [unchangedParent] = await database.select().from(pengajuan)
    assert.equal(unchangedParent?.status, 'Menunggu Upload')
    assert.deepEqual(await readFile(existingHardcopyPath), existingHardcopyBytes)
  })
})
