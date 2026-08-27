export default defineEventHandler(async (event) => {
  const session = await requireAdminCacheSession(event)
  const body = await readBody<Record<string, unknown>>(event)

  return bulkUpdatePengajuanStatus(session, body)
})
