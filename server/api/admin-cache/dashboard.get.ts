export default defineEventHandler(async (event) => {
  const session = await requireAdminCacheSession(event)
  const query = getQuery(event)

  await ensureAdminCacheWarm(session.token)

  const limit = Number(query.limit || 0)
  const response = limit > 0
    ? await getLatestPengajuanFromCache(limit)
    : await getDashboardFromCache({
        page: Number(query.page || 1),
        pageSize: Number(query.pageSize || 20),
        sortBy: String(query.sortBy || 'timestampSubmit'),
        sortDirection: String(query.sortDirection || 'desc')
      })

  return {
    ...response,
    sync: await getAdminCacheStatus()
  }
})
