/**
 * Detail pengajuan dengan cache.
 * Bisa dipanggil berkali-kali (mis. navigasi bolak-balik list → detail) tanpa
 * request berulang ke Apps Script dalam window TTL.
 *
 * - `getDetail(id)`: load detail
 * - `setItemDecision(noItem, keputusan, catatan)`: update keputusan item + patch cache list
 */

import type { DashboardRow } from '~/composables/useDashboardData'

const DETAIL_TTL = 60_000

export type PengajuanStatus = 'Baru' | 'Disetujui' | 'Ditolak' | 'Diprint' | 'Dikirim' | 'Selesai'
export type ItemDecisionStatus = 'Disetujui' | 'Ditolak' | ''

type RiwayatStatus = {
  timestamp?: string
  noItem?: number | string
  statusLama?: string
  statusBaru?: string
  catatanAdmin?: string
  user?: string
}

export type DetailItem = {
  noItem?: number | string
  produk?: string
  model?: string
  nomorSeri?: string
  modelNormalized?: string
  produkStatus?: string
  produkSumber?: string
  keputusanItem?: ItemDecisionStatus | string
  catatanAdminItem?: string
  tanggalUpdateKeputusanItem?: string
  userUpdateKeputusanItem?: string
}

export type DetailPengajuan = {
  idPengajuan: string
  timestampSubmit?: string
  nama?: string
  bagianCabang?: string
  pemilik?: string
  alasanPengajuan?: string
  tanggalForm?: string
  fileHardCopyUrl?: string
  fileHardCopyId?: string
  evidenceAttachmentUrls?: string[]
  evidenceAttachmentIds?: string[]
  catatanTambahan?: string
  jumlahItem?: number | string
  status: PengajuanStatus
  catatanAdmin?: string
  tanggalUpdateStatusTerakhir?: string
  userUpdateStatus?: string
  riwayatSingkat?: string
  items?: DetailItem[]
  riwayat?: RiwayatStatus[]
}

type DetailMutationResponse = {
  detail?: DetailPengajuan
  row?: DashboardRow
  status?: PengajuanStatus | string
  keputusanItem?: ItemDecisionStatus | string
}

type BulkPengajuanStatusResult = {
  idPengajuan: string
  success: boolean
  data?: DetailMutationResponse
  error?: string
}

type BulkPengajuanStatusResponse = {
  statusBaru: PengajuanStatus | string
  catatanAdmin: string
  total: number
  updated: number
  failed: number
  results: BulkPengajuanStatusResult[]
}

type DetailCacheEntry = {
  data?: DetailPengajuan | null
  error?: string | null
  fetchedAt?: number
}

export type AdminPengajuanPatch = {
  nama: string
  bagianCabang: string
  pemilik: string
  alasanPengajuan: string
  tanggalForm: string
  catatanTambahan?: string
}

