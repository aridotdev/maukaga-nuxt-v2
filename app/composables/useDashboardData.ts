import type { Period, Range } from '~/types'

type DashboardStatus = 'Baru' | 'Disetujui' | 'Ditolak' | 'Diprint' | 'Dikirim' | 'Selesai'
type DashboardItemDecision = 'Disetujui' | 'Ditolak' | ''
type DashboardItemDecisionFilter = 'all' | 'pending' | Exclude<DashboardItemDecision, ''>
type PengajuanListSortDirection = 'asc' | 'desc'
type DashboardChartGroupBy = 'day' | 'week' | 'month' | 'year'

export type DashboardSummary = {
  total?: number
  totalItems?: number
  baru?: number
  disetujui?: number
  ditolak?: number
  diprint?: number
  dikirim?: number
  selesai?: number
  itemDisetujui?: number
  itemDitolak?: number
}

export type DashboardItem = {
  noItem: number | string
  model?: string
  nomorSeri?: string
  keputusanItem?: DashboardItemDecision | string
}

export type DashboardRow = {
  idPengajuan: string
  timestampSubmit: string
  nama: string
  bagianCabang: string
  pemilik?: string
  alasanPengajuan?: string
  tanggalForm?: string
  catatanTambahan?: string
  jumlahItem: number | string
  status: DashboardStatus | string
  items?: DashboardItem[]
}

export type DashboardResponse = {
  summary?: DashboardSummary
  rows?: DashboardRow[]
  totalRows?: number
  page?: number
  pageSize?: number
  admin?: string
}

export type DashboardChartPoint = {
  period: string
  totalItems: number
  approvedItems: number
  rejectedItems: number
}

export type DashboardChartSummary = {
  totalItems: number
  approvedItems: number
  rejectedItems: number
}

export type DashboardChartResponse = {
  points?: DashboardChartPoint[]
  summary?: DashboardChartSummary
  groupBy?: DashboardChartGroupBy
  startDate?: string
  endDate?: string
  admin?: string
}

export type DashboardChartParams = {
  range: Range
  period: Period
}

export type PengajuanListParams = {
  page?: number
  pageSize?: number
  search?: string
  itemDecision?: DashboardItemDecisionFilter
  status?: DashboardStatus | 'all' | ''
  sortBy?: string
  sortDirection?: PengajuanListSortDirection
}

type DashboardStore = {
  data: DashboardResponse | null
  error: string | null
  fetchedAt: number
  inflight: Promise<void> | null
  loadedRows: number
  totalRows: number
  loadedPages: number
  totalPages: number
}

type PengajuanListEntry = {
  data: DashboardResponse | null
  error: string | null
  fetchedAt: number
  inflight: Promise<void> | null
}

type DashboardChartEntry = {
  data: DashboardChartResponse | null
  error: string | null
  fetchedAt: number
  inflight: Promise<void> | null
}

type AppSheetQueryEntry = {
  data: unknown | null
}

type UseDashboardDataOptions = {
  loadAll?: boolean
}

const DASHBOARD_TTL = 30_000
const DASHBOARD_ALL_TTL = 120_000
const PENGAJUAN_LIST_TTL = 15_000
const DASHBOARD_CHART_TTL = 30_000
const DASHBOARD_PAGE_SIZE = 100
const VALID_STATUSES: ReadonlySet<DashboardStatus> = new Set(['Baru', 'Disetujui', 'Ditolak', 'Diprint', 'Dikirim', 'Selesai'])

