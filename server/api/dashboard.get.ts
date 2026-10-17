import { defineEventHandler, getQuery, setHeader } from 'h3'
import { getDashboardSummary } from '../services/dashboard-service'
import { normalizeApiError } from '../utils/api-error'
import { requireApiSession } from '../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)
    setHeader(event, 'Cache-Control', 'private, no-store')
    return await getDashboardSummary(getQuery(event))
  } catch (error) {
    normalizeApiError(error)
  }
})
