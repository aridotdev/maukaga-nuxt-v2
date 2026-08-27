import { and, asc, count, desc, eq, inArray, like, notInArray, or, sql } from 'drizzle-orm'
import { pengajuan, pengajuanItems, syncMeta } from '../../database/schema/schema'
import { asRecord, clean, normalizeDetail, normalizePengajuan, parseJson, toItemCacheId } from './normalizers'
import type { DashboardChartResponse, DashboardResponse, DashboardRow, DetailPengajuan } from './types'

type PengajuanListParams = {
  page?: number
  pageSize?: number
  search?: string
  itemDecision?: string
  status?: string
  sortBy?: string
  sortDirection?: string
}

type ChartParams = {
  startDate?: string
  endDate?: string
  groupBy?: string
}

type UpsertOptions = {
  detail?: boolean
}

export async function getAdminCacheStatus() {
  const db = await useAdminCacheDb()
  const rows = await db.select().from(syncMeta)
  const meta = Object.fromEntries(rows.map(row => [row.key, row.value]))
  const total = await countPengajuanRows()

  return {
    status: meta.sync_in_progress === 'true'
      ? 'syncing'
      : meta.last_error_message
        ? 'failed'
        : total > 0
          ? 'up to date'
          : 'empty',
    inProgress: meta.sync_in_progress === 'true',
    lastStartedAt: meta.last_started_at || '',
    lastSuccessAt: meta.last_success_at || '',
    lastErrorAt: meta.last_error_at || '',
    lastErrorMessage: meta.last_error_message || '',
    lastRowCount: Number(meta.last_row_count || total),
    totalRows: total
  }
}

export async function setAdminCacheMeta(values: Record<string, string | number | boolean>) {
  const db = await useAdminCacheDb()
  const updatedAt = new Date().toISOString()

  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      await tx.insert(syncMeta)
        .values({ key, value: String(value), updatedAt })
        .onConflictDoUpdate({
          target: syncMeta.key,
          set: { value: String(value), updatedAt }
        })
        .run()
    }
  })
}

export async function countPengajuanRows() {
  const db = await useAdminCacheDb()
  const result = await db.select({ total: count() }).from(pengajuan)
  return Number(result[0]?.total || 0)
}

export async function getDashboardFromCache(params: PengajuanListParams = {}): Promise<DashboardResponse> {
  const page = normalizePage(params.page)
  const pageSize = normalizePageSize(params.pageSize ?? 20, 500)
  const [rows, totalRows, summary] = await Promise.all([
    getPengajuanRowsFromCache({ ...params, page, pageSize }),
    countPengajuanRowsByFilter(params),
    getSummaryFromCache()
  ])

  return {
    summary,
    rows,
    totalRows,
    page,
    pageSize
  }
}

export async function getLatestPengajuanFromCache(limit = 5): Promise<DashboardResponse> {
  return getDashboardFromCache({
    page: 1,
    pageSize: limit,
    sortBy: 'timestampSubmit',
    sortDirection: 'desc'
  })
}

export async function getPengajuanListFromCache(params: PengajuanListParams = {}): Promise<DashboardResponse> {
  const page = normalizePage(params.page)
  const pageSize = normalizePageSize(params.pageSize ?? 15, 100)
  const [rows, totalRows] = await Promise.all([
    getPengajuanRowsFromCache({ ...params, page, pageSize }),
    countPengajuanRowsByFilter(params)
  ])

  return {
    rows,
    totalRows,
    page,
    pageSize
  }
}

export async function getPengajuanDetailFromCache(idPengajuan: string): Promise<DetailPengajuan | null> {
  const db = await useAdminCacheDb()
  const rows = await db.select().from(pengajuan).where(eq(pengajuan.idPengajuan, idPengajuan)).limit(1)
  const row = rows[0]

  if (!row) return null

  const cachedItems = await db.select()
    .from(pengajuanItems)
    .where(eq(pengajuanItems.idPengajuan, idPengajuan))
    .orderBy(asc(pengajuanItems.noItem))

  const rawDetail = row.detailJson
    ? parseJson<DetailPengajuan | null>(row.detailJson, null)
    : null
  const rawRow = parseJson<DashboardRow>(row.rawJson, {
    idPengajuan: row.idPengajuan,
    timestampSubmit: row.timestampSubmit || '',
    nama: row.nama || '',
    bagianCabang: row.bagianCabang || '',
    pemilik: row.pemilik || '',
    alasanPengajuan: row.alasanPengajuan || '',
    tanggalForm: row.tanggalForm || '',
    catatanTambahan: row.catatanTambahan || '',
    jumlahItem: row.jumlahItem || cachedItems.length,
    status: row.status || 'Baru',
    items: []
  })

  const detail = normalizeDetail(rawDetail || rawRow)

  if (!detail) return null

  const fallbackItems = cachedItems.map(item => ({
    ...parseJson<Record<string, unknown>>(item.rawJson, {}),
    noItem: item.noItem || '',
    produk: item.produk || '',
    model: item.model || '',
    nomorSeri: item.nomorSeri || '',
    keputusanItem: item.keputusanItem || ''
  }))
  const detailItems = Array.isArray(detail.items) && detail.items.length
    ? detail.items
    : fallbackItems

  return {
    ...detail,
    items: detailItems
  } as DetailPengajuan
}

