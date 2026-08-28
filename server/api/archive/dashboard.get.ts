import { readArchiveDashboard } from '../../utils/archive-dashboard'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  return await readArchiveDashboard(query)
})
