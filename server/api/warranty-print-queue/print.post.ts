import { readBody } from 'h3'
import { markWarrantyCardsPrinted } from '../../services/pengajuan-service'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireApiSession(event, ['admin', 'qrcc'])

    return markWarrantyCardsPrinted(await readBody(event), {
      actorId: user.id,
    })
  } catch (error) {
    normalizeApiError(error)
  }
})
