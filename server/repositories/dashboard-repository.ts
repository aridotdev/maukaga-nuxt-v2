import { and, count, countDistinct, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import type {
  DashboardChartPoint,
  DashboardRecentSubmission,
  DashboardSummary,
  DashboardTopModel,
  DashboardTopPemohon,
} from '../../shared/types/dashboard'
import type { MaukagaDatabase } from '../database'
import { pengajuan, pengajuanItems } from '../database/schema'

type DashboardRange = { from: Date; to: Date }

const submittedAt = sql<number>`coalesce(${pengajuan.submittedAt}, ${pengajuan.createdAt})`

function withinRange(range: DashboardRange) {
  return and(
    isNull(pengajuan.deletedAt),
    gte(submittedAt, range.from.getTime()),
    lt(submittedAt, range.to.getTime()),
  )
}

export async function readDashboardSummary(
  database: MaukagaDatabase,
  range: DashboardRange,
): Promise<DashboardSummary> {
  const [summary] = await database
    .select({
      totalPengajuan: countDistinct(pengajuan.id),
      pengajuanBaru: countDistinct(sql`case when ${pengajuan.status} = 'Baru' then ${pengajuan.id} end`),
      itemDisetujui: count(sql`case when ${pengajuanItems.keputusanItem} = 'Disetujui' then ${pengajuanItems.id} end`),
      itemDitolak: count(sql`case when ${pengajuanItems.keputusanItem} = 'Ditolak' then ${pengajuanItems.id} end`),
    })
    .from(pengajuan)
    .leftJoin(pengajuanItems, eq(pengajuanItems.pengajuanId, pengajuan.id))
    .where(withinRange(range))

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
  range: DashboardRange,
  buckets: DashboardChartBucket[],
): Promise<DashboardChartPoint[]> {
  const rows = await database
    .select({
      submittedAt: pengajuan.submittedAt,
      createdAt: pengajuan.createdAt,
      decision: pengajuanItems.keputusanItem,
    })
    .from(pengajuan)
    .leftJoin(pengajuanItems, eq(pengajuanItems.pengajuanId, pengajuan.id))
    .where(withinRange(range))

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

export async function readDashboardRecentSubmissions(
  database: MaukagaDatabase,
  range: DashboardRange,
): Promise<DashboardRecentSubmission[]> {
  const rows = await database
    .select({
      idPengajuan: pengajuan.idPengajuan,
      nama: pengajuan.nama,
      cabang: pengajuan.cabang,
      status: pengajuan.status,
      submittedAt: pengajuan.submittedAt,
      createdAt: pengajuan.createdAt,
      itemCount: count(pengajuanItems.id),
    })
    .from(pengajuan)
    .leftJoin(pengajuanItems, eq(pengajuanItems.pengajuanId, pengajuan.id))
    .where(withinRange(range))
    .groupBy(pengajuan.id)
    .orderBy(desc(submittedAt), desc(pengajuan.id))
    .limit(5)

  return rows.map(row => ({
    idPengajuan: row.idPengajuan,
    nama: row.nama,
    cabang: row.cabang,
    status: row.status,
    submittedAt: (row.submittedAt ?? row.createdAt).toISOString(),
    itemCount: row.itemCount,
  }))
}

export async function readDashboardTopModels(
  database: MaukagaDatabase,
  range: DashboardRange,
): Promise<DashboardTopModel[]> {
  return database
    .select({
      model: sql<string>`min(${pengajuanItems.model})`,
      itemCount: count(pengajuanItems.id),
    })
    .from(pengajuanItems)
    .innerJoin(pengajuan, eq(pengajuanItems.pengajuanId, pengajuan.id))
    .where(withinRange(range))
    .groupBy(pengajuanItems.modelNormalized)
    .orderBy(desc(count(pengajuanItems.id)), pengajuanItems.modelNormalized)
    .limit(5)
}

export async function readDashboardTopPemohon(
  database: MaukagaDatabase,
  range: DashboardRange,
): Promise<DashboardTopPemohon[]> {
  return database
    .select({
      nama: pengajuan.nama,
      bagian: pengajuan.bagian,
      cabang: pengajuan.cabang,
      submissionCount: count(pengajuan.id),
    })
    .from(pengajuan)
    .where(withinRange(range))
    .groupBy(pengajuan.nama, pengajuan.bagian, pengajuan.cabang)
    .orderBy(desc(count(pengajuan.id)), pengajuan.nama, pengajuan.bagian, pengajuan.cabang)
    .limit(5)
}
