import { listPrintLayouts } from '../../../services/print-layout-service'
import { normalizeApiError } from '../../../utils/api-error'
import { requireApiSession } from '../../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)
    return listPrintLayouts()
  } catch (error) {
    normalizeApiError(error)
  }
})
