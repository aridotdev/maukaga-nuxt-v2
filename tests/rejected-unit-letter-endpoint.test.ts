import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createRejectedUnitLetterDownloadFilename,
  parseRejectedUnitLetterQuery,
} from '../server/api/pengajuan/[idPengajuan]/rejected-unit-letter.get'

test('parses rejected letter item numbers from a comma-separated query', () => {
  assert.deepEqual(
    parseRejectedUnitLetterQuery({ itemNos: '2, 1' }),
    { itemNos: [2, 1] },
  )
})

test('rejects empty, repeated, and invalid rejected letter item queries', () => {
  assert.throws(
    () => parseRejectedUnitLetterQuery({}),
    /Parameter itemNos wajib diisi/,
  )
  assert.throws(
    () => parseRejectedUnitLetterQuery({ itemNos: '1,,2' }),
    /Nomor item tidak valid/,
  )
  assert.throws(
    () => parseRejectedUnitLetterQuery({ itemNos: '1,1' }),
    /Nomor item tidak boleh duplikat/,
  )
  assert.throws(
    () => parseRejectedUnitLetterQuery({ itemNos: '1.5' }),
    /Nomor item tidak valid/,
  )
  assert.throws(
    () => parseRejectedUnitLetterQuery({ itemNos: ['1', '2'] }),
    /expected string/,
  )
})

test('creates a safe attachment filename from the submission and server date', () => {
  const filename = createRejectedUnitLetterDownloadFilename(
    '../KG/2026\\0001',
    '06/10/2026',
  )

  assert.equal(filename, 'surat-permohonan-KG-2026-0001-06102026.pdf')
  assert.equal(filename.includes('/'), false)
  assert.equal(filename.includes('\\'), false)
})
