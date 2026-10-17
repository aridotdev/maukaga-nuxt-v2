export const DASHBOARD_PERIODS = [
  'This month',
  'Last month',
  'Last 3 months',
  'Last 6 months',
  'This year',
  'Last year',
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

export interface DashboardResponse {
  period: DashboardPeriod
  range: {
    from: string
    to: string
    timeZone: string
  }
  summary: DashboardSummary
  chart: DashboardChartPoint[]
}
