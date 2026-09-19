import { readBody } from 'h3'
import { bootstrapAdmin } from '../../services/admin-bootstrap-service'
import { normalizeApiError } from '../../utils/api-error'

export default defineEventHandler(async (event) => {
  try {
    return await bootstrapAdmin(await readBody(event))
  } catch (error) {
    normalizeApiError(error)
  }
})
