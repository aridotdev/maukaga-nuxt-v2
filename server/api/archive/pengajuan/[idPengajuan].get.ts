import { readArchiveDetailForAdmin } from '../../../services/archive-service'

export default defineEventHandler(async (event) => {
  const idPengajuan = getRouterParam(event, 'idPengajuan') || ''
  return await readArchiveDetailForAdmin(event, idPengajuan)
})
