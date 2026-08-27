import type { DashboardItem, DashboardRow, DetailItem, DetailPengajuan } from './types'

export type NormalizedPengajuan = {
  row: DashboardRow
  items: DashboardItem[]
}

export function normalizePengajuan(value: unknown): NormalizedPengajuan | null {
  const record = asRecord(value)
  const idPengajuan = clean(record.idPengajuan || record.id_pengajuan)

  if (!idPengajuan) return null

  const items = normalizeItems(record.items)
  const jumlahItem = Number(record.jumlahItem ?? record.jumlah_item ?? items.length)

  return {
    row: {
      idPengajuan,
      timestampSubmit: clean(record.timestampSubmit || record.timestamp_submit),
      nama: clean(record.nama),
      bagianCabang: clean(record.bagianCabang || record.bagian_cabang),
      pemilik: clean(record.pemilik),
      alasanPengajuan: clean(record.alasanPengajuan || record.alasan_pengajuan),
      tanggalForm: clean(record.tanggalForm || record.tanggal_form),
      catatanTambahan: clean(record.catatanTambahan || record.catatan_tambahan),
      jumlahItem: Number.isFinite(jumlahItem) ? jumlahItem : items.length,
      status: clean(record.status) || 'Baru',
      items
    },
    items
  }
}

export function normalizeDetail(value: unknown): DetailPengajuan | null {
  const record = asRecord(value)
  const base = normalizePengajuan(record)

  if (!base) return null

  return {
    ...record,
    ...base.row,
    status: String(base.row.status || 'Baru') as DetailPengajuan['status'],
    items: normalizeDetailItems(record.items),
    riwayat: Array.isArray(record.riwayat) ? record.riwayat : []
  } as DetailPengajuan
}

export function normalizeItems(value: unknown): DashboardItem[] {
  if (!Array.isArray(value)) return []

  return value.map((item, index) => {
    const record = asRecord(item)

    return {
      noItem: clean(record.noItem || record.no_item) || index + 1,
      model: clean(record.model),
      nomorSeri: clean(record.nomorSeri || record.nomor_seri),
      keputusanItem: clean(record.keputusanItem || record.keputusan_item)
    }
  })
}

export function normalizeDetailItems(value: unknown): DetailItem[] {
  if (!Array.isArray(value)) return []

  return value.map((item, index) => {
    const record = asRecord(item)
    const noItem = clean(record.noItem || record.no_item) || index + 1

    return {
      ...record,
      noItem,
      produk: clean(record.produk),
      model: clean(record.model),
      nomorSeri: clean(record.nomorSeri || record.nomor_seri),
      keputusanItem: clean(record.keputusanItem || record.keputusan_item)
    } as DetailItem
  })
}

export function toItemCacheId(idPengajuan: string, noItem: number | string, index: number) {
  return `${idPengajuan}::${String(noItem || index + 1)}`
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function clean(value: unknown) {
  return String(value ?? '').trim()
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
