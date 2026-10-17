import {
  ITEM_DECISION_STATUSES,
  ITEM_PRINT_STATUSES,
  ITEM_SHIPPING_STATUSES,
  PENGAJUAN_STATUSES,
  WARRANTY_CARD_TYPES,
} from '../server/database/schema/constants'

export const PENGAJUAN_HEADERS = [
  'id_pengajuan',
  'nama',
  'bagian',
  'cabang',
  'pemilik',
  'alasan_pengajuan',
  'tanggal_form',
  'status',
] as const

export const ITEM_HEADERS = [
  'id_pengajuan',
  'no_item',
  'produk',
  'model',
  'nomor_seri',
  'keputusan_item',
  'catatan_keputusan',
  'jenis_kartu',
  'status_cetak',
  'status_kirim',
] as const

export interface LegacyPengajuanRow {
  line: number
  idPengajuan: string
  nama: string
  bagian: string
  cabang: string
  pemilik: string
  alasanPengajuan: string
  tanggalForm: string
  status: typeof PENGAJUAN_STATUSES[number]
}

export interface LegacyItemRow {
  line: number
  idPengajuan: string
  noItem: number
  produk: string
  model: string
  nomorSeri: string
  keputusanItem: typeof ITEM_DECISION_STATUSES[number]
  catatanKeputusan: string | null
  jenisKartu: typeof WARRANTY_CARD_TYPES[number]
  statusCetak: typeof ITEM_PRINT_STATUSES[number]
  statusKirim: typeof ITEM_SHIPPING_STATUSES[number]
}

export interface CsvIssue {
  file: 'pengajuan' | 'item'
  line: number
  message: string
}

export function parseLegacyPengajuanCsv(input: string) {
  const { headers, rows } = parseSemicolonCsv(input)
  validateHeaders(headers, PENGAJUAN_HEADERS, 'pengajuan')

  const data: LegacyPengajuanRow[] = []
  const issues: CsvIssue[] = []

  for (const row of rows) {
    if (row.values.every(value => !value.trim())) continue
    if (row.values.length !== PENGAJUAN_HEADERS.length) {
      issues.push(issue('pengajuan', row.line, `jumlah kolom harus ${PENGAJUAN_HEADERS.length}, ditemukan ${row.values.length}`))
      continue
    }

    const values = mapValues(PENGAJUAN_HEADERS, row.values)
    const requiredError = findMissingRequired(values)
    if (requiredError) {
      issues.push(issue('pengajuan', row.line, `${requiredError} wajib diisi`))
      continue
    }
    if (!/^KG-\d{8}-\d{4}$/.test(values.id_pengajuan)) {
      issues.push(issue('pengajuan', row.line, 'id_pengajuan harus mengikuti format KG-YYYYMMDD-NNNN'))
      continue
    }
    const idDate = values.id_pengajuan.slice(3, 11)
    const idSequence = Number(values.id_pengajuan.slice(12))
    if (!isValidCompactDate(idDate)) {
      issues.push(issue('pengajuan', row.line, 'tanggal pada id_pengajuan tidak valid'))
      continue
    }
    if (idSequence < 1) {
      issues.push(issue('pengajuan', row.line, 'nomor urut pada id_pengajuan harus lebih besar dari nol'))
      continue
    }
    if (!isValidIsoDate(values.tanggal_form)) {
      issues.push(issue('pengajuan', row.line, 'tanggal_form harus berupa tanggal valid dengan format YYYY-MM-DD'))
      continue
    }
    if (!isEnumValue(PENGAJUAN_STATUSES, values.status)) {
      issues.push(issue('pengajuan', row.line, `status harus salah satu dari: ${PENGAJUAN_STATUSES.join(', ')}`))
      continue
    }

    data.push({
      line: row.line,
      idPengajuan: values.id_pengajuan,
      nama: values.nama,
      bagian: values.bagian,
      cabang: values.cabang,
      pemilik: values.pemilik,
      alasanPengajuan: values.alasan_pengajuan,
      tanggalForm: values.tanggal_form,
      status: values.status,
    })
  }

  return { data, issues }
}

