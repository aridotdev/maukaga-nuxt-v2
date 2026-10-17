import { parseDate } from '@internationalized/date'
import { z } from 'zod'
import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
  type DashboardResponse,
} from '../../shared/types/dashboard'
import { type MaukagaDatabase, useDb } from '../database'
import { readDashboardSummary } from '../repositories/dashboard-repository'
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
  const summary = await readDashboardSummary(options.database ?? useDb(), range)

  return {
    period,
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      timeZone,
    },
    summary,
  }
}
