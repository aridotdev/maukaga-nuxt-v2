import { defineEventHandler, setHeader } from 'h3'
import { useDb } from '../../database'
import { readDashboardLatestSubmissions } from '../../repositories/dashboard-repository'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)
    setHeader(event, 'Cache-Control', 'private, no-store')
    return await readDashboardLatestSubmissions(useDb())
  } catch (error) {
    normalizeApiError(error)
  }
})
