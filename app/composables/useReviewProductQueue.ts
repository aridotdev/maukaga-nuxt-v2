/**
 * Shared antrean review produk.
 * TTL pendek (10 dtk) karena data ini lebih sering berubah
 * ketika admin approve model.
 */

type ProductOption = {
  produk: string
  count: number
}

type ReviewQueueItem = {
  idPengajuan?: string
  noItem?: number | string
  produk?: string
  model?: string
  nomorSeri?: string
  statusPengajuan?: string
  bagianCabang?: string
}

type ReviewQueueGroup = {
  model: string
  produk?: string
  count: number
  items?: ReviewQueueItem[]
  produkOptions?: ProductOption[]
}

type ReviewQueueResponse = {
  rows?: ReviewQueueGroup[]
}

const REVIEW_QUEUE_TTL = 10_000

export function useReviewProductQueue() {
  const query = useAppSheetQuery<ReviewQueueResponse>(
    'getProductReviewQueue',
    {},
    { ttl: REVIEW_QUEUE_TTL }
  )

  const rows = computed<ReviewQueueGroup[]>(() => query.data.value?.rows ?? [])

  return {
    rows,
    isLoading: query.isLoading,
    isRefreshing: query.isRefreshing,
    error: query.error,
    refresh: query.refresh,
    ensureLoaded: query.ensureLoaded,
    invalidate: query.invalidate
  }
}
