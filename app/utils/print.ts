import type { WarrantyCardType, WarrantyCardTypeKey, WarrantyPrintQueueRow } from '~/types/print'

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
