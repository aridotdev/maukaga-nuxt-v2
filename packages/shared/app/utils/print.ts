import type { ShippingLabel, WarrantyPrintQueueRow } from '../types/print'

export function buildShippingLabels(rows: WarrantyPrintQueueRow[]) {
  const groups = new Map<string, ShippingLabel>()

  rows.forEach((row) => {
    const cabang = String(row.bagianCabang || '').trim() || 'Tanpa Cabang'
    const nama = String(row.nama || '').trim() || 'Tanpa Nama'
    const key = `${cabang.toLowerCase()}|${nama.toLowerCase()}`

    if (!groups.has(key)) groups.set(key, { cabang, nama, qty: 0 })
    groups.get(key)!.qty += 1
  })

  return Array.from(groups.values()).sort((a, b) => {
    const cabangSort = a.cabang.localeCompare(b.cabang, 'id-ID')
    if (cabangSort !== 0) return cabangSort

    return a.nama.localeCompare(b.nama, 'id-ID')
  })
}

export function chunkShippingLabels(labels: ShippingLabel[]) {
  const pages: ShippingLabel[][] = []

  for (let index = 0; index < labels.length; index += 24) {
    pages.push(labels.slice(index, index + 24))
  }

  return pages
}

export function getPrintGroupKey(row: Pick<WarrantyPrintQueueRow, 'bagianCabang' | 'nama'>) {
  const cabang = String(row.bagianCabang || '').trim().toLowerCase() || 'tanpa cabang'
  const nama = String(row.nama || '').trim().toLowerCase() || 'tanpa nama'

  return `${cabang}|${nama}`
}

export function matchesPrintRowSearch(row: WarrantyPrintQueueRow, keyword: string) {
  const needle = String(keyword || '').trim().toLowerCase()
  if (!needle) return true

  return [
    row.idPengajuan,
    row.bagianCabang,
    row.nama,
    row.produk,
    row.model,
    row.nomorSeri
  ].some((value) => String(value || '').toLowerCase().includes(needle))
}

export function getAlertColor(type: 'success' | 'error' | 'info' | 'loading') {
  const colors = {
    success: 'success',
    error: 'error',
    info: 'info',
    loading: 'info'
  } as const

  return colors[type]
}

export function getAlertIcon(type: 'success' | 'error' | 'info' | 'loading') {
  const icons = {
    success: 'i-lucide-circle-check',
    error: 'i-lucide-circle-alert',
    info: 'i-lucide-info',
    loading: 'i-lucide-loader-circle'
  } as const

  return icons[type]
}
