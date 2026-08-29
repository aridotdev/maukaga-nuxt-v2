import type { ApiResult } from '~/types/print'

/**
 * Cache + dedupe wrapper untuk active admin API.
 *
 * - Key: `${action}::${stableStringify(params)}`
 * - TTL: configurable per-call (default 30 detik)
 * - Dedupe: request in-flight dengan key sama di-share
 * - `refresh()`: paksa fetch ulang
 * - `invalidate()`: bersihkan cache entry
 * - `mutate()`: patch data lokal (untuk optimistic update)
 *
 * State disimpan di `useState` global (shared across components).
 */
type QueryKey = string

type Entry<T> = {
  data: T | null
  error: string | null
  fetchedAt: number
  inflight: Promise<ApiResult<T>> | null
}

const DEFAULT_TTL = 30_000
const INVALIDATION_STATE_KEY = 'active-action-invalidations'
const INVALIDATION_ALIASES: Record<string, string[]> = {
  getDashboard: ['getDashboardSummary', 'getDashboardLatest', 'getPengajuanList']
}

export function useActiveInvalidationState() {
  return useState<Record<string, number>>(INVALIDATION_STATE_KEY, () => ({}))
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']'
  }
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}'
}

function buildKey(action: string, params: Record<string, unknown>): QueryKey {
  return action + '::' + stableStringify(params)
}

export function useActiveQuery<T = unknown>(
  action: string,
  params: Record<string, unknown> = {},
  options: { ttl?: number } = {}
) {
  const { callApi } = useActiveApi()
  const ttl = options.ttl ?? DEFAULT_TTL
  const key = buildKey(action, params)

  // Satu useState bersama untuk semua query (sehingga bisa di-iterate saat invalidate).
  const store = useState<Record<string, Entry<unknown>>>('active-query-store', () => ({}))

  if (!store.value[key]) {
    store.value[key] = { data: null, error: null, fetchedAt: 0, inflight: null }
  }

  const entry = store.value[key] as Entry<T>

  const data = computed(() => entry.data)
  const error = computed(() => entry.error)
  const isLoading = computed(() => entry.inflight !== null && entry.data === null)
  const isRefreshing = computed(() => entry.inflight !== null && entry.data !== null)

  function isFresh(): boolean {
    return entry.fetchedAt > 0 && Date.now() - entry.fetchedAt < ttl
  }

  async function fetchOnce(force = false): Promise<ApiResult<T>> {
    if (!force && isFresh() && entry.data !== null) {
      return { success: true, data: entry.data }
    }
    if (entry.inflight) return entry.inflight

    const promise = callApi<T>(action, params)
      .then((result) => {
        if (result.success && result.data !== undefined) {
          entry.data = result.data
        }
        entry.error = result.success ? null : (result.error || 'Request gagal.')
        return result
      })
      .catch((err: unknown) => {
        entry.error = err instanceof Error ? err.message : String(err)
        return { success: false, error: entry.error } as ApiResult<T>
      })
      .finally(() => {
        entry.inflight = null
        entry.fetchedAt = Date.now()
      })

    entry.inflight = promise
    return promise
  }

  async function refresh(): Promise<void> {
    await fetchOnce(true)
  }

  function ensureLoaded(): void {
    if (entry.inflight) return
    if (isFresh() && entry.data !== null) return
    // Fire-and-forget; loading state otomatis ter-update via computed.
    void fetchOnce(false)
  }

  function invalidate(): void {
    entry.fetchedAt = 0
  }

  function mutate(updater: (current: T | null) => T | null): void {
    entry.data = updater(entry.data)
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

/**
 * Helper untuk invalidate semua query dengan action tertentu.
 * Dipakai setelah mutasi agar list/stats auto-refresh.
 */
export function useActiveInvalidate() {
  const store = useState<Record<string, unknown>>('active-query-store', () => ({}))
  const invalidations = useActiveInvalidationState()

  function markInvalidated(action: string) {
    invalidations.value[action] = Date.now()
  }

  return {
    invalidate(action: string) {
      const actions = [action, ...(INVALIDATION_ALIASES[action] || [])]

      for (const targetAction of actions) {
        for (const [key, raw] of Object.entries(store.value)) {
          if (!key.startsWith(targetAction + '::')) continue
          const entry = raw as Entry<unknown>
          entry.fetchedAt = 0
        }
        markInvalidated(targetAction)
      }
    },
    invalidateAll() {
      for (const raw of Object.values(store.value)) {
        (raw as Entry<unknown>).fetchedAt = 0
      }
      markInvalidated('*')
    }
  }
}
