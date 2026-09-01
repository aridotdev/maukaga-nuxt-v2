import { readArchiveSyncStatusForAdmin } from '../../services/archive-service'

export default defineEventHandler(async (event) => {
  return await readArchiveSyncStatusForAdmin(event)
})
