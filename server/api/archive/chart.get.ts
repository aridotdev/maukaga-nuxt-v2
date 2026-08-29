import { readArchiveChartForAdmin } from '../../services/archive-service'

export default defineEventHandler(async (event) => {
  return await readArchiveChartForAdmin(event)
})
