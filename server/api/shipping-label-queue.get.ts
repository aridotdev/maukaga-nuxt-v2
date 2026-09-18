import { listShippingLabelQueue } from '../services/pengajuan-service'
import { normalizeApiError } from '../utils/api-error'
import { requireApiSession } from '../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)
    return listShippingLabelQueue()
  } catch (error) {
    normalizeApiError(error)
  }
})
