import type { H3Event } from 'h3'
import { clean } from './normalizers'
import type { DetailMutationResponse } from './types'

type PengajuanMutationSession = {
  token: string
  role: string
}

type PengajuanAdminPatch = {
  nama: string
  bagianCabang: string
  pemilik: string
  alasanPengajuan: string
  tanggalForm: string
  catatanTambahan: string
}
type PengajuanStatus = 'Baru' | 'Disetujui' | 'Ditolak' | 'Diprint' | 'Dikirim' | 'Selesai'
type ItemDecisionStatus = 'Disetujui' | 'Ditolak' | ''
type PengajuanSourceMutationAction =
  | 'updateItemDecision'
  | 'updateStatus'
  | 'updatePengajuanAdmin'
  | 'deletePengajuan'
type BulkPengajuanStatusItemResult = {
  idPengajuan: string
  success: boolean
  data?: DetailMutationResponse
  error?: string
}

const PENGAJUAN_STATUSES: ReadonlySet<PengajuanStatus> = new Set([
  'Baru',
  'Disetujui',
  'Ditolak',
  'Diprint',
  'Dikirim',
  'Selesai'
])
const ITEM_DECISION_STATUSES: ReadonlySet<ItemDecisionStatus> = new Set([
  '',
  'Disetujui',
  'Ditolak'
])
const PENGAJUAN_MUTATION_ROLES = new Set(['admin', 'qrcc'])
const BULK_STATUS_CONCURRENCY = 4
const MAX_BULK_STATUS_IDS = 100
const PENGAJUAN_SELESAI_NOTE = 'Kartu garansi sudah diterima dan pengajuan selesai.'

export function getRequiredPengajuanId(event: H3Event) {
  const idPengajuan = clean(getRouterParam(event, 'id'))

  if (!idPengajuan) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID Pengajuan tidak valid.'
    })
  }

  return idPengajuan
}

export async function updatePengajuanItemDecision(
  session: PengajuanMutationSession,
  idPengajuan: string,
  body: Record<string, unknown>
) {
  assertCanMutatePengajuan(session)

  const noItem = clean(body.noItem)
  const hasDecisionPayload = Object.prototype.hasOwnProperty.call(body, 'keputusanItem')
  const keputusanItem = normalizeItemDecision(body.keputusanItem)
  const catatanAdmin = clean(body.catatanAdmin)

  if (!noItem) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No Item wajib diisi.'
    })
  }

  if (!hasDecisionPayload) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Keputusan item wajib diisi.'
    })
  }

  if (keputusanItem === 'Ditolak' && !catatanAdmin) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Catatan Admin wajib diisi jika keputusan Ditolak.'
    })
  }

  return mutatePengajuanInSource(session, 'updateItemDecision', idPengajuan, {
    noItem,
    keputusanItem,
    catatanAdmin
  })
}

export async function updatePengajuanStatus(
  session: PengajuanMutationSession,
  idPengajuan: string,
  body: Record<string, unknown>
) {
  assertCanMutatePengajuan(session)

  const statusBaru = normalizePengajuanStatus(body.statusBaru)
  const catatanAdmin = clean(body.catatanAdmin)

  return mutatePengajuanInSource(session, 'updateStatus', idPengajuan, {
    statusBaru,
    catatanAdmin
  })
}

export async function updatePengajuanAdmin(
  session: PengajuanMutationSession,
  idPengajuan: string,
  body: Record<string, unknown>
) {
  assertCanAdminMutatePengajuan(session)

  return mutatePengajuanInSource(session, 'updatePengajuanAdmin', idPengajuan, normalizePengajuanAdminPatch(body))
}

export async function deletePengajuanAdmin(
  session: PengajuanMutationSession,
  idPengajuan: string
) {
  assertCanAdminMutatePengajuan(session)

  const result = await callAppsScriptMutation(session.token, 'deletePengajuan', { idPengajuan })
  await deletePengajuanFromCache(idPengajuan)

  return result.data || {}
}

export async function bulkUpdatePengajuanStatus(
  session: PengajuanMutationSession,
  body: Record<string, unknown>
) {
  assertCanAdminMutatePengajuan(session)

  const ids = normalizeBulkPengajuanIds(body.ids)
  const statusBaru = normalizePengajuanStatus(body.statusBaru ?? 'Selesai')
  const catatanAdmin = clean(body.catatanAdmin) || PENGAJUAN_SELESAI_NOTE

  if (statusBaru !== 'Selesai') {
    throwValidationError('Bulk update hanya mendukung status Selesai.')
  }

  const results = await mapWithConcurrency<string, BulkPengajuanStatusItemResult>(
    ids,
    BULK_STATUS_CONCURRENCY,
    async (idPengajuan) => {
      try {
        const data = await mutatePengajuanInSource(session, 'updateStatus', idPengajuan, {
          statusBaru,
          catatanAdmin
        })

        return {
          idPengajuan,
          success: true,
          data
        }
      } catch (error) {
        return {
          idPengajuan,
          success: false,
          error: getErrorMessage(error)
        }
      }
    }
  )
  const updated = results.filter(result => result.success).length

  return {
    statusBaru,
    catatanAdmin,
    total: ids.length,
    updated,
    failed: ids.length - updated,
    results
  }
}

