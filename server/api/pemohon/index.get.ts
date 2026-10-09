import { listPemohon } from '../../services/pemohon-service'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)
    return listPemohon()
  } catch (error) {
    normalizeApiError(error)
  }
})