export function usePengajuanDetail(idRef: MaybeRefOrGetter<string>) {
  const id = computed(() => toValue(idRef))
  const { callAdminCache } = useAdminCacheApi()
  const { invalidate } = useAppSheetInvalidate()
  const {
    patchItemDecision: patchCachedItemDecision,
    patchPengajuanStatus: patchCachedPengajuanStatus,
    patchPengajuanRow: patchCachedPengajuanRow
  } = useDashboardPengajuanCache()
  const toast = useToast()

  const detailPath = computed(() => id.value
    ? `/api/admin-cache/pengajuan/${encodeURIComponent(id.value)}`
    : '')
  const query = useAdminCacheQuery<DetailPengajuan>(
    detailPath,
    {},
    { ttl: DETAIL_TTL }
  )

  function getParams() {
    return { idPengajuan: id.value }
  }

  function getDetailMutationPath(action: 'item-decision' | 'status') {
    if (!detailPath.value) throw new Error('ID Pengajuan tidak valid.')
    return `${detailPath.value}/${action}`
  }

  async function postDetailMutation(
    action: 'item-decision' | 'status',
    body: Record<string, unknown>
  ) {
    return await callAdminCache<DetailMutationResponse>(getDetailMutationPath(action), {
      method: 'POST',
      body
    })
  }

  async function load(force = false) {
    if (!id.value) return null
    if (force) return query.refresh()
    return query.ensureLoaded()
  }

  watch(id, (next, previous) => {
    if (!next || next === previous) return
    query.ensureLoaded()
  })

  // Patch lokal untuk optimistic update detail dan cache list yang sudah termuat.
  function patchItem(
    noItem: number | string,
    patch: Pick<DetailItem, 'keputusanItem' | 'catatanAdminItem' | 'tanggalUpdateKeputusanItem'>
  ) {
    query.mutate((current) => {
      if (!current || !Array.isArray(current.items)) return current
      const items = current.items.map((it) => {
        if (String(it.noItem) !== String(noItem)) return it
        return { ...it, ...patch }
      })
      return { ...current, items }
    })
    patchCachedItemDecision(id.value, noItem, patch.keputusanItem || '')
  }

  function normalizeItemDecision(decision: string): ItemDecisionStatus {
    if (decision === 'Disetujui' || decision === 'Ditolak') return decision
    return ''
  }

  function applyMutationResponse(data: DetailMutationResponse | undefined) {
    if (!data) return false

    const row = data.row
    if (row?.idPengajuan) {
      patchCachedPengajuanRow(row)
    }

    const detail = data.detail
    if (detail?.idPengajuan) {
      query.mutate(() => detail)
      return true
    }

    if (data.status) {
      query.mutate((current) => current
        ? { ...current, status: data.status as PengajuanStatus }
        : current)
      patchCachedPengajuanStatus(id.value, data.status)
    }

    return false
  }

  async function setItemDecision(
    noItem: number | string,
    keputusanItem: ItemDecisionStatus,
    catatanAdmin: string
  ) {
    if (!id.value) throw new Error('ID Pengajuan tidak valid.')

    const previous = query.data.value
    const previousDecision = previous?.items
      ?.find(item => String(item.noItem) === String(noItem))
      ?.keputusanItem
    const decision = normalizeItemDecision(keputusanItem)
    patchItem(noItem, {
      keputusanItem: decision,
      catatanAdminItem: catatanAdmin,
      tanggalUpdateKeputusanItem: new Date().toISOString()
    })

    try {
      const data = await postDetailMutation('item-decision', {
        noItem,
        keputusanItem: decision,
        catatanAdmin
      })

      // Server sudah mengonfirmasi dan memperbarui cache.
      // UI tetap responsif karena optimistic update sudah terjadi.
      invalidate('getDashboardSummary')
      if (!applyMutationResponse(data)) void query.refresh()
    } catch (err) {
      // Rollback dengan fetch ulang.
      query.mutate(() => previous)
      patchCachedItemDecision(id.value, noItem, normalizeItemDecision(String(previousDecision || '')))
      if (previous) patchCachedPengajuanStatus(id.value, previous.status)
      toast.add({
        title: 'Gagal memperbarui keputusan item',
        description: err instanceof Error ? err.message : String(err),
        color: 'error',
        icon: 'i-lucide-circle-alert'
      })
      void query.refresh()
      throw err
    }
  }

  async function setPengajuanStatus(statusBaru: PengajuanStatus, catatanAdmin: string) {
    if (!id.value) throw new Error('ID Pengajuan tidak valid.')

    const previous = query.data.value
    query.mutate((current) => current
      ? {
          ...current,
          status: statusBaru,
          catatanAdmin,
          tanggalUpdateStatusTerakhir: new Date().toISOString()
        }
      : current)
    patchCachedPengajuanStatus(id.value, statusBaru)

    try {
      const data = await postDetailMutation('status', {
        statusBaru,
        catatanAdmin
      })

      invalidate('getDashboardSummary')
      if (!applyMutationResponse(data)) void query.refresh()
    } catch (err) {
      query.mutate(() => previous)
      if (previous) {
        patchCachedPengajuanStatus(id.value, previous.status)
      }
      toast.add({
        title: 'Gagal memperbarui status pengajuan',
        description: err instanceof Error ? err.message : String(err),
        color: 'error',
        icon: 'i-lucide-circle-alert'
      })
      throw err
    }
  }

  return {
    detail: query.data,
    error: query.error,
    isLoading: query.isLoading,
    isRefreshing: query.isRefreshing,
    load,
    refresh: query.refresh,
    invalidate: query.invalidate,
    setItemDecision,
    setPengajuanStatus,
    getParams
  }
}

function patchCachedPengajuanDetail(idPengajuan: string, updater: (detail: DetailPengajuan) => DetailPengajuan | null) {
  const now = Date.now()
  const legacyStore = useState<Record<string, DetailCacheEntry>>('appsheet-query-store', () => ({}))
  const adminCacheStore = useState<Record<string, DetailCacheEntry>>('admin-cache-query-store', () => ({}))
  const adminCacheKeyPrefix = `/api/admin-cache/pengajuan/${encodeURIComponent(idPengajuan)}::`

  for (const [key, entry] of Object.entries(legacyStore.value)) {
    if (!key.startsWith('getDetail::')) continue
    patchDetailCacheEntry(entry, idPengajuan, updater, now)
  }

  for (const [key, entry] of Object.entries(adminCacheStore.value)) {
    if (!key.startsWith(adminCacheKeyPrefix) && !isCachedPengajuanDetail(entry.data, idPengajuan)) continue
    patchDetailCacheEntry(entry, idPengajuan, updater, now)
  }
}

