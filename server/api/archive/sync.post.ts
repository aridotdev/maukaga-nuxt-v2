import { runArchiveSyncForAdmin } from '../../services/archive-service'

export default defineEventHandler(async (event) => {
  const rawBody = await readBody(event)
  return await runArchiveSyncForAdmin(event, rawBody)
})
