import { getRouterParam, readBody } from 'h3'
import { updatePengajuanStatus } from '../../../services/pengajuan-service'
import { normalizeApiError } from '../../../utils/api-error'
import { requireApiSession } from '../../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireApiSession(event, ['admin', 'qrcc'])
    return updatePengajuanStatus(getRouterParam(event, 'idPengajuan') ?? '', await readBody(event), {
      actorId: user.id,
      actorRole: user.role,
    })
  } catch (error) {
    normalizeApiError(error)
  }
})
