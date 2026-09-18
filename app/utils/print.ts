import type {
  ShippingLabel,
  ShippingLabelQueueRow,
  WarrantyCardType,
  WarrantyCardTypeKey,
  WarrantyPrintQueueRow,
} from '~/types/print'

export function getWarrantyPrintRowKey(row: Pick<WarrantyPrintQueueRow, 'idPengajuan' | 'noItem' | 'key'>) {
  const idPengajuan = String(row.idPengajuan || '').trim()
  const noItem = String(row.noItem || '').trim()

  return idPengajuan && noItem ? `${idPengajuan}::${noItem}` : row.key
}

export function matchesWarrantyPrintSearch(row: WarrantyPrintQueueRow, keyword: string) {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return true

  return [
    row.idPengajuan,
    row.bagianCabang,
    row.nama,
    row.produk,
    row.model,
    row.nomorSeri,
    row.jenisKartu,
  ].some(value => String(value || '').toLowerCase().includes(needle))
}

export function getWarrantyCardTypeKey(value: WarrantyCardType | ''): WarrantyCardTypeKey | '' {
  if (value === 'Local') return 'local'
  if (value === 'Import') return 'import'
  return ''
}

export function getWarrantyCardTypeLabel(value: WarrantyCardType | '') {
  return value || 'Belum Dipilih'
}

export function getWarrantyCardTypeFromKey(value: WarrantyCardTypeKey): WarrantyCardType {
  return value === 'local' ? 'Local' : 'Import'
}

export function getShippingLabelRowKey(row: Pick<ShippingLabelQueueRow, 'idPengajuan' | 'noItem' | 'key'>) {
  const idPengajuan = String(row.idPengajuan || '').trim()
  const noItem = String(row.noItem || '').trim()

  return idPengajuan && noItem ? `${idPengajuan}::${noItem}` : row.key
}

export function getShippingLabelGroupKey(
  row: Pick<ShippingLabelQueueRow, 'nama' | 'bagianCabang'>,
) {
  return `${normalizePrintGroupValue(row.nama)}::${normalizePrintGroupValue(row.bagianCabang)}`
}

export function buildShippingLabels(rows: ShippingLabelQueueRow[]): ShippingLabel[] {
  const groups = new Map<string, ShippingLabel>()

  for (const row of rows) {
    const key = getShippingLabelGroupKey(row)
    const current = groups.get(key)

    if (current) {
      current.qty += 1
      continue
    }

    groups.set(key, {
      nama: row.nama.trim() || 'Tanpa Nama',
      bagianCabang: row.bagianCabang.trim() || 'Tanpa Bagian/Cabang',
      qty: 1,
    })
  }

  return [...groups.values()].sort((a, b) =>
    a.bagianCabang.localeCompare(b.bagianCabang, 'id-ID')
    || a.nama.localeCompare(b.nama, 'id-ID'),
  )
}

export function chunkShippingLabels(labels: ShippingLabel[], pageSize = 15) {
  const pages: ShippingLabel[][] = []

  for (let index = 0; index < labels.length; index += pageSize) {
    pages.push(labels.slice(index, index + pageSize))
  }

  return pages
}

export function matchesShippingLabelSearch(row: ShippingLabelQueueRow, keyword: string) {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return true

  return [
    row.idPengajuan,
    row.bagianCabang,
    row.nama,
    row.produk,
    row.model,
    row.nomorSeri,
  ].some(value => String(value || '').toLowerCase().includes(needle))
}

function normalizePrintGroupValue(value: string) {
  return value.trim().toLowerCase() || '-'
}
