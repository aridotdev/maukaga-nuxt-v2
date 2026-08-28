import { readArchiveChart } from '../../utils/archive-dashboard'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  return await readArchiveChart(query)
})
