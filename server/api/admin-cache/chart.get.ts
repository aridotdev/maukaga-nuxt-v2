export default defineEventHandler(async (event) => {
  const session = await requireAdminCacheSession(event)
  const query = getQuery(event)

  await ensureAdminCacheWarm(session.token)

  return {
    ...(await getChartFromCache({
      startDate: String(query.startDate || ''),
      endDate: String(query.endDate || ''),
      groupBy: String(query.groupBy || 'day')
    })),
    sync: await getAdminCacheStatus()
  }
})
