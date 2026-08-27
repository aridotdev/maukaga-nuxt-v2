export type DashboardSummary = {
  total?: number
  totalItems?: number
  baru?: number
  disetujui?: number
  ditolak?: number
  diprint?: number
  dikirim?: number
  selesai?: number
  itemDisetujui?: number
  itemDitolak?: number
}

export type DashboardItem = {
  noItem: number | string
  model?: string
  nomorSeri?: string
  keputusanItem?: string
}

export type DashboardRow = {
  idPengajuan: string
  timestampSubmit: string
  nama: string
  bagianCabang: string
  pemilik?: string
  alasanPengajuan?: string
  tanggalForm?: string
  catatanTambahan?: string
  jumlahItem: number | string
  status: string
  items?: DashboardItem[]
}

export type DashboardResponse = {
  summary?: DashboardSummary
  rows?: DashboardRow[]
  totalRows?: number
  page?: number
  pageSize?: number
  admin?: string
}

export type DashboardChartPoint = {
  period: string
  totalItems: number
  approvedItems: number
  rejectedItems: number
}

export type DashboardChartResponse = {
  points?: DashboardChartPoint[]
  summary?: {
    totalItems: number
    approvedItems: number
    rejectedItems: number
  }
  groupBy?: 'day' | 'week' | 'month' | 'year'
  startDate?: string
  endDate?: string
  admin?: string
}

export type DetailItem = {
  noItem?: number | string
  produk?: string
  model?: string
  nomorSeri?: string
  keputusanItem?: string
  [key: string]: unknown
}

export type DetailPengajuan = DashboardRow & {
  status: string
  catatanAdmin?: string
  fileHardCopyUrl?: string
  fileHardCopyId?: string
  evidenceAttachmentUrls?: string[]
  evidenceAttachmentIds?: string[]
  items?: DetailItem[]
  riwayat?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export type DetailMutationResponse = {
  detail?: DetailPengajuan
  row?: DashboardRow
  status?: string
  keputusanItem?: string
}
