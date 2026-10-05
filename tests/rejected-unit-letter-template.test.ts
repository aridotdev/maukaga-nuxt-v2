import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createRejectedUnitLetterTemplate,
  REJECTED_UNIT_LETTER_CLOSING,
  REJECTED_UNIT_LETTER_TABLE_HEADERS,
  REJECTED_UNIT_LETTER_TITLE,
} from '../server/templates/rejected-unit-letter-template'
import type { RejectedUnitLetterViewModel } from '../server/services/rejected-unit-letter-service'

function createViewModel(
  items: RejectedUnitLetterViewModel['items'],
): RejectedUnitLetterViewModel {
  return {
    nomorSurat: 'SPKG/20261006/0001',
    tanggalSurat: '06/10/2026',
    tanggalTandaTangan: '06-10-2026',
    tempatTandaTangan: 'Jakarta',
    idPengajuan: 'KG-20261006-0001',
    namaPemohon: 'Abdul Latif',
    bagian: 'Sales Marketing',
    cabang: 'Jakarta',
    pemilik: 'PT. GRAND INDO SUKSES',
    items,
  }
}

function createItem(
  overrides: Partial<RejectedUnitLetterViewModel['items'][number]> = {},
): RejectedUnitLetterViewModel['items'][number] {
  return {
    noItem: 1,
    pemilik: 'PT. GRAND INDO SUKSES',
    model: 'FRV-450',
    produk: 'LEMARI PEMBEKU',
    nomorSeri: 'A 82240800869',
    keputusanAwal: 'Ditolak',
    alasan: 'Ada notifikasi Service: 900226984',
    ...overrides,
  }
}

test('builds the single-unit template with the official text and dynamic data', () => {
  const template = createRejectedUnitLetterTemplate(
    createViewModel([createItem()]),
  )

  assert.equal(template.title, REJECTED_UNIT_LETTER_TITLE)
  assert.equal(template.opening, 'Saya sebagai pemohon :')
  assert.deepEqual(template.letterNumber, {
    label: 'Nomor Surat',
    value: 'SPKG/20261006/0001',
  })
  assert.deepEqual(template.applicantFields, [
    { label: 'ID Pengajuan', value: 'KG-20261006-0001' },
    { label: 'Tanggal', value: '06/10/2026' },
    { label: 'Nama', value: 'Abdul Latif' },
    { label: 'Bagian', value: 'Sales Marketing' },
    { label: 'Cabang', value: 'Jakarta' },
  ])
  assert.deepEqual(template.tableHeaders, REJECTED_UNIT_LETTER_TABLE_HEADERS)
  assert.deepEqual(template.tableRows, [{
    noItem: '1',
    pemilik: 'PT. GRAND INDO SUKSES',
    model: 'FRV-450',
    produk: 'LEMARI PEMBEKU',
    nomorSeri: 'A 82240800869',
    keputusanAwal: 'Ditolak',
    alasan: 'Ada notifikasi Service: 900226984',
  }])
  assert.equal(template.statements.length, 4)
  assert.match(template.statements[1]!, /unit tersebut/)
  assert.doesNotMatch(template.statements[1]!, /unit-unit tersebut/)
  assert.equal(template.closing, REJECTED_UNIT_LETTER_CLOSING)
  assert.deepEqual(template.signature, {
    awareness: 'Mengetahui',
    placeDate: 'Jakarta, 06-10-2026',
    applicantName: 'Abdul Latif',
    applicantLabel: 'Pemohon',
    departmentHeadLabel: 'Department Head',
  })
})

test('uses plural statements and preserves long Indonesian data', () => {
  const longReason =
    'Service / teknis: perlu pemeriksaan ulang, nomor referensi 900226984, ' +
    'dan catatan tambahan dengan karakter Indonesia: garansi diperbarui.'
  const template = createRejectedUnitLetterTemplate(createViewModel([
    createItem({ noItem: 2, alasan: longReason }),
    createItem({
      noItem: 4,
      model: 'MODEL/XYZ-02',
      nomorSeri: 'SN-02/2026',
      alasan: 'Belum sesuai tanda baca: (perlu verifikasi) - tahap 2.',
    }),
  ]))

  assert.equal(template.tableRows.length, 2)
  assert.equal(template.tableRows[0]?.alasan, longReason)
  assert.equal(template.tableRows[1]?.model, 'MODEL/XYZ-02')
  assert.equal(template.tableRows[1]?.nomorSeri, 'SN-02/2026')
  assert.match(template.statements[1]!, /unit-unit tersebut/)
  assert.match(template.statements[2]!, /unit-unit tersebut/)
  assert.equal(template.statements[1]?.includes(' unit tersebut'), false)
})
