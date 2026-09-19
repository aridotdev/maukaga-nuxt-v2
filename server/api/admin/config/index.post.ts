import { readBody } from 'h3'
import { saveAdminConfig } from '../../../services/admin-config-service'
import { normalizeApiError } from '../../../utils/api-error'
import { requireApiSession } from '../../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireApiSession(event, ['admin'])
    return await saveAdminConfig(await readBody(event), {
      actorId: user.id,
    })
  } catch (error) {
    normalizeApiError(error)
  }
})
