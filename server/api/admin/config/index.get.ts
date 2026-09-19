import { listAdminConfig } from '../../../services/admin-config-service'
import { normalizeApiError } from '../../../utils/api-error'
import { requireApiSession } from '../../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event, ['admin'])
    return await listAdminConfig()
  } catch (error) {
    normalizeApiError(error)
  }
})
