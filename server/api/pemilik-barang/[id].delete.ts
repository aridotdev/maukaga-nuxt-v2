import { createError } from 'h3'
import { deletePemilikBarang } from '../../services/pemilik-barang-service'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireApiSession(event, ['admin', 'qrcc'])
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID Dealer/Toko wajib diisi',
      })
    }

    await deletePemilikBarang(id, {
      actorId: user.id,
    })

    return { success: true }
  } catch (error) {
    normalizeApiError(error)
  }
})