export function parseLegacyItemCsv(input: string) {
  const { headers, rows } = parseSemicolonCsv(input)
  validateHeaders(headers, ITEM_HEADERS, 'item')

  const data: LegacyItemRow[] = []
  const issues: CsvIssue[] = []

  for (const row of rows) {
    if (row.values.every(value => !value.trim())) continue
    if (row.values.length !== ITEM_HEADERS.length) {
      issues.push(issue('item', row.line, `jumlah kolom harus ${ITEM_HEADERS.length}, ditemukan ${row.values.length}`))
      continue
    }

    const values = mapValues(ITEM_HEADERS, row.values)
    const requiredError = findMissingRequired(values, ['catatan_keputusan'])
    if (requiredError) {
      issues.push(issue('item', row.line, `${requiredError} wajib diisi`))
      continue
    }

    const noItem = Number(values.no_item)
    if (!Number.isInteger(noItem) || noItem < 1) {
      issues.push(issue('item', row.line, 'no_item harus berupa bilangan bulat positif'))
      continue
    }
    if (!isEnumValue(ITEM_DECISION_STATUSES, values.keputusan_item)) {
      issues.push(issue('item', row.line, `keputusan_item harus salah satu dari: ${ITEM_DECISION_STATUSES.join(', ')}`))
      continue
    }
    if (!isEnumValue(WARRANTY_CARD_TYPES, values.jenis_kartu)) {
      issues.push(issue('item', row.line, `jenis_kartu harus salah satu dari: ${WARRANTY_CARD_TYPES.join(', ')}`))
      continue
    }
    if (!isEnumValue(ITEM_PRINT_STATUSES, values.status_cetak)) {
      issues.push(issue('item', row.line, `status_cetak harus salah satu dari: ${ITEM_PRINT_STATUSES.join(', ')}`))
      continue
    }
    if (!isEnumValue(ITEM_SHIPPING_STATUSES, values.status_kirim)) {
      issues.push(issue('item', row.line, `status_kirim harus salah satu dari: ${ITEM_SHIPPING_STATUSES.join(', ')}`))
      continue
    }

    data.push({
      line: row.line,
      idPengajuan: values.id_pengajuan,
      noItem,
      produk: values.produk,
      model: normalizeBusinessKey(values.model),
      nomorSeri: values.nomor_seri,
      keputusanItem: values.keputusan_item,
      catatanKeputusan: values.catatan_keputusan || null,
      jenisKartu: values.jenis_kartu,
      statusCetak: values.status_cetak,
      statusKirim: values.status_kirim,
    })
  }

  return { data, issues }
}

export function parseSemicolonCsv(input: string) {
  const records: Array<{ line: number, values: string[] }> = []
  let values: string[] = []
  let value = ''
  let quoted = false
  let line = 1
  let recordLine = 1

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    const nextCharacter = input[index + 1]

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ';' && !quoted) {
      values.push(value.trim())
      value = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1
      values.push(value.trim())
      records.push({ line: recordLine, values })
      values = []
      value = ''
      line += 1
      recordLine = line
    } else {
      value += character
      if (character === '\n') line += 1
    }
  }

  if (quoted) throw new Error('CSV memiliki tanda kutip yang tidak berpasangan.')
  if (value || values.length) {
    values.push(value.trim())
    records.push({ line: recordLine, values })
  }
  if (!records.length) throw new Error('File CSV kosong.')

  const [headerRecord, ...rows] = records
  const headers = headerRecord!.values.map(value => value.replace(/^\uFEFF/, '').toLowerCase())
  return { headers, rows }
}

export function normalizeBusinessKey(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function getSubmissionDate(idPengajuan: string) {
  const date = idPengajuan.slice(3, 11)
  return new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00+07:00`)
}

function validateHeaders(
  actual: string[],
  expected: readonly string[],
  fileName: string,
) {
  if (actual.length !== expected.length || expected.some((header, index) => actual[index] !== header)) {
    throw new Error(`Header CSV ${fileName} harus tepat dan berurutan: ${expected.join(';')}`)
  }
}

function mapValues<const T extends readonly string[]>(headers: T, values: string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, values[index]!.trim()])) as Record<T[number], string>
}

function findMissingRequired(values: Record<string, string>, optionalKeys: readonly string[] = []) {
  return Object.entries(values).find(([key, value]) => !optionalKeys.includes(key) && !value)?.[0]
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function isValidCompactDate(value: string) {
  if (!/^\d{8}$/.test(value)) return false
  return isValidIsoDate(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`)
}

function isEnumValue<const T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number])
}

function issue(file: CsvIssue['file'], line: number, message: string): CsvIssue {
  return { file, line, message }
}
