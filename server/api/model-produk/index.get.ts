import { getQuery } from 'h3'
import * as z from 'zod'
import { MODEL_REVIEW_STATUSES } from '../../database/schema'
import { listModelProduk } from '../../services/model-produk-service'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'

const querySchema = z.object({
  status: z.enum(MODEL_REVIEW_STATUSES).optional(),
})

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)
    return listModelProduk(querySchema.parse(getQuery(event)))
  } catch (error) {
    normalizeApiError(error)
  }
})
