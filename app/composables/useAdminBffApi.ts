type AdminBffQueryKey = string

type AdminBffEntry<T> = {
  data: T | null
  error: string | null
  fetchedAt: number
  inflight: Promise<T | null> | null
}

const DEFAULT_ADMIN_BFF_TTL = 30_000
const EMPTY_ADMIN_BFF_PARAMS: Record<string, unknown> = {}

function stableAdminBffStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableAdminBffStringify).join(',') + ']'

  const record = value as Record<string, unknown>
  return '{' + Object.keys(record)
    .sort()
    .map(key => JSON.stringify(key) + ':' + stableAdminBffStringify(record[key]))
    .join(',') + '}'
}

function buildAdminBffKey(path: string, params: Record<string, unknown>) {
  return path + '::' + stableAdminBffStringify(params)
}

function resolveAdminBffParams(value: MaybeRefOrGetter<Record<string, unknown> | undefined>) {
  return toValue(value) || EMPTY_ADMIN_BFF_PARAMS
}

function getAdminBffEntry<T>(
  store: Ref<Record<AdminBffQueryKey, AdminBffEntry<unknown>>>,
  key: string
) {
  if (!store.value[key]) {
    store.value[key] = {
      data: null,
      error: null,
      fetchedAt: 0,
      inflight: null
    }
  }

  return store.value[key] as AdminBffEntry<T>
}

export function useAdminBffApi() {
  const { getSession } = useCurrentSession()

  async function getAuthHeaders() {
    const session = await getSession()
    if (!session) throw new Error('Tidak ada session aktif.')

    return {
      Authorization: `Bearer ${session.access_token}`
    }
  }

  async function callAdminBff<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST'
      query?: Record<string, unknown>
      body?: Record<string, unknown>
    } = {}
  ) {
    const headers = await getAuthHeaders()

    const response = await $fetch(path, {
      method: options.method || 'GET',
      headers,
      query: options.query,
      body: options.body
    })

    return response as T
  }

  return {
    callAdminBff
  }
}

export function useAdminBffQuery<T = unknown>(
  pathRef: MaybeRefOrGetter<string>,
  paramsRef: MaybeRefOrGetter<Record<string, unknown> | undefined> = EMPTY_ADMIN_BFF_PARAMS,
  options: { ttl?: number } = {}
) {
  const { callAdminBff } = useAdminBffApi()
  const ttl = options.ttl ?? DEFAULT_ADMIN_BFF_TTL
  const store = useState<Record<AdminBffQueryKey, AdminBffEntry<unknown>>>('admin-bff-query-store', () => ({}))
  const path = computed(() => toValue(pathRef))
  const params = computed(() => resolveAdminBffParams(paramsRef))
  const key = computed(() => buildAdminBffKey(path.value, params.value))
  const entry = computed(() => getAdminBffEntry<T>(store, key.value))

  const data = computed(() => entry.value.data)
  const error = computed(() => entry.value.error)
  const isLoading = computed(() => entry.value.inflight !== null && entry.value.data === null)
  const isRefreshing = computed(() => entry.value.inflight !== null && entry.value.data !== null)

  function isFresh(targetEntry = entry.value) {
    return targetEntry.fetchedAt > 0 && Date.now() - targetEntry.fetchedAt < ttl
  }

  async function fetchOnce(force = false) {
    const requestPath = path.value
    const requestParams = params.value
    const requestKey = buildAdminBffKey(requestPath, requestParams)
    const targetEntry = getAdminBffEntry<T>(store, requestKey)

    if (!requestPath) {
      targetEntry.error = 'Path admin BFF tidak valid.'
      targetEntry.fetchedAt = Date.now()
      return null
    }

    if (!force && isFresh(targetEntry) && targetEntry.data !== null) return targetEntry.data
    if (targetEntry.inflight) return targetEntry.inflight

    const promise = callAdminBff<T>(requestPath, { query: requestParams })
      .then((result) => {
        targetEntry.data = result
        targetEntry.error = null
        return result
      })
      .catch((err: unknown) => {
        targetEntry.error = err instanceof Error ? err.message : String(err)
        return null
      })
      .finally(() => {
        targetEntry.inflight = null
        targetEntry.fetchedAt = Date.now()
      })

    targetEntry.inflight = promise
    return promise
  }

  async function refresh() {
    await fetchOnce(true)
  }

  function ensureLoaded() {
    if (entry.value.inflight) return
    if (isFresh() && entry.value.data !== null) return
    void fetchOnce(false)
  }

  function invalidate() {
    entry.value.fetchedAt = 0
  }

  function mutate(updater: (current: T | null) => T | null) {
    entry.value.data = updater(entry.value.data)
  }

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh,
    ensureLoaded,
    invalidate,
    mutate
  }
}

export function useArchiveSync() {
  const { callAdminBff } = useAdminBffApi()

  async function triggerSync(body: Record<string, unknown> = {}) {
    return await callAdminBff('/api/archive/sync', {
      method: 'POST',
      body
    })
  }

  async function syncDetail(idPengajuan: string) {
    return await triggerSync({ mode: 'detail', idPengajuan })
  }

  return {
    triggerSync,
    syncDetail
  }
}

export function useArchiveSyncStatus() {
  const { callAdminBff } = useAdminBffApi()
  const status = useState<{
    status: string
    inProgress: boolean
    lastStartedAt: string
    lastSuccessAt: string
    lastErrorAt: string
    lastErrorMessage: string
    lastRowCount: number
    totalRows: number
  } | null>('archive-sync-status', () => null)
  const isLoading = ref(false)
  const error = ref('')

  async function refreshStatus() {
    isLoading.value = true
    error.value = ''

    try {
      status.value = await callAdminBff<typeof status.value>('/api/archive/sync-status')
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      isLoading.value = false
    }
  }

  async function syncNow() {
    isLoading.value = true
    error.value = ''

    try {
      status.value = await callAdminBff<typeof status.value>('/api/archive/sync', {
        method: 'POST',
        body: { mode: 'full' }
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      isLoading.value = false
    }
  }

  return {
    status,
    isLoading,
    error,
    refreshStatus,
    syncNow
  }
}
