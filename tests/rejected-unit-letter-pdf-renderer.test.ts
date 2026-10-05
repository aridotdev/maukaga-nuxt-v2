import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderRejectedUnitLetterPdf } from '../server/renderers/rejected-unit-letter-pdf-renderer'
import type { RejectedUnitLetterViewModel } from '../server/services/rejected-unit-letter-service'

function createViewModel(
  itemCount = 1,
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
    items: Array.from({ length: itemCount }, (_, index) => ({
      noItem: index + 1,
      pemilik: 'PT. GRAND INDO SUKSES',
      model: `FRV-${450 + index}`,
      produk: 'LEMARI PEMBEKU',
      nomorSeri: `A 82240800869-${index + 1}`,
      keputusanAwal: 'Ditolak',
      alasan: index === 0
        ? 'Ada notifikasi Service: 900226984'
        : 'Alasan penolakan yang cukup panjang untuk menguji wrapping pada tabel PDF dan memastikan baris tidak terpotong.',
    })),
  }
}

function countPages(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length
}

test('renders a valid A4 PDF for one rejected unit', async () => {
  const pdf = await renderRejectedUnitLetterPdf(createViewModel())
  const source = pdf.toString('latin1')

  assert.ok(pdf.length > 1000)
  assert.equal(source.startsWith('%PDF-'), true)
  assert.equal(source.includes('%%EOF'), true)
  assert.match(source, /MediaBox \[0 0 595\.28 841\.89\]/)
  assert.equal(countPages(pdf), 1)
})

test('wraps long rows and creates additional A4 pages for many units', async () => {
  const pdf = await renderRejectedUnitLetterPdf(createViewModel(24))
  const source = pdf.toString('latin1')

  assert.equal(source.startsWith('%PDF-'), true)
  assert.ok(countPages(pdf) > 1)
  assert.match(source, /MediaBox \[0 0 595\.28 841\.89\]/)
})

test('rejects an empty letter view model', async () => {
  await assert.rejects(
    renderRejectedUnitLetterPdf(createViewModel(0)),
    /At least one letter item is required/,
  )
})
