export const DASHBOARD_PERIODS = [
  'This month',
  'Last month',
  'Last 3 months',
  'Last 6 months',
  'This year',
  'Last year',
  'All time',
] as const

export type DashboardPeriod = typeof DASHBOARD_PERIODS[number]

export interface DashboardSummary {
  totalPengajuan: number
  pengajuanBaru: number
  itemDisetujui: number
  itemDitolak: number
}

export interface DashboardChartPoint {
  date: string
  itemPengajuan: number
  itemDisetujui: number
  itemDitolak: number
}

export interface DashboardRecentSubmission {
  idPengajuan: string
  nama: string
  cabang: string
  status: string
  submittedAt: string
  itemCount: number
}

export interface DashboardTopModel {
  model: string
  itemCount: number
}

export interface DashboardTopPemohon {
  nama: string
  bagian: string
  cabang: string
  itemCount: number
}

export interface DashboardResponse {
  period: DashboardPeriod
  range: {
    from: string
    to: string
    timeZone: string
  }
  summary: DashboardSummary
  chart: DashboardChartPoint[]
  recentSubmissions: DashboardRecentSubmission[]
  topModels: DashboardTopModel[]
  topPemohon: DashboardTopPemohon[]
}
