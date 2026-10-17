import { and, count, countDistinct, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import type { DashboardSummary } from '../../shared/types/dashboard'
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
