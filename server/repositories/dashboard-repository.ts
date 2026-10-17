import { and, count, countDistinct, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import type { DashboardChartPoint, DashboardSummary } from '../../shared/types/dashboard'
import type { MaukagaDatabase } from '../database'
import { pengajuan, pengajuanItems } from '../database/schema'

export async function readDashboardSummary(
  database: MaukagaDatabase,
  range: { from: Date; to: Date },
): Promise<DashboardSummary> {
  const submittedAt = sql<number>`coalesce(${pengajuan.submittedAt}, ${pengajuan.createdAt})`
  const [summary] = await database
    .select({
      totalPengajuan: countDistinct(pengajuan.id),
      pengajuanBaru: countDistinct(sql`case when ${pengajuan.status} = 'Baru' then ${pengajuan.id} end`),
      itemDisetujui: count(sql`case when ${pengajuanItems.keputusanItem} = 'Disetujui' then ${pengajuanItems.id} end`),
      itemDitolak: count(sql`case when ${pengajuanItems.keputusanItem} = 'Ditolak' then ${pengajuanItems.id} end`),
    })
    .from(pengajuan)
    .leftJoin(pengajuanItems, eq(pengajuanItems.pengajuanId, pengajuan.id))
    .where(and(
      isNull(pengajuan.deletedAt),
      gte(submittedAt, range.from.getTime()),
      lt(submittedAt, range.to.getTime()),
    ))

  if (!summary) throw new Error('Ringkasan dashboard tidak dapat dibaca')
  return summary
}

export interface DashboardChartBucket {
  date: Date
  from: Date
  to: Date
}

export async function readDashboardChart(
  database: MaukagaDatabase,
  range: { from: Date; to: Date },
  buckets: DashboardChartBucket[],
): Promise<DashboardChartPoint[]> {
  const submittedAt = sql<number>`coalesce(${pengajuan.submittedAt}, ${pengajuan.createdAt})`
  const rows = await database
    .select({
      submittedAt: pengajuan.submittedAt,
      createdAt: pengajuan.createdAt,
      decision: pengajuanItems.keputusanItem,
    })
    .from(pengajuan)
    .leftJoin(pengajuanItems, eq(pengajuanItems.pengajuanId, pengajuan.id))
    .where(and(
      isNull(pengajuan.deletedAt),
      gte(submittedAt, range.from.getTime()),
      lt(submittedAt, range.to.getTime()),
    ))

  const points = buckets.map(bucket => ({
    date: bucket.date.toISOString(),
    itemPengajuan: 0,
    itemDisetujui: 0,
    itemDitolak: 0,
  }))

  for (const row of rows) {
    if (!row.decision) continue
    const timestamp = (row.submittedAt ?? row.createdAt).getTime()
    const bucketIndex = buckets.findIndex(bucket => timestamp >= bucket.from.getTime() && timestamp < bucket.to.getTime())
    if (bucketIndex < 0) continue
    const point = points[bucketIndex]
    if (!point) continue

    point.itemPengajuan += 1
    if (row.decision === 'Disetujui') point.itemDisetujui += 1
    if (row.decision === 'Ditolak') point.itemDitolak += 1
  }

  return points
}
