import { getRouterParam } from 'h3'
import { getPengajuan } from '../../services/pengajuan-service'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)
    return getPengajuan(getRouterParam(event, 'idPengajuan') ?? '')
  } catch (error) {
    normalizeApiError(error)
  }
})