export async function getChartFromCache(params: ChartParams): Promise<DashboardChartResponse> {
  const rows = await getPengajuanRowsForChart(params)
  const groupBy = normalizeGroupBy(params.groupBy)
  const groups = new Map<string, {
    totalItems: number
    approvedItems: number
    rejectedItems: number
  }>()
  const summary = {
    totalItems: 0,
    approvedItems: 0,
    rejectedItems: 0
  }

  for (const row of rows) {
    const key = getChartPeriod(row.timestampSubmit, groupBy)
    if (!key) continue

    const items = row.items || []
    const totalItems = Number(row.jumlahItem || items.length || 0)
    const approvedItems = items.filter(item => item.keputusanItem === 'Disetujui').length
    const rejectedItems = items.filter(item => item.keputusanItem === 'Ditolak').length
    const group = groups.get(key) || {
      totalItems: 0,
      approvedItems: 0,
      rejectedItems: 0
    }

    group.totalItems += totalItems
    group.approvedItems += approvedItems
    group.rejectedItems += rejectedItems
    groups.set(key, group)

    summary.totalItems += totalItems
    summary.approvedItems += approvedItems
    summary.rejectedItems += rejectedItems
  }

  return {
    points: Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, point]) => ({ period, ...point })),
    summary,
    groupBy,
    startDate: params.startDate,
    endDate: params.endDate
  }
}

export async function upsertPengajuanRowsToCache(rows: unknown[], options: UpsertOptions = {}) {
  const db = await useAdminCacheDb()
  const now = new Date().toISOString()
  const normalized = rows
    .map(row => normalizePengajuan(row))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  await db.transaction(async (tx) => {
    for (const entry of normalized) {
      const source = asRecord(rows.find(row => clean(asRecord(row).idPengajuan) === entry.row.idPengajuan) || entry.row)
      const insertValue = {
          idPengajuan: entry.row.idPengajuan,
          timestampSubmit: entry.row.timestampSubmit || null,
          nama: entry.row.nama || null,
          bagianCabang: entry.row.bagianCabang || null,
          pemilik: entry.row.pemilik || null,
          alasanPengajuan: entry.row.alasanPengajuan || null,
          tanggalForm: entry.row.tanggalForm || null,
          catatanTambahan: entry.row.catatanTambahan || null,
          jumlahItem: Number(entry.row.jumlahItem || entry.items.length || 0),
          status: String(entry.row.status || 'Baru'),
          rawJson: JSON.stringify(entry.row),
          ...(options.detail ? { detailJson: JSON.stringify(source) } : {}),
          cachedAt: now
        }
      const updateValue = {
        timestampSubmit: entry.row.timestampSubmit || null,
        nama: entry.row.nama || null,
        bagianCabang: entry.row.bagianCabang || null,
        pemilik: entry.row.pemilik || null,
        alasanPengajuan: entry.row.alasanPengajuan || null,
        tanggalForm: entry.row.tanggalForm || null,
        catatanTambahan: entry.row.catatanTambahan || null,
        jumlahItem: Number(entry.row.jumlahItem || entry.items.length || 0),
        status: String(entry.row.status || 'Baru'),
        rawJson: JSON.stringify(entry.row),
        ...(options.detail ? { detailJson: JSON.stringify(source) } : {}),
        cachedAt: now
      }

      await tx.insert(pengajuan)
        .values(insertValue)
        .onConflictDoUpdate({
          target: pengajuan.idPengajuan,
          set: updateValue
        })
        .run()

      await tx.delete(pengajuanItems).where(eq(pengajuanItems.idPengajuan, entry.row.idPengajuan)).run()

      for (const [index, item] of entry.items.entries()) {
        await tx.insert(pengajuanItems).values({
          id: toItemCacheId(entry.row.idPengajuan, item.noItem, index),
          idPengajuan: entry.row.idPengajuan,
          noItem: String(item.noItem || index + 1),
          model: item.model || null,
          produk: clean(asRecord(item).produk) || null,
          nomorSeri: item.nomorSeri || null,
          keputusanItem: String(item.keputusanItem || ''),
          rawJson: JSON.stringify(item),
          cachedAt: now
        }).run()
      }
    }
  })

  return normalized.length
}

