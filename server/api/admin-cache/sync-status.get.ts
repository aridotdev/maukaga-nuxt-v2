export default defineEventHandler(async (event) => {
  await requireAdminCacheSession(event)
  return getAdminCacheStatus()
})
