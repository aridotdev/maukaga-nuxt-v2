import { listMembers } from '../../../services/member-service'
import { normalizeApiError } from '../../../utils/api-error'
import { requireApiSession } from '../../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event, ['admin'])
    return await listMembers()
  } catch (error) {
    normalizeApiError(error)
  }
})
