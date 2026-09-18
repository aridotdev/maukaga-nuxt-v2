import { listModelProduk } from '../../services/model-produk-service'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)
    return listModelProduk({ status: 'needs_review' })
  } catch (error) {
    normalizeApiError(error)
  }
})
