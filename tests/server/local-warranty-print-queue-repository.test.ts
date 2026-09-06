import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildLocalWarrantyPrintQueueResponse } from '../../server/repositories/local-warranty-print-queue-repository'

describe('local warranty print queue repository', () => {
  it('builds printable rows from local archive data', () => {
    const result = buildLocalWarrantyPrintQueueResponse(
      [{
        idPengajuan: 'KG-1',
        timestampSubmit: '2026-09-01T10:00:00.000Z',
        nama: 'Andi',
        bagianCabang: 'Jakarta',
        status: 'Selesai',
      }] as never,
      [{
        idPengajuan: 'KG-1',
        noItem: 1,
        produk: 'AC Split',
        model: 'AC-01',
        nomorSeri: 'SN-1',
        keputusanItem: 'Disetujui',
        jenisKartu: 'Local',
        statusCetak: 'Printed',
        printBatchId: 'B-1',
        printedAt: '2026-09-01T11:00:00.000Z',
        statusKirim: 'Belum Dikirim',
        shipBatchId: '',
        shippedAt: '',
        modelNormalized: 'ac-01',
        produkStatus: 'verified',
        produkSumber: 'auto',
      }] as never,
      [{
        model: 'AC-01',
        produk: 'AC Split',
        origin: 'local',
        status: 'verified',
      }] as never,
      { includePrinted: true }
    )

    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0]?.idPengajuan, 'KG-1')
    assert.equal(result.rows[0]?.jenisKartuKey, 'local')
    assert.equal(result.rows[0]?.statusCetak, 'Printed')
    assert.equal(result.summary.total, 1)
    assert.equal(result.summary.local, 1)
    assert.equal(result.summary.printed, 1)
  })

  it('filters by card type and search term together', () => {
    const result = buildLocalWarrantyPrintQueueResponse(
      [{
        idPengajuan: 'KG-1',
        timestampSubmit: '2026-09-01T10:00:00.000Z',
        nama: 'Andi',
        bagianCabang: 'Jakarta',
        status: 'Selesai',
      }] as never,
      [{
        idPengajuan: 'KG-1',
        noItem: 1,
        produk: 'AC Split',
        model: 'AC-01',
        nomorSeri: 'SN-1',
        keputusanItem: 'Disetujui',
        jenisKartu: 'Local',
        statusCetak: 'Belum Dicetak',
        printBatchId: '',
        printedAt: '',
        statusKirim: 'Belum Dikirim',
        shipBatchId: '',
        shippedAt: '',
        modelNormalized: 'ac-01',
        produkStatus: 'verified',
        produkSumber: 'auto',
      }, {
        idPengajuan: 'KG-2',
        noItem: 1,
        produk: 'Kulkas',
        model: 'FR-01',
        nomorSeri: 'SN-2',
        keputusanItem: 'Disetujui',
        jenisKartu: 'Import',
        statusCetak: 'Belum Dicetak',
        printBatchId: '',
        printedAt: '',
        statusKirim: 'Belum Dikirim',
        shipBatchId: '',
        shippedAt: '',
        modelNormalized: 'fr-01',
        produkStatus: 'verified',
        produkSumber: 'auto',
      }] as never,
      [{
        model: 'AC-01',
        produk: 'AC Split',
        origin: 'local',
        status: 'verified',
      }, {
        model: 'FR-01',
        produk: 'Kulkas',
        origin: 'import',
        status: 'verified',
      }] as never,
      { jenisKartu: 'local', search: 'andi' }
    )

    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0]?.jenisKartuKey, 'local')
    assert.equal(result.rows[0]?.nama, 'Andi')
  })

  it('reads boolean query flags from string query params', () => {
    const result = buildLocalWarrantyPrintQueueResponse(
      [{
        idPengajuan: 'KG-1',
        timestampSubmit: '2026-09-01T10:00:00.000Z',
        nama: 'Andi',
        bagianCabang: 'Jakarta',
        status: 'Selesai',
      }] as never,
      [{
        idPengajuan: 'KG-1',
        noItem: 1,
        produk: 'AC Split',
        model: 'AC-01',
        nomorSeri: 'SN-1',
        keputusanItem: 'Disetujui',
        jenisKartu: 'Local',
        statusCetak: 'Printed',
        printBatchId: 'B-1',
        printedAt: '2026-09-01T11:00:00.000Z',
        statusKirim: 'Dikirim',
        shipBatchId: 'S-1',
        shippedAt: '2026-09-01T12:00:00.000Z',
        modelNormalized: 'ac-01',
        produkStatus: 'verified',
        produkSumber: 'auto',
      }] as never,
      [{
        model: 'AC-01',
        produk: 'AC Split',
        origin: 'local',
        status: 'verified',
      }] as never,
      { includePrinted: 'true', onlyUnsent: 'false' }
    )

    assert.equal(result.rows.length, 1)
    assert.equal(result.summary.printed, 1)
  })
})
