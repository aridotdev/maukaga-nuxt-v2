import { readArchiveDashboardForAdmin } from '../../../services/archive-service'

export default defineEventHandler(async (event) => {
  return await readArchiveDashboardForAdmin(event)
})
