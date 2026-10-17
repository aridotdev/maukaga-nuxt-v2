import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getSubmissionDate,
  normalizeBusinessKey,
  parseLegacyItemCsv,
  parseLegacyPengajuanCsv,
  parseSemicolonCsv,
} from '../scripts/import-pengajuan-legacy-lib'

const pengajuanCsv = `id_pengajuan;nama;bagian;cabang;pemilik;alasan_pengajuan;tanggal_form;status
KG-20260603-0001;Yeni Azra;CS Admin;Padang;PT Contoh;"Alasan; dengan pemisah";2026-05-28;Selesai`

const itemCsv = `id_pengajuan;no_item;produk;model;nomor_seri;keputusan_item;catatan_keputusan;jenis_kartu;status_cetak;status_kirim
KG-20260603-0001;1;TELEVISI;2t-c42fd1i;9653025F001295;Disetujui;;Local;Dicetak;Dikirim
KG-20260603-0001;2;TELEVISI;2t-c42fd1i;9653025F001296;Ditolak;Catatan keputusan;Import;Belum Dicetak;Belum Dikirim`

test('parses valid semicolon-delimited legacy CSV files', () => {
  const pengajuan = parseLegacyPengajuanCsv(pengajuanCsv)
  const items = parseLegacyItemCsv(itemCsv)

  assert.deepEqual(pengajuan.issues, [])
  assert.equal(pengajuan.data[0]?.alasanPengajuan, 'Alasan; dengan pemisah')
  assert.equal(pengajuan.data[0]?.tanggalForm, '2026-05-28')
  assert.deepEqual(items.issues, [])
  assert.equal(items.data[0]?.model, '2T-C42FD1I')
  assert.equal(items.data[0]?.noItem, 1)
  assert.equal(items.data[0]?.catatanKeputusan, null)
  assert.equal(items.data[1]?.catatanKeputusan, 'Catatan keputusan')
})

test('reports invalid dates, enum values, and item numbers', () => {
  const pengajuan = parseLegacyPengajuanCsv(pengajuanCsv.replace('2026-05-28;Selesai', '28/05/2026;selesai'))
  const items = parseLegacyItemCsv(itemCsv.replace(';1;', ';0;'))

  assert.match(pengajuan.issues[0]?.message ?? '', /tanggal_form/)
  assert.match(items.issues[0]?.message ?? '', /no_item/)
})

test('requires exact ordered headers and balanced quotes', () => {
  assert.throws(
    () => parseLegacyPengajuanCsv(pengajuanCsv.replace('id_pengajuan;nama', 'nama;id_pengajuan')),
    /Header CSV pengajuan/,
  )
  assert.throws(() => parseSemicolonCsv('a;b\n"value;b'), /tidak berpasangan/)
})

test('normalizes business keys and derives submission time from legacy ID', () => {
  assert.equal(normalizeBusinessKey(' hm-80l(w)  '), 'HM-80L(W)')
  assert.equal(getSubmissionDate('KG-20260603-0001').toISOString(), '2026-06-02T17:00:00.000Z')
})

test('rejects invalid dates and zero sequences in legacy IDs', () => {
  const invalidDate = parseLegacyPengajuanCsv(pengajuanCsv.replace('KG-20260603-0001', 'KG-20260231-0001'))
  const zeroSequence = parseLegacyPengajuanCsv(pengajuanCsv.replace('KG-20260603-0001', 'KG-20260603-0000'))

  assert.match(invalidDate.issues[0]?.message ?? '', /tanggal pada id_pengajuan/)
  assert.match(zeroSequence.issues[0]?.message ?? '', /nomor urut/)
})