export async function reconcilePengajuanCache(ids: string[]) {
  const db = await useAdminCacheDb()
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))

  if (!uniqueIds.length) return

  await db.delete(pengajuan)
    .where(notInArray(pengajuan.idPengajuan, uniqueIds))
}

export async function deletePengajuanFromCache(idPengajuan: string) {
  const db = await useAdminCacheDb()
  await db.delete(pengajuan).where(eq(pengajuan.idPengajuan, idPengajuan))
}

async function getPengajuanRowsFromCache(params: Required<Pick<PengajuanListParams, 'page' | 'pageSize'>> & PengajuanListParams) {
  const db = await useAdminCacheDb()
  const where = buildPengajuanWhere(params)
  const offset = (params.page - 1) * params.pageSize
  const sortColumn = getPengajuanSortColumn(params.sortBy)
  const sort = params.sortDirection === 'asc' ? asc(sortColumn) : desc(sortColumn)
  const records = await db.select()
    .from(pengajuan)
    .where(where)
    .orderBy(sort)
    .limit(params.pageSize)
    .offset(offset)

  return hydrateRows(records)
}

async function getPengajuanRowsForChart(params: ChartParams) {
  const db = await useAdminCacheDb()
  const clauses = []

  if (params.startDate) {
    clauses.push(sql`date(${pengajuan.timestampSubmit}) >= date(${params.startDate})`)
  }

  if (params.endDate) {
    clauses.push(sql`date(${pengajuan.timestampSubmit}) <= date(${params.endDate})`)
  }

  const records = await db.select()
    .from(pengajuan)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(asc(pengajuan.timestampSubmit))

  return hydrateRows(records)
}

async function countPengajuanRowsByFilter(params: PengajuanListParams) {
  const db = await useAdminCacheDb()
  const result = await db.select({ total: count() })
    .from(pengajuan)
    .where(buildPengajuanWhere(params))

  return Number(result[0]?.total || 0)
}

async function getSummaryFromCache() {
  const rows = await getPengajuanRowsFromCache({
    page: 1,
    pageSize: 100_000,
    sortBy: 'timestampSubmit',
    sortDirection: 'desc'
  })
  const summary = {
    total: rows.length,
    totalItems: 0,
    baru: 0,
    disetujui: 0,
    ditolak: 0,
    diprint: 0,
    dikirim: 0,
    selesai: 0,
    itemDisetujui: 0,
    itemDitolak: 0
  }

  for (const row of rows) {
    const status = String(row.status || '').toLowerCase()
    const items = row.items || []
    summary.totalItems += Number(row.jumlahItem || items.length || 0)
    summary.itemDisetujui += items.filter(item => item.keputusanItem === 'Disetujui').length
    summary.itemDitolak += items.filter(item => item.keputusanItem === 'Ditolak').length

    if (status === 'baru') summary.baru += 1
    if (status === 'disetujui') summary.disetujui += 1
    if (status === 'ditolak') summary.ditolak += 1
    if (status === 'diprint') summary.diprint += 1
    if (status === 'dikirim') summary.dikirim += 1
    if (status === 'selesai') summary.selesai += 1
  }

  return summary
}

