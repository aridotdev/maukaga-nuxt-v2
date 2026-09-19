import { readBody } from 'h3'
import { setAdminPassword } from '../../services/admin-password-service'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)
    return await setAdminPassword(event, await readBody(event))
  } catch (error) {
    normalizeApiError(error)
  }
})
