import { readArchiveSyncStatus } from '../../utils/archive-sync'

export default defineEventHandler(async () => {
  const status = await readArchiveSyncStatus()

  return {
    success: true,
    data: status,
  }
})
