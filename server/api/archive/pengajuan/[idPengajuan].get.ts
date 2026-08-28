import { readArchiveDetail } from '../../../utils/archive-dashboard'

export default defineEventHandler(async (event) => {
  const idPengajuan = getRouterParam(event, 'idPengajuan') || ''
  return await readArchiveDetail(idPengajuan)
})
