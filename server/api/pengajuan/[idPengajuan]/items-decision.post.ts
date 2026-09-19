import { getRouterParam, readBody } from 'h3'
import { updateItemsDecision } from '../../../services/pengajuan-service'
import { normalizeApiError } from '../../../utils/api-error'
import { requireApiSession } from '../../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireApiSession(event, ['admin', 'qrcc'])
    return await updateItemsDecision(
      getRouterParam(event, 'idPengajuan') ?? '',
      await readBody(event),
      {
        actorId: user.id,
      },
    )
  } catch (error) {
    normalizeApiError(error)
  }
})