function buildPengajuanWhere(params: PengajuanListParams) {
  const clauses = []
  const search = clean(params.search)
  const itemDecision = clean(params.itemDecision)
  const status = clean(params.status)

  if (search) {
    const pattern = `%${search}%`
    clauses.push(or(
      like(pengajuan.idPengajuan, pattern),
      like(pengajuan.nama, pattern),
      like(pengajuan.bagianCabang, pattern),
      like(pengajuan.pemilik, pattern),
      sql`EXISTS (
        SELECT 1
        FROM pengajuan_items pi
        WHERE pi.id_pengajuan = ${pengajuan.idPengajuan}
          AND (pi.model LIKE ${pattern} OR pi.nomor_seri LIKE ${pattern})
      )`
    ))
  }

  if (status && status !== 'all') {
    clauses.push(eq(pengajuan.status, status))
  }

  if (itemDecision && itemDecision !== 'all') {
    if (itemDecision === 'pending') {
      clauses.push(sql`EXISTS (
        SELECT 1
        FROM pengajuan_items pi
        WHERE pi.id_pengajuan = ${pengajuan.idPengajuan}
          AND (pi.keputusan_item IS NULL OR pi.keputusan_item = '')
      )`)
    } else {
      clauses.push(sql`EXISTS (
        SELECT 1
        FROM pengajuan_items pi
        WHERE pi.id_pengajuan = ${pengajuan.idPengajuan}
          AND pi.keputusan_item = ${itemDecision}
      )`)
    }
  }

  return clauses.length ? and(...clauses) : undefined
}

async function hydrateRows(records: Array<typeof pengajuan.$inferSelect>): Promise<DashboardRow[]> {
  const db = await useAdminCacheDb()
  const ids = records.map(row => row.idPengajuan)
  const items = ids.length
    ? await db.select().from(pengajuanItems).where(inArray(pengajuanItems.idPengajuan, ids))
    : []
  const itemsByPengajuan = new Map<string, typeof items>()

  for (const item of items) {
    const bucket = itemsByPengajuan.get(item.idPengajuan) || []
    bucket.push(item)
    itemsByPengajuan.set(item.idPengajuan, bucket)
  }

  return records.map((record) => {
    const raw = parseJson<DashboardRow>(record.rawJson, {
      idPengajuan: record.idPengajuan,
      timestampSubmit: record.timestampSubmit || '',
      nama: record.nama || '',
      bagianCabang: record.bagianCabang || '',
      pemilik: record.pemilik || '',
      alasanPengajuan: record.alasanPengajuan || '',
      tanggalForm: record.tanggalForm || '',
      catatanTambahan: record.catatanTambahan || '',
      jumlahItem: record.jumlahItem || 0,
      status: record.status || 'Baru',
      items: []
    })
    const cachedItems = itemsByPengajuan.get(record.idPengajuan) || []

    return {
      ...raw,
      idPengajuan: record.idPengajuan,
      timestampSubmit: record.timestampSubmit || raw.timestampSubmit || '',
      nama: record.nama || raw.nama || '',
      bagianCabang: record.bagianCabang || raw.bagianCabang || '',
      pemilik: record.pemilik || raw.pemilik || '',
      alasanPengajuan: record.alasanPengajuan || raw.alasanPengajuan || '',
      tanggalForm: record.tanggalForm || raw.tanggalForm || '',
      catatanTambahan: record.catatanTambahan || raw.catatanTambahan || '',
      jumlahItem: record.jumlahItem ?? raw.jumlahItem ?? cachedItems.length,
      status: record.status || raw.status || 'Baru',
      items: cachedItems
        .sort((a, b) => Number(a.noItem || 0) - Number(b.noItem || 0))
        .map(item => ({
          ...parseJson<Record<string, unknown>>(item.rawJson, {}),
          noItem: item.noItem || '',
          model: item.model || '',
          nomorSeri: item.nomorSeri || '',
          keputusanItem: item.keputusanItem || ''
        }))
    }
  })
}

function getPengajuanSortColumn(sortBy: string | undefined) {
  if (sortBy === 'nama') return pengajuan.nama
  if (sortBy === 'bagianCabang') return pengajuan.bagianCabang
  if (sortBy === 'status') return pengajuan.status
  return pengajuan.timestampSubmit
}

function normalizePage(value: unknown) {
  return Math.max(Number(value || 1), 1)
}

function normalizePageSize(value: unknown, max: number) {
  return Math.min(Math.max(Number(value || 15), 1), max)
}

function normalizeGroupBy(value: unknown): 'day' | 'week' | 'month' | 'year' {
  if (value === 'week' || value === 'month' || value === 'year') return value
  return 'day'
}

function getChartPeriod(value: string, groupBy: 'day' | 'week' | 'month' | 'year') {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return ''

  if (groupBy === 'year') return String(date.getFullYear())

  if (groupBy === 'month') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
  }

  if (groupBy === 'week') {
    const weekDate = new Date(date)
    const day = weekDate.getDay() || 7
    weekDate.setDate(weekDate.getDate() - day + 1)
    return weekDate.toISOString().slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}
