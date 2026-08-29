import type { DashboardDataSource } from '~/composables/useDashboardData'

const DASHBOARD_DATA_SOURCE_QUERY_KEY = 'source'
type DashboardDataSourceQueryValue = string | string[] | null | undefined

function normalizeDashboardDataSource(value: unknown): DashboardDataSource {
  return String(value || '').trim() === 'archive' ? 'archive' : 'active'
}

function buildDashboardDataSourceQuery(source: DashboardDataSource, currentQuery: Record<string, DashboardDataSourceQueryValue>) {
  const nextQuery = { ...currentQuery }

  if (source === 'archive') {
    nextQuery[DASHBOARD_DATA_SOURCE_QUERY_KEY] = 'archive'
    return nextQuery
  }

  return Object.fromEntries(
    Object.entries(nextQuery).filter(([key]) => key !== DASHBOARD_DATA_SOURCE_QUERY_KEY),
  ) as Record<string, DashboardDataSourceQueryValue>
}

export function useDashboardDataSource() {
  const route = useRoute()
  const router = useRouter()

  const source = computed<DashboardDataSource>(() => normalizeDashboardDataSource(route.query[DASHBOARD_DATA_SOURCE_QUERY_KEY]))
  const isActive = computed(() => source.value === 'active')
  const isArchive = computed(() => source.value === 'archive')

  async function setSource(nextSource: DashboardDataSource) {
    if (nextSource === source.value) return

    await router.replace({
      query: buildDashboardDataSourceQuery(nextSource, route.query as Record<string, DashboardDataSourceQueryValue>),
    })
  }

  async function toggleSource() {
    await setSource(source.value === 'archive' ? 'active' : 'archive')
  }

  function resolveSourceQuery(query: Record<string, DashboardDataSourceQueryValue> = {}) {
    return buildDashboardDataSourceQuery(source.value, query)
  }

  return {
    source,
    isActive,
    isArchive,
    setSource,
    toggleSource,
    resolveSourceQuery,
  }
}
