export default defineEventHandler(async (event) => {
  const session = await requireAdminCacheSession(event)
  const idPengajuan = getRequiredPengajuanId(event)

  return deletePengajuanAdmin(session, idPengajuan)
})
