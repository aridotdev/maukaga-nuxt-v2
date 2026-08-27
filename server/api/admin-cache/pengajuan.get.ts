export default defineEventHandler(async (event) => {
  const session = await requireAdminCacheSession(event)
  const query = getQuery(event)

  await ensureAdminCacheWarm(session.token)

  return {
    ...(await getPengajuanListFromCache({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 15),
      search: String(query.search || ''),
      itemDecision: String(query.itemDecision || 'all'),
      status: String(query.status || ''),
      sortBy: String(query.sortBy || 'timestampSubmit'),
      sortDirection: String(query.sortDirection || 'desc')
    })),
    sync: await getAdminCacheStatus()
  }
})