function getTime(value: string): number {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function toStatus(value: string | DashboardStatus): DashboardStatus {
  return VALID_STATUSES.has(value as DashboardStatus) ? (value as DashboardStatus) : 'Baru'
}

function normalizeRows(rows: DashboardRow[] = []) {
  return rows.map((row) => ({
    ...row,
    status: toStatus(row.status)
  }))
}

function mergeDashboardRows(rows: DashboardRow[]) {
  const seen = new Set<string>()
  const merged: DashboardRow[] = []

  for (const row of rows) {
    const key = row.idPengajuan
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(row)
  }

  return merged
}

function createEmptyDashboardStore(): DashboardStore {
  return {
    data: null,
    error: null,
    fetchedAt: 0,
    inflight: null,
    loadedRows: 0,
    totalRows: 0,
    loadedPages: 0,
    totalPages: 0
  }
}

function createEmptyPengajuanListEntry(): PengajuanListEntry {
  return {
    data: null,
    error: null,
    fetchedAt: 0,
    inflight: null
  }
}

function createEmptyDashboardChartEntry(): DashboardChartEntry {
  return {
    data: null,
    error: null,
    fetchedAt: 0,
    inflight: null
  }
}

function usePengajuanListStore() {
  return useState<Record<string, PengajuanListEntry>>('pengajuan-list-data-store', () => ({}))
}

function useDashboardChartStore() {
  return useState<Record<string, DashboardChartEntry>>('dashboard-chart-data-store', () => ({}))
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function toDashboardChartGroupBy(period: Period): DashboardChartGroupBy {
  if (period === 'weekly') return 'week'
  if (period === 'monthly') return 'month'
  return 'day'
}

function normalizeDashboardChartParams(params: DashboardChartParams) {
  return {
    startDate: toDateInputValue(params.range.start),
    endDate: toDateInputValue(params.range.end),
    groupBy: toDashboardChartGroupBy(params.period)
  }
}

function buildDashboardChartKey(params: ReturnType<typeof normalizeDashboardChartParams>) {
  return JSON.stringify(params)
}

function getDashboardChartEntry(store: Ref<Record<string, DashboardChartEntry>>, key: string) {
  if (!store.value[key]) {
    store.value[key] = createEmptyDashboardChartEntry()
  }

  return store.value[key] as DashboardChartEntry
}

function normalizePengajuanListParams(params: PengajuanListParams = {}) {
  return {
    page: Math.max(Number(params.page || 1), 1),
    pageSize: Math.min(Math.max(Number(params.pageSize || 15), 1), 100),
    search: String(params.search || '').trim(),
    itemDecision: params.itemDecision || 'all',
    status: params.status && params.status !== 'all' ? params.status : '',
    sortBy: params.sortBy || 'timestampSubmit',
    sortDirection: params.sortDirection || 'desc'
  }
}

function buildPengajuanListKey(params: ReturnType<typeof normalizePengajuanListParams>) {
  return JSON.stringify(params)
}

function getPengajuanListEntry(store: Ref<Record<string, PengajuanListEntry>>, key: string) {
  if (!store.value[key]) {
    store.value[key] = createEmptyPengajuanListEntry()
  }

  return store.value[key] as PengajuanListEntry
}

function patchDashboardRows(response: DashboardResponse | null, idPengajuan: string, updater: (row: DashboardRow) => DashboardRow) {
  if (!response?.rows?.length) return response

  let changed = false
  const rows = response.rows.map((row) => {
    if (String(row.idPengajuan) !== String(idPengajuan)) return row

    changed = true
    return updater(row)
  })

  return changed ? { ...response, rows } : response
}

function removeDashboardRows(response: DashboardResponse | null, idPengajuan: string) {
  if (!response?.rows?.length) return response

  const rows = response.rows.filter((row) => String(row.idPengajuan) !== String(idPengajuan))
  if (rows.length === response.rows.length) return response

  const totalRows = Number(response.totalRows ?? response.rows.length)

  return {
    ...response,
    rows,
    totalRows: Math.max(totalRows - 1, rows.length)
  }
}

function patchDashboardQueryRows(action: string, idPengajuan: string, updater: (row: DashboardRow) => DashboardRow) {
  const store = useState<Record<string, AppSheetQueryEntry>>('appsheet-query-store', () => ({}))

  for (const [key, entry] of Object.entries(store.value)) {
    if (!key.startsWith(action + '::')) continue

    const data = entry.data as DashboardResponse | null
    entry.data = patchDashboardRows(data, idPengajuan, updater)
  }
}

function removeDashboardQueryRows(action: string, idPengajuan: string) {
  const store = useState<Record<string, AppSheetQueryEntry>>('appsheet-query-store', () => ({}))

  for (const [key, entry] of Object.entries(store.value)) {
    if (!key.startsWith(action + '::')) continue

    const data = entry.data as DashboardResponse | null
    entry.data = removeDashboardRows(data, idPengajuan)
  }
}

function patchDashboardStoreRows(idPengajuan: string, updater: (row: DashboardRow) => DashboardRow) {
  const store = useState<DashboardStore>('dashboard-all-data-store', createEmptyDashboardStore)
  store.value.data = patchDashboardRows(store.value.data, idPengajuan, updater)
}

function removeDashboardStoreRows(idPengajuan: string) {
  const store = useState<DashboardStore>('dashboard-all-data-store', createEmptyDashboardStore)
  store.value.data = removeDashboardRows(store.value.data, idPengajuan)
  const rowsLength = store.value.data?.rows?.length ?? 0
  store.value.loadedRows = rowsLength
  store.value.totalRows = Math.max(store.value.totalRows - 1, rowsLength)
}

export function useDashboardPengajuanCache() {
  const listStore = usePengajuanListStore()

  function patchPengajuanRows(idPengajuan: string, updater: (row: DashboardRow) => DashboardRow) {
    for (const entry of Object.values(listStore.value)) {
      entry.data = patchDashboardRows(entry.data, idPengajuan, updater)
    }

    patchDashboardStoreRows(idPengajuan, updater)
    patchDashboardQueryRows('getDashboard', idPengajuan, updater)
    patchDashboardQueryRows('getDashboardLatest', idPengajuan, updater)
  }

  function removePengajuanRow(idPengajuan: string) {
    for (const entry of Object.values(listStore.value)) {
      entry.data = removeDashboardRows(entry.data, idPengajuan)
    }

    removeDashboardStoreRows(idPengajuan)
    removeDashboardQueryRows('getDashboard', idPengajuan)
    removeDashboardQueryRows('getDashboardLatest', idPengajuan)
  }

  function patchItemDecision(idPengajuan: string, noItem: number | string, keputusanItem: DashboardItemDecision | string) {
    patchPengajuanRows(idPengajuan, (row) => ({
      ...row,
      items: (row.items || []).map((item) => {
        if (String(item.noItem) !== String(noItem)) return item
        return { ...item, keputusanItem }
      })
    }))
  }

  function patchPengajuanStatus(idPengajuan: string, status: DashboardStatus | string) {
    patchPengajuanRows(idPengajuan, (row) => ({
      ...row,
      status
    }))
  }

  function patchPengajuanRow(row: DashboardRow) {
    if (!row.idPengajuan) return
    patchPengajuanRows(row.idPengajuan, () => row)
  }

  return {
    patchItemDecision,
    patchPengajuanStatus,
    patchPengajuanRow,
    removePengajuanRow
  }
}

export function useDashboardSummaryData() {
  const invalidations = useAppSheetInvalidationState()
  const query = useAdminCacheQuery<{ summary?: DashboardSummary, admin?: string }>(
    '/api/admin-cache/dashboard',
    {},
    { ttl: DASHBOARD_TTL }
  )

  watch(
    () => [invalidations.value.getDashboardSummary, invalidations.value['*']],
    () => {
      query.invalidate()
      if (query.data.value) void query.refresh()
    }
  )

  return {
    summary: computed<DashboardSummary>(() => query.data.value?.summary ?? {}),
    isLoading: query.isLoading,
    isRefreshing: query.isRefreshing,
    error: query.error,
    refresh: query.refresh,
    ensureLoaded: query.ensureLoaded,
    invalidate: query.invalidate
  }
}

export function useDashboardLatestData(limit = 5) {
  const invalidations = useAppSheetInvalidationState()
  const query = useAdminCacheQuery<DashboardResponse>(
    '/api/admin-cache/dashboard',
    { limit },
    { ttl: DASHBOARD_TTL }
  )

  watch(
    () => [invalidations.value.getDashboardLatest, invalidations.value['*']],
    () => {
      query.invalidate()
      if (query.data.value) void query.refresh()
    }
  )

  const latestRows = computed<DashboardRow[]>(() =>
    normalizeRows(query.data.value?.rows ?? [])
      .slice(0, limit)
      .map((row, index) => ({ ...row, nomor: index + 1 }))
  )

  return {
    latestRows,
    rows: latestRows,
    isLoading: query.isLoading,
    isRefreshing: query.isRefreshing,
    error: query.error,
    refresh: query.refresh,
    ensureLoaded: query.ensureLoaded,
    invalidate: query.invalidate
  }
}

export function useDashboardChartData(paramsRef: MaybeRefOrGetter<DashboardChartParams>) {
  const { callAdminCache } = useAdminCacheApi()
  const invalidations = useAppSheetInvalidationState()
  const store = useDashboardChartStore()
  const params = computed(() => normalizeDashboardChartParams(toValue(paramsRef)))
  const key = computed(() => buildDashboardChartKey(params.value))
  const entry = computed(() => getDashboardChartEntry(store, key.value))

  const points = computed<DashboardChartPoint[]>(() => entry.value.data?.points ?? [])
  const summary = computed<DashboardChartSummary>(() => entry.value.data?.summary ?? {
    totalItems: 0,
    approvedItems: 0,
    rejectedItems: 0
  })
  const isLoading = computed(() => entry.value.inflight !== null && entry.value.data === null)
  const isRefreshing = computed(() => entry.value.inflight !== null && entry.value.data !== null)
  const error = computed(() => entry.value.error)

  function isFresh(key: string) {
    const targetEntry = getDashboardChartEntry(store, key)
    return targetEntry.fetchedAt > 0 && Date.now() - targetEntry.fetchedAt < DASHBOARD_CHART_TTL
  }

  async function fetchChart(force = false) {
    const requestParams = params.value
    const requestKey = buildDashboardChartKey(requestParams)
    const targetEntry = getDashboardChartEntry(store, requestKey)

    if (!force && targetEntry.data && isFresh(requestKey)) return
    if (targetEntry.inflight) return targetEntry.inflight

    const promise = callAdminCache<DashboardChartResponse>('/api/admin-cache/chart', { query: requestParams })
      .then((result) => {
        targetEntry.data = result ?? {}
        targetEntry.error = null
      })
      .catch((err) => {
        targetEntry.error = err instanceof Error ? err.message : String(err)
      })
      .finally(() => {
        targetEntry.inflight = null
        targetEntry.fetchedAt = Date.now()
      })

    targetEntry.inflight = promise
    return promise
  }

  function ensureLoaded() {
    void fetchChart(false)
  }

  async function refresh() {
    await fetchChart(true)
  }

  function invalidate() {
    entry.value.fetchedAt = 0
  }

  watch(
    () => [invalidations.value.getDashboardChartAggregate, invalidations.value['*']],
    () => {
      for (const targetEntry of Object.values(store.value)) {
        targetEntry.fetchedAt = 0
      }
      if (entry.value.data) void fetchChart(true)
    }
  )

  return {
    points,
    summary,
    isLoading,
    isRefreshing,
    error,
    refresh,
    ensureLoaded,
    invalidate
  }
}

export function usePengajuanListData(paramsRef: MaybeRefOrGetter<PengajuanListParams>) {
  const { callAdminCache } = useAdminCacheApi()
  const invalidations = useAppSheetInvalidationState()
  const store = usePengajuanListStore()
  const params = computed(() => normalizePengajuanListParams(toValue(paramsRef)))
  const key = computed(() => buildPengajuanListKey(params.value))
  const entry = computed(() => getPengajuanListEntry(store, key.value))

  const rows = computed<DashboardRow[]>(() => normalizeRows(entry.value.data?.rows ?? []))
  const loadedRows = computed(() => rows.value.length)
  const totalRows = computed(() => Number(entry.value.data?.totalRows ?? rows.value.length))
  const page = computed(() => Number(entry.value.data?.page ?? params.value.page))
  const pageSize = computed(() => Number(entry.value.data?.pageSize ?? params.value.pageSize))
  const totalPages = computed(() => {
    if (!totalRows.value) return 0
    return Math.max(Math.ceil(totalRows.value / pageSize.value), 1)
  })
  const isLoading = computed(() => entry.value.inflight !== null && entry.value.data === null)
  const isRefreshing = computed(() => entry.value.inflight !== null && entry.value.data !== null)
  const isFullyLoaded = computed(() => totalPages.value === 0 || page.value >= totalPages.value)
  const error = computed(() => entry.value.error)

  function isFresh(key: string) {
    const targetEntry = getPengajuanListEntry(store, key)
    return targetEntry.fetchedAt > 0 && Date.now() - targetEntry.fetchedAt < PENGAJUAN_LIST_TTL
  }

  async function fetchList(force = false) {
    const requestParams = params.value
    const requestKey = buildPengajuanListKey(requestParams)
    const targetEntry = getPengajuanListEntry(store, requestKey)

    if (!force && targetEntry.data && isFresh(requestKey)) return
    if (targetEntry.inflight) return targetEntry.inflight

    const promise = callAdminCache<DashboardResponse>('/api/admin-cache/pengajuan', { query: requestParams })
      .then((result) => {
        targetEntry.data = result ?? {}
        targetEntry.error = null
      })
      .catch((err) => {
        targetEntry.error = err instanceof Error ? err.message : String(err)
      })
      .finally(() => {
        targetEntry.inflight = null
        targetEntry.fetchedAt = Date.now()
      })

    targetEntry.inflight = promise
    return promise
  }

  function ensureLoaded() {
    void fetchList(false)
  }

  async function refresh() {
    await fetchList(true)
  }

  function invalidate() {
    entry.value.fetchedAt = 0
  }

  watch(
    () => [invalidations.value.getPengajuanList, invalidations.value['*']],
    () => {
      for (const targetEntry of Object.values(store.value)) {
        targetEntry.fetchedAt = 0
      }
      if (entry.value.data) void fetchList(true)
    }
  )

  return {
    rows,
    isLoading,
    isRefreshing,
    loadedRows,
    totalRows,
    page,
    pageSize,
    totalPages,
    isFullyLoaded,
    error,
    refresh,
    ensureLoaded,
    invalidate
  }
}

export function useDashboardData(options: UseDashboardDataOptions = {}) {
  if (options.loadAll) return useDashboardAllData()

  const query = useAdminCacheQuery<DashboardResponse>(
    '/api/admin-cache/dashboard',
    { page: 1, pageSize: 20 },
    { ttl: DASHBOARD_TTL }
  )

  const summary = computed<DashboardSummary>(() => query.data.value?.summary ?? {})
  const rows = computed<DashboardRow[]>(() => normalizeRows(query.data.value?.rows ?? []))
  const loadedRows = computed(() => rows.value.length)
  const totalRows = computed(() => Number(query.data.value?.totalRows ?? rows.value.length))
  const loadedPages = computed(() => Number(query.data.value?.page ?? (rows.value.length ? 1 : 0)))
  const totalPages = computed(() => {
    if (!totalRows.value) return 0
    return Math.max(Math.ceil(totalRows.value / Number(query.data.value?.pageSize || 20)), 1)
  })
  const isFullyLoaded = computed(() => loadedRows.value >= totalRows.value)

  const latestRows = computed<DashboardRow[]>(() => {
    return [...rows.value]
      .sort((a, b) => getTime(b.timestampSubmit) - getTime(a.timestampSubmit))
      .slice(0, 5)
      .map((row, index) => ({ ...row, nomor: index + 1 }))
  })

  return {
    summary,
    rows,
    latestRows,
    isLoading: query.isLoading,
    isRefreshing: query.isRefreshing,
    loadedRows,
    totalRows,
    loadedPages,
    totalPages,
    isFullyLoaded,
    error: query.error,
    refresh: query.refresh,
    ensureLoaded: query.ensureLoaded,
    invalidate: query.invalidate
  }
}

function useDashboardAllData() {
  const { callAdminCache } = useAdminCacheApi()
  const store = useState<DashboardStore>('dashboard-all-data-store', createEmptyDashboardStore)
  const invalidations = useAppSheetInvalidationState()

  watch(
    () => [invalidations.value.getDashboard, invalidations.value['*']],
    () => {
      store.value.fetchedAt = 0
    }
  )

  const summary = computed<DashboardSummary>(() => store.value.data?.summary ?? {})
  const rows = computed<DashboardRow[]>(() => normalizeRows(store.value.data?.rows ?? []))
  const latestRows = computed<DashboardRow[]>(() => {
    return [...rows.value]
      .sort((a, b) => getTime(b.timestampSubmit) - getTime(a.timestampSubmit))
      .slice(0, 5)
      .map((row, index) => ({ ...row, nomor: index + 1 }))
  })

  const isLoading = computed(() => store.value.inflight !== null && store.value.data === null)
  const isRefreshing = computed(() => store.value.inflight !== null && store.value.data !== null)
  const loadedRows = computed(() => store.value.loadedRows)
  const totalRows = computed(() => store.value.totalRows)
  const loadedPages = computed(() => store.value.loadedPages)
  const totalPages = computed(() => store.value.totalPages)
  const isFullyLoaded = computed(() => totalRows.value === 0 || loadedRows.value >= totalRows.value)
  const error = computed(() => store.value.error)

  function isFresh() {
    return store.value.fetchedAt > 0 && Date.now() - store.value.fetchedAt < DASHBOARD_ALL_TTL
  }

  async function fetchAll(force = false) {
    if (!force && isFresh() && store.value.data) return
    if (store.value.inflight) return store.value.inflight

    const promise = fetchDashboardPages()
    store.value.inflight = promise

    try {
      await promise
    } finally {
      store.value.inflight = null
      store.value.fetchedAt = Date.now()
    }
  }

  async function fetchDashboardPages() {
    store.value.error = null

    try {
      const first = await fetchDashboardPage(1)
      const firstRows = first.rows ?? []
      const pageSize = Number(first.pageSize || DASHBOARD_PAGE_SIZE)
      const total = Number(first.totalRows ?? firstRows.length)
      const totalPageCount = Math.max(Math.ceil(total / pageSize), 1)
      const collectedRows = [...firstRows]

      updateStore(first, collectedRows, {
        loadedPages: 1,
        totalPages: totalPageCount,
        totalRows: total
      })

      for (let page = 2; page <= totalPageCount; page += 1) {
        const next = await fetchDashboardPage(page)
        collectedRows.push(...(next.rows ?? []))
        updateStore(first, collectedRows, {
          loadedPages: page,
          totalPages: totalPageCount,
          totalRows: total
        })
      }
    } catch (err) {
      store.value.error = err instanceof Error ? err.message : String(err)
    }
  }

  async function fetchDashboardPage(page: number) {
    const result = await callAdminCache<DashboardResponse>('/api/admin-cache/dashboard', {
      query: {
        page,
        pageSize: DASHBOARD_PAGE_SIZE
      }
    })

    return result ?? {}
  }

  function updateStore(base: DashboardResponse, rows: DashboardRow[], meta: {
    loadedPages: number
    totalPages: number
    totalRows: number
  }) {
    const mergedRows = mergeDashboardRows(rows)

    store.value.data = {
      ...base,
      rows: mergedRows,
      totalRows: meta.totalRows,
      page: meta.loadedPages,
      pageSize: DASHBOARD_PAGE_SIZE
    }
    store.value.loadedRows = mergedRows.length
    store.value.totalRows = meta.totalRows
    store.value.loadedPages = meta.loadedPages
    store.value.totalPages = meta.totalPages
  }

  async function refresh() {
    await fetchAll(true)
  }

  function ensureLoaded() {
    if (store.value.inflight) return
    if (isFresh() && store.value.data) return
    void fetchAll(false)
  }

  function invalidate() {
    store.value.fetchedAt = 0
  }

  return {
    summary,
    rows,
    latestRows,
    isLoading,
    isRefreshing,
    loadedRows,
    totalRows,
    loadedPages,
    totalPages,
    isFullyLoaded,
    error,
    refresh,
    ensureLoaded,
    invalidate
  }
}
