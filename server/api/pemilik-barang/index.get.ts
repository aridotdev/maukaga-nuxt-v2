import { listPemilikBarang } from '../../services/pemilik-barang-service'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)
    return listPemilikBarang()
  } catch (error) {
    normalizeApiError(error)
  }
})
