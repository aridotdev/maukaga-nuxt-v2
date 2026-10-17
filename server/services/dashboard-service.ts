import { parseDate } from '@internationalized/date'
import { z } from 'zod'
import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
  type DashboardResponse,
} from '../../shared/types/dashboard'
import { type MaukagaDatabase, useDb } from '../database'
import {
  readDashboardChart,
  readDashboardRecentSubmissions,
  readDashboardSummary,
  readDashboardTopModels,
  readDashboardTopPemohon,
  type DashboardChartBucket,
} from '../repositories/dashboard-repository'
import { getApplicationTimeZone, getPengajuanSequenceDate } from './pengajuan-id-service'

export const dashboardQuerySchema = z.object({
  period: z.enum(DASHBOARD_PERIODS).default('This month'),
})

interface DashboardServiceOptions {
  database?: MaukagaDatabase
  now?: Date
  timeZone?: string
}

export function resolveDashboardPeriod(
  period: DashboardPeriod,
  now = new Date(),
  timeZone = getApplicationTimeZone(),
): { from: Date; to: Date } {
  const monthStart = parseDate(getPengajuanSequenceDate(now, timeZone)).set({ day: 1 })
  let from = monthStart
  let to = monthStart.add({ months: 1 })

  switch (period) {
    case 'Last month':
      from = monthStart.subtract({ months: 1 })
      to = monthStart
      break
    case 'Last 3 months':
      from = monthStart.subtract({ months: 2 })
      break
    case 'Last 6 months':
      from = monthStart.subtract({ months: 5 })
      break
    case 'This year':
      from = monthStart.set({ month: 1 })
      to = from.add({ years: 1 })
      break
    case 'Last year':
      to = monthStart.set({ month: 1 })
      from = to.subtract({ years: 1 })
      break
  }

  return { from: from.toDate(timeZone), to: to.toDate(timeZone) }
}

export async function getDashboardSummary(
  input: unknown = {},
  options: DashboardServiceOptions = {},
): Promise<DashboardResponse> {
  const { period } = dashboardQuerySchema.parse(input)
  const timeZone = options.timeZone ?? getApplicationTimeZone()
  const range = resolveDashboardPeriod(period, options.now, timeZone)
  const database = options.database ?? useDb()
  const [summary, chart, recentSubmissions, topModels, topPemohon] = await Promise.all([
    readDashboardSummary(database, range),
    readDashboardChart(database, range, createDashboardChartBuckets(period, range, timeZone)),
    readDashboardRecentSubmissions(database, range),
    readDashboardTopModels(database, range),
    readDashboardTopPemohon(database, range),
  ])

  return {
    period,
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      timeZone,
    },
    summary,
    chart,
    recentSubmissions,
    topModels,
    topPemohon,
  }
}

function getLocalDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function createDashboardChartBuckets(
  period: DashboardPeriod,
  range: { from: Date; to: Date },
  timeZone: string,
): DashboardChartBucket[] {
  const firstDate = parseDate(getLocalDateKey(range.from, timeZone))
  const lastDate = parseDate(getLocalDateKey(new Date(range.to.getTime() - 1), timeZone))
  const monthly = period !== 'This month' && period !== 'Last month'
  const buckets: DashboardChartBucket[] = []
  let cursor = monthly ? firstDate.set({ day: 1 }) : firstDate

  while (cursor.compare(lastDate) <= 0) {
    const next = monthly ? cursor.add({ months: 1 }) : cursor.add({ days: 1 })
    buckets.push({
      date: cursor.toDate(timeZone),
      from: cursor.toDate(timeZone),
      to: next.toDate(timeZone),
    })
    cursor = next
  }

  return buckets
}
