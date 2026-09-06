import { eq } from 'drizzle-orm'
import { db, type Database } from '../database'
import { modelProduk, pengajuan, pengajuanItems } from '../database/schema'
import { PENGAJUAN_STATUSES } from '../database/schema/constants'

type LocalWarrantyPrintQueueQuery = {
  search?: unknown
  jenisKartu?: unknown
  includePrinted?: unknown
  onlyUnsent?: unknown
}

type LocalWarrantyPrintQueueRow = {
  key: string
  idPengajuan: string
  noItem: number | string
  produk: string
  model: string
  nomorSeri: string
  origin: string
  jenisKartu: string
  jenisKartuKey: string
  statusCetak: string
  printBatchId: string
  printedAt: string
  statusKirim: string
  shippedAt: string
  shipBatchId: string
  nama: string
  bagianCabang: string
  timestampSubmit: string
  reprintCount: number
}

type LocalWarrantyPrintQueueSummary = {
  total: number
  local: number
  import: number
  belumJenisKartu: number
  printed: number
}

export type LocalWarrantyPrintQueueResponse = {
  rows: LocalWarrantyPrintQueueRow[]
  summary: LocalWarrantyPrintQueueSummary
}

type WarrantyCardTypeKey = 'local' | 'import'

const PRINTABLE_PENGAJUAN_STATUSES = new Set<string>(PENGAJUAN_STATUSES.filter((status) => status !== 'Menunggu Upload'))

function toText(value: unknown) {
  return String(value || '').trim()
}

function toBoolean(value: unknown) {
  if (value === true || value === 'true' || value === 'yes' || value === '1' || value === 1) return true
  if (value === false || value === 'false' || value === 'no' || value === '0' || value === 0) return false
  return false
}

function toIso(value: unknown) {
  const text = toText(value)
  if (!text) return ''
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? text : date.toISOString()
}

function normalizeModelKey(value: unknown) {
  return toText(value).toLowerCase()
}

function normalizeCardType(value: unknown, required = false): WarrantyCardTypeKey | '' {
  const normalized = toText(value).toLowerCase()
  if (!normalized) {
    if (required) throw new Error('Jenis kartu wajib dipilih')
    return ''
  }
  if (normalized === 'local' || normalized === 'lokal') return 'local'
  if (normalized === 'import' || normalized === 'impor') return 'import'
  throw new Error(`Jenis kartu tidak valid: ${value}`)
}

function normalizeDecision(value: unknown) {
  const normalized = toText(value)
  if (normalized === 'Disetujui' || normalized === 'Ditolak') return normalized
  return ''
}

function buildPrintRowKey(idPengajuan: unknown, noItem: unknown) {
  return `${toText(idPengajuan)}::${toText(noItem)}`
}

function sortQueueRows(a: LocalWarrantyPrintQueueRow, b: LocalWarrantyPrintQueueRow) {
  const typeOrder: Record<string, number> = { local: 1, import: 2, '': 3 }
  const aType = typeOrder[a.jenisKartuKey || ''] || 3
  const bType = typeOrder[b.jenisKartuKey || ''] || 3

  if (aType !== bType) return aType - bType

  const aTime = new Date(a.timestampSubmit || 0).getTime()
  const bTime = new Date(b.timestampSubmit || 0).getTime()
  if (aTime !== bTime) return aTime - bTime

  if (a.idPengajuan !== b.idPengajuan) return String(a.idPengajuan).localeCompare(String(b.idPengajuan))
  return Number(a.noItem) - Number(b.noItem)
}