function assertCanMutatePengajuan(session: PengajuanMutationSession) {
  if (PENGAJUAN_MUTATION_ROLES.has(session.role)) return

  throw createError({
    statusCode: 403,
    statusMessage: 'Unauthorized: role tidak boleh mengubah pengajuan.'
  })
}

function assertCanAdminMutatePengajuan(session: PengajuanMutationSession) {
  if (session.role === 'admin') return

  throw createError({
    statusCode: 403,
    statusMessage: 'Unauthorized: hanya admin yang boleh mengubah data pengajuan.'
  })
}

function normalizePengajuanStatus(value: unknown): PengajuanStatus {
  const status = clean(value)

  if (PENGAJUAN_STATUSES.has(status as PengajuanStatus)) {
    return status as PengajuanStatus
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Status pengajuan tidak valid.'
  })
}

function normalizeItemDecision(value: unknown): ItemDecisionStatus {
  const decision = clean(value)

  if (ITEM_DECISION_STATUSES.has(decision as ItemDecisionStatus)) {
    return decision as ItemDecisionStatus
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Keputusan item tidak valid.'
  })
}

function normalizePengajuanAdminPatch(body: Record<string, unknown>): PengajuanAdminPatch {
  const patch = {
    nama: clean(body.nama),
    bagianCabang: clean(body.bagianCabang),
    pemilik: clean(body.pemilik),
    alasanPengajuan: clean(body.alasanPengajuan),
    tanggalForm: clean(body.tanggalForm),
    catatanTambahan: clean(body.catatanTambahan)
  }

  if (!patch.nama) throwValidationError('Nama wajib diisi.')
  if (!patch.bagianCabang) throwValidationError('Cabang wajib diisi.')
  if (!patch.pemilik) throwValidationError('Pemilik wajib diisi.')
  if (!patch.alasanPengajuan) throwValidationError('Alasan Pengajuan wajib diisi.')
  if (!isValidDateInput(patch.tanggalForm)) throwValidationError('Tanggal Form tidak valid.')

  return patch
}

function normalizeBulkPengajuanIds(value: unknown) {
  if (!Array.isArray(value)) {
    throwValidationError('ID Pengajuan wajib berupa array.')
  }

  const ids = Array.from(new Set(value.map(id => clean(id)).filter(Boolean)))

  if (!ids.length) throwValidationError('Pilih minimal satu pengajuan.')
  if (ids.length > MAX_BULK_STATUS_IDS) {
    throwValidationError(`Maksimal ${MAX_BULK_STATUS_IDS} pengajuan per proses bulk.`)
  }

  return ids
}

function throwValidationError(statusMessage: string): never {
  throw createError({
    statusCode: 400,
    statusMessage
  })
}

function isValidDateInput(value: string) {
  return Boolean(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
) {
  const results: R[] = []
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index] as T)
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, runWorker))

  return results
}

async function mutatePengajuanInSource(
  session: PengajuanMutationSession,
  action: Exclude<PengajuanSourceMutationAction, 'deletePengajuan'>,
  idPengajuan: string,
  payload: Record<string, unknown>
) {
  const result = await callAppsScriptMutation(session.token, action, {
    idPengajuan,
    ...payload
  })
  const data = result.data || {}

  await refreshPengajuanCache(session.token, idPengajuan, data)

  return data
}

async function callAppsScriptMutation(
  token: string,
  action: PengajuanSourceMutationAction,
  payload: Record<string, unknown>
) {
  try {
    const result = await callAdminAppsScript<DetailMutationResponse>(token, action, payload)

    if (!result.success) {
      throw createError({
        statusCode: 400,
        statusMessage: result.error || 'Mutasi pengajuan gagal.'
      })
    }

    return result
  } catch (error) {
    if (isH3Error(error)) throw error

    throw createError({
      statusCode: 502,
      statusMessage: error instanceof Error ? error.message : String(error)
    })
  }
}

async function refreshPengajuanCache(
  token: string,
  idPengajuan: string,
  data: DetailMutationResponse
) {
  try {
    if (data.detail?.idPengajuan) {
      await upsertPengajuanRowsToCache([data.detail], { detail: true })
      return
    }

    await syncAdminCache({ token, mode: 'detail', idPengajuan })
  } catch (error) {
    console.error('[admin-cache] Gagal memperbarui cache detail pengajuan setelah mutasi.', error)
    triggerAdminCacheSync({ token, mode: 'detail', idPengajuan })
  }
}

function isH3Error(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'statusCode' in error
  )
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    return clean(record.statusMessage || record.message || record.data)
  }

  return error instanceof Error ? error.message : String(error)
}