function patchDetailCacheEntry(
  entry: DetailCacheEntry,
  idPengajuan: string,
  updater: (detail: DetailPengajuan) => DetailPengajuan | null,
  fetchedAt: number
) {
  const detail = entry.data
  if (!isCachedPengajuanDetail(detail, idPengajuan)) return

  entry.data = updater(detail)
  entry.fetchedAt = fetchedAt
}

function isCachedPengajuanDetail(
  detail: DetailPengajuan | null | undefined,
  idPengajuan: string
): detail is DetailPengajuan {
  return String(detail?.idPengajuan || '') === String(idPengajuan)
}

export function usePengajuanAdminMutations() {
  const { callAdminCache } = useAdminCacheApi()
  const { invalidate } = useAppSheetInvalidate()
  const {
    patchPengajuanRow: patchCachedPengajuanRow,
    patchPengajuanStatus: patchCachedPengajuanStatus,
    removePengajuanRow: removeCachedPengajuanRow
  } = useDashboardPengajuanCache()

  function applyMutationResponse(idPengajuan: string, data: DetailMutationResponse | undefined) {
    if (data?.row?.idPengajuan) {
      patchCachedPengajuanRow(data.row)
    }

    if (data?.detail?.idPengajuan) {
      patchCachedPengajuanDetail(data.detail.idPengajuan, () => data.detail as DetailPengajuan)
      return
    }

    if (data?.row?.idPengajuan) {
      patchCachedPengajuanDetail(data.row.idPengajuan, (detail) => ({
        ...detail,
        nama: data.row?.nama ?? detail.nama,
        bagianCabang: data.row?.bagianCabang ?? detail.bagianCabang,
        jumlahItem: data.row?.jumlahItem ?? detail.jumlahItem,
        status: data.row?.status ? (data.row.status as PengajuanStatus) : detail.status
      }))
      return
    }

    patchCachedPengajuanDetail(idPengajuan, (detail) => detail)
  }

  function patchPengajuanStatus(idPengajuan: string, status: PengajuanStatus | string, catatanAdmin = '') {
    patchCachedPengajuanStatus(idPengajuan, status)
    patchCachedPengajuanDetail(idPengajuan, (detail) => ({
      ...detail,
      status: status as PengajuanStatus,
      catatanAdmin: catatanAdmin || detail.catatanAdmin,
      tanggalUpdateStatusTerakhir: new Date().toISOString()
    }))
  }

  async function postPengajuanMutation(
    idPengajuan: string,
    action: 'update' | 'delete',
    body: Record<string, unknown> = {}
  ) {
    return await callAdminCache<DetailMutationResponse>(
      `/api/admin-cache/pengajuan/${encodeURIComponent(idPengajuan)}/${action}`,
      {
        method: 'POST',
        body
      }
    )
  }

  async function updatePengajuan(idPengajuan: string, patch: AdminPengajuanPatch) {
    if (!idPengajuan) throw new Error('ID Pengajuan tidak valid.')

    const data = await postPengajuanMutation(idPengajuan, 'update', patch)

    applyMutationResponse(idPengajuan, data)
    return data
  }

  async function deletePengajuan(idPengajuan: string) {
    if (!idPengajuan) throw new Error('ID Pengajuan tidak valid.')

    await postPengajuanMutation(idPengajuan, 'delete')
    removeCachedPengajuanRow(idPengajuan)
    patchCachedPengajuanDetail(idPengajuan, () => null)
    invalidate('getDashboardSummary')
  }

  async function completePengajuanBulk(idPengajuanList: string[], catatanAdmin: string) {
    const ids = Array.from(new Set(idPengajuanList.map(id => String(id || '').trim()).filter(Boolean)))
    if (!ids.length) throw new Error('Pilih minimal satu pengajuan.')

    const data = await callAdminCache<BulkPengajuanStatusResponse>('/api/admin-cache/pengajuan/bulk-status', {
      method: 'POST',
      body: {
        ids,
        statusBaru: 'Selesai',
        catatanAdmin
      }
    })

    for (const result of data.results || []) {
      if (!result.success) continue

      if (result.data?.detail || result.data?.row || result.data?.status) {
        applyMutationResponse(result.idPengajuan, result.data)
      } else {
        patchPengajuanStatus(result.idPengajuan, data.statusBaru, data.catatanAdmin)
      }
    }

    invalidate('getDashboardSummary')
    return data
  }

  return {
    updatePengajuan,
    deletePengajuan,
    completePengajuanBulk
  }
}