export function buildLocalWarrantyPrintQueueResponse(
  parents: Array<typeof pengajuan.$inferSelect>,
  items: Array<typeof pengajuanItems.$inferSelect>,
  modelRows: Array<typeof modelProduk.$inferSelect>,
  query: LocalWarrantyPrintQueueQuery = {},
): LocalWarrantyPrintQueueResponse {
  const search = toText(query.search).toLowerCase()
  const cardType = normalizeCardType(query.jenisKartu)
  const includePrinted = toBoolean(query.includePrinted)
  const onlyUnsent = toBoolean(query.onlyUnsent)

  const pengajuanMap = new Map<string, typeof pengajuan.$inferSelect>()
  parents.forEach((row) => {
    const id = toText(row.idPengajuan)
    if (!id) return
    if (!PRINTABLE_PENGAJUAN_STATUSES.has(toText(row.status))) return
    pengajuanMap.set(id, row)
  })

  const modelMap = new Map<string, typeof modelProduk.$inferSelect>()
  modelRows.forEach((row) => {
    const modelKey = normalizeModelKey(row.model)
    if (!modelKey) return
    if (toText(row.status) !== 'verified') return
    modelMap.set(modelKey, row)
  })

  const rows = items
    .map((row) => {
      const idPengajuan = toText(row.idPengajuan)
      const parent = pengajuanMap.get(idPengajuan)
      if (!parent) return null

      const decision = normalizeDecision(row.keputusanItem)
      if (decision !== 'Disetujui') return null
      if (toText(row.produkStatus) !== 'verified') return null
      if (!includePrinted && toText(row.statusCetak) === 'Printed') return null
      if (onlyUnsent && toText(row.statusKirim) !== 'Belum Dikirim') return null

      const modelKey = normalizeModelKey(row.modelNormalized || row.model)
      const master = modelMap.get(modelKey) || null
      const originJenisKartu = normalizeCardType(master?.origin, false)
      const jenisKartu = normalizeCardType(row.jenisKartu, false) || originJenisKartu

      return {
        key: buildPrintRowKey(idPengajuan, row.noItem),
        idPengajuan,
        noItem: row.noItem,
        produk: toText(row.produk || master?.produk),
        model: toText(row.model),
        nomorSeri: toText(row.nomorSeri),
        origin: toText(master?.origin),
        jenisKartu: jenisKartu === 'local' ? 'Local' : jenisKartu === 'import' ? 'Import' : '',
        jenisKartuKey: jenisKartu,
        statusCetak: toText(row.statusCetak) || 'Belum Dicetak',
        printBatchId: toText(row.printBatchId),
        printedAt: toIso(row.printedAt),
        statusKirim: toText(row.statusKirim) || 'Belum Dikirim',
        shippedAt: toIso(row.shippedAt),
        shipBatchId: toText(row.shipBatchId),
        nama: toText(parent.nama),
        bagianCabang: toText(parent.bagianCabang),
        timestampSubmit: toIso(parent.timestampSubmit),
        reprintCount: 0
      } satisfies LocalWarrantyPrintQueueRow
    })
    .filter(Boolean) as LocalWarrantyPrintQueueRow[]

  const filteredRows = rows
    .filter((row) => {
      if (cardType === 'local' || cardType === 'import') {
        return row.jenisKartuKey === cardType
      }

      return true
    })
    .filter((row) => {
      if (!search) return true

      return [
        row.idPengajuan,
        row.nama,
        row.bagianCabang,
        row.produk,
        row.model,
        row.nomorSeri
      ].some((value) => toText(value).toLowerCase().includes(search))
    })
    .sort(sortQueueRows)

  const summary = filteredRows.reduce<LocalWarrantyPrintQueueSummary>((acc, row) => {
    acc.total += 1
    if (row.jenisKartuKey === 'local') acc.local += 1
    else if (row.jenisKartuKey === 'import') acc.import += 1
    else acc.belumJenisKartu += 1
    if (row.statusCetak === 'Printed') acc.printed += 1
    return acc
  }, {
    total: 0,
    local: 0,
    import: 0,
    belumJenisKartu: 0,
    printed: 0
  })

  return { rows: filteredRows, summary }
}

export async function getLocalWarrantyPrintQueue(
  query: LocalWarrantyPrintQueueQuery = {},
  database: Database = db,
): Promise<LocalWarrantyPrintQueueResponse> {
  const [parents, items, models] = await Promise.all([
    database.select().from(pengajuan),
    database.select().from(pengajuanItems),
    database.select().from(modelProduk).where(eq(modelProduk.status, 'verified')),
  ])

  return buildLocalWarrantyPrintQueueResponse(parents, items, models, query)
}
