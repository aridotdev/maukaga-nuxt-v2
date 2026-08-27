import type { DetailPengajuan } from '../../../utils/admin-cache/types'

export default defineEventHandler(async (event) => {
  const session = await requireAdminCacheSession(event)
  const idPengajuan = String(getRouterParam(event, 'id') || '').trim()

  if (!idPengajuan) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID Pengajuan tidak valid.'
    })
  }

  let detail = await getPengajuanDetailFromCache(idPengajuan)

  if (!detail || shouldBlockForDetailRefresh(detail)) {
    await syncAdminCache({ token: session.token, mode: 'detail', idPengajuan })
    detail = await getPengajuanDetailFromCache(idPengajuan)
  } else {
    triggerAdminCacheSync({ token: session.token, mode: 'detail', idPengajuan })
  }

  if (!detail) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Pengajuan tidak ditemukan.'
    })
  }

  return detail
})

function shouldBlockForDetailRefresh(detail: DetailPengajuan): boolean {
  const items = detail.items || []
  const totalItems = Number(detail.jumlahItem || items.length || 0)

  return totalItems > 0 && items.length === 0
}
