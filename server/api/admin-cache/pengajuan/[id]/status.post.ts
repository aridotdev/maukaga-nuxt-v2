export default defineEventHandler(async (event) => {
  const session = await requireAdminCacheSession(event)
  const idPengajuan = getRequiredPengajuanId(event)
  const body = await readBody<Record<string, unknown>>(event)

  return updatePengajuanStatus(session, idPengajuan, body)
})
