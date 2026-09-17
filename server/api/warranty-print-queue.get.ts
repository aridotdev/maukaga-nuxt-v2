import { listWarrantyPrintQueue } from '../services/pengajuan-service'
import { normalizeApiError } from '../utils/api-error'
import { requireApiSession } from '../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)
    return listWarrantyPrintQueue()
  } catch (error) {
    normalizeApiError(error)
  }
})
