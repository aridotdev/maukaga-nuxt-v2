import { createError } from 'h3'
import { deletePemohon } from '../../services/pemohon-service'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireApiSession(event, ['admin', 'qrcc'])
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID Pemohon wajib diisi',
      })
    }

    await deletePemohon(id, {
      actorId: user.id,
    })

    return { success: true }
  } catch (error) {
    normalizeApiError(error)
  }
})
