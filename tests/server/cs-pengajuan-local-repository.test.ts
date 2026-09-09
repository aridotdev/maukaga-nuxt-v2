import { mkdtempSync, rmSync } from 'node:fs'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { sql } from 'drizzle-orm'
import { createMaukagaDatabase } from '../../server/database'
import { modelProduk, pengajuan, pengajuanItems } from '../../server/database/schema'
import {
  getLocalModelProduk,
  saveDraftPengajuanLocal,
} from '../../server/repositories/cs-pengajuan-local-repository'

const testDirectories = new Set<string>()

async function createTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'maukaga-cs-local-'))
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

  return database
}

afterEach(() => {
  for (const directory of testDirectories) {
    rmSync(directory, { recursive: true, force: true })
    testDirectories.delete(directory)
  }
})

const baseInput = {
  nama: 'Andi',
  bagianCabang: 'Jakarta',
  pemilik: 'Andi',
  tanggalForm: '2026-09-10',
  alasanPengajuan: 'Kartu rusak',
  catatanTambahan: '',
  items: [{
    produk: 'Input manual',
    model: 'AC-01',
    nomorSeri: 'SN-001',
  }],
}

describe('CS local pengajuan repository', () => {
  it('creates a draft and resolves product from the local master', async () => {
    const database = await createTestDatabase()
    await database.insert(modelProduk).values({
      model: 'AC-01',
      produk: 'AC Split',
      origin: 'local',
      status: 'verified',
    })

    const result = await saveDraftPengajuanLocal(
      baseInput,
      database,
      {
        now: new Date('2026-09-10T08:00:00.000Z'),
        tokenFactory: () => 'resume-token',
      },
    )

    assert.equal(result.idPengajuan, 'KG-20260910-0001')
    assert.equal(result.resumeToken, 'resume-token')
    assert.equal(result.status, 'Menunggu Upload')

    const [savedItem] = await database.select().from(pengajuanItems)
    assert.equal(savedItem?.produk, 'AC Split')
    assert.equal(savedItem?.modelNormalized, 'AC-01')
    assert.equal(savedItem?.produkStatus, 'verified')
    assert.equal(savedItem?.produkSumber, 'auto')
  })

  it('updates an existing draft only with its resume token', async () => {
    const database = await createTestDatabase()
    const first = await saveDraftPengajuanLocal(
      baseInput,
      database,
      {
        now: new Date('2026-09-10T08:00:00.000Z'),
        tokenFactory: () => 'resume-token',
      },
    )

    const updated = await saveDraftPengajuanLocal(
      {
        ...baseInput,
        idPengajuan: first.idPengajuan,
        resumeToken: first.resumeToken,
        nama: 'Budi',
        items: [
          baseInput.items[0]!,
          { produk: 'Kulkas', model: 'FR-02', nomorSeri: 'SN-002' },
        ],
      },
      database,
      { now: new Date('2026-09-10T09:00:00.000Z') },
    )

    assert.equal(updated.idPengajuan, first.idPengajuan)
    assert.equal(updated.resumeToken, first.resumeToken)

    const [savedParent] = await database.select().from(pengajuan)
    const savedItems = await database.select().from(pengajuanItems)
    assert.equal(savedParent?.nama, 'Budi')
    assert.equal(savedParent?.jumlahItem, 2)
    assert.equal(savedItems.length, 2)

    await assert.rejects(
      () => saveDraftPengajuanLocal(
        { ...baseInput, idPengajuan: first.idPengajuan, resumeToken: 'wrong-token' },
        database,
      ),
      /Link lanjutkan tidak valid/,
    )
  })

  it('rejects duplicate model and serial in another pengajuan', async () => {
    const database = await createTestDatabase()
    await saveDraftPengajuanLocal(baseInput, database, {
      now: new Date('2026-09-10T08:00:00.000Z'),
      tokenFactory: () => 'resume-token',
    })

    await assert.rejects(
      () => saveDraftPengajuanLocal({
        ...baseInput,
        nama: 'Budi',
        items: [{
          produk: 'Lain',
          model: 'ac-01',
          nomorSeri: 'sn-001',
        }],
      }, database, {
        now: new Date('2026-09-10T08:01:00.000Z'),
        tokenFactory: () => 'resume-token-2',
      }),
      /sudah pernah diajukan/,
    )
  })

  it('returns only verified local models', async () => {
    const database = await createTestDatabase()
    await database.insert(modelProduk).values([
      { model: 'AC-01', produk: 'AC Split', origin: 'local', status: 'verified' },
      { model: 'FR-02', produk: 'Kulkas', origin: 'import', status: 'needs_review' },
    ])

    const result = await getLocalModelProduk(database)

    assert.deepEqual(result.rows.map((row) => row.model), ['AC-01'])
  })
})
