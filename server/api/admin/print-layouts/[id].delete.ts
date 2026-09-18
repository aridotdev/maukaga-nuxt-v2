import { createError } from 'h3'
import { deletePrintLayout } from '../../../services/print-layout-service'
import { normalizeApiError } from '../../../utils/api-error'
import { requireApiSession } from '../../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireApiSession(event, ['admin', 'qrcc'])
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID layout wajib diisi',
      })
    }

    return deletePrintLayout(id, {
      actorId: user.id,
    })
  } catch (error) {
    normalizeApiError(error)
  }
})
