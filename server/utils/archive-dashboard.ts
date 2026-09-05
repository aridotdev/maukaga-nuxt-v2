import { desc } from 'drizzle-orm'
import { z } from 'zod'
import { db as defaultDb, type Database } from '../database'
import { archiveFiles, pengajuan, pengajuanItems, statusLog } from '../database/schema'
import { ITEM_DECISION_STATUSES, PENGAJUAN_STATUSES } from '../database/schema/constants'

type DashboardStatus = (typeof PENGAJUAN_STATUSES)[number]
type DashboardItemDecision = (typeof ITEM_DECISION_STATUSES)[number] | ''
type DashboardSortDirection = 'asc' | 'desc'
type DashboardChartGroupBy = 'day' | 'week' | 'month' | 'year'

export type ArchiveDashboardItem = {
  noItem: number
  model: string
  nomorSeri: string
  keputusanItem: DashboardItemDecision
}

export type ArchiveDashboardRow = {
  idPengajuan: string
  timestampSubmit: string
  nama: string
  bagianCabang: string
  pemilik?: string | null
  alasanPengajuan?: string | null
  tanggalForm?: string | null
  catatanTambahan?: string | null
  jumlahItem: number
  status: DashboardStatus | string
  items: ArchiveDashboardItem[]
}

export type ArchiveDashboardSummary = {
  total: number
  totalItems: number
  baru: number
  disetujui: number
  ditolak: number
  diprint: number
  dikirim: number
  selesai: number
  itemDisetujui: number
  itemDitolak: number
}

export type ArchiveDashboardResponse = {
  summary: ArchiveDashboardSummary
  rows: ArchiveDashboardRow[]
  totalRows: number
  page: number
  pageSize: number
  admin: string
  source: 'archive'
}

export type ArchiveChartPoint = {
  period: string
  totalItems: number
  approvedItems: number
  rejectedItems: number
}

export type ArchiveChartResponse = {
  points: ArchiveChartPoint[]
  summary: {
    totalItems: number
    approvedItems: number
    rejectedItems: number
  }
  groupBy: DashboardChartGroupBy
  startDate: string
  endDate: string
  admin: string
  source: 'archive'
}

export type ArchiveDetailResponse = {
  idPengajuan: string
  timestampSubmit: string
  nama: string
  bagianCabang: string
  pemilik: string
  alasanPengajuan: string
  tanggalForm: string
  fileHardCopyUrl: string
  fileHardCopyId: string
  evidenceAttachmentUrls: string[]
  evidenceAttachmentIds: string[]
  catatanTambahan: string
  jumlahItem: number
  status: DashboardStatus | string
  catatanAdmin: string
  tanggalUpdateStatusTerakhir: string
  userUpdateStatus: string
  riwayatSingkat: string
  items: Array<{
    noItem: number
    produk: string
    model: string
    nomorSeri: string
    modelNormalized: string
    produkStatus: string
    produkSumber: string
    keputusanItem: DashboardItemDecision
    catatanAdminItem: string
    tanggalUpdateKeputusanItem: string
    userUpdateKeputusanItem: string
    jenisKartu: string
    statusCetak: string
    printBatchId: string
    printedAt: string
    statusKirim: string
    shipBatchId: string
    shippedAt: string
  }>
  riwayat: Array<{
    timestamp: string
    noItem: string
    statusLama: string
    statusBaru: string
    catatanAdmin: string
    user: string
  }>
  dataSource: 'archive'
}

const archiveDashboardQuerySchema = z.object({
  page: z.preprocess(toOptionalPositiveInteger, z.number().int().min(1).default(1)),
  pageSize: z.preprocess(toOptionalPositiveInteger, z.number().int().min(1).max(100).default(15)),
  search: z.preprocess(toText, z.string().default('')),
  itemDecision: z.preprocess(toOptionalText, z.union([z.literal('all'), z.literal('pending'), z.enum(ITEM_DECISION_STATUSES)]).default('all')),
  status: z.preprocess(toText, z.union([z.literal(''), z.literal('all'), z.enum(PENGAJUAN_STATUSES)]).default('')),
  sortBy: z.preprocess(toOptionalText, z.string().default('timestampSubmit')),
  sortDirection: z.preprocess(toOptionalText, z.union([z.literal('asc'), z.literal('desc')]).default('desc')),
})

const archiveChartQuerySchema = z.object({
  startDate: z.preprocess(toText, z.string().min(1)),
  endDate: z.preprocess(toText, z.string().min(1)),
  groupBy: z.preprocess(toOptionalText, z.union([z.literal('day'), z.literal('week'), z.literal('month'), z.literal('year')]).default('day')),
})

function toText(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toOptionalText(value: unknown) {
  const text = toText(value)
  return text || undefined
}

function toOptionalPositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return value
  return Math.floor(parsed)
}

function normalizeStatus(value: unknown): DashboardStatus | string {
  const text = toText(value)
  if ((PENGAJUAN_STATUSES as readonly string[]).includes(text)) return text as DashboardStatus
  return text || 'Baru'
}

function normalizeDecision(value: unknown): DashboardItemDecision {
  const text = toText(value)
  if (text === 'Disetujui' || text === 'Ditolak') return text
  return ''
}

function normalizeDateTime(value: unknown) {
  const text = toText(value)
  if (!text) return ''
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return date.toISOString()
}

function getDateTime(value: string) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function buildItemHaystack(row: ArchiveDashboardRow) {
  return [
    row.idPengajuan,
    row.timestampSubmit,
    row.nama,
    row.bagianCabang,
    row.pemilik,
    row.alasanPengajuan,
    row.tanggalForm,
    row.catatanTambahan,
    row.status,
    row.items.map((item) => [item.noItem, item.model, item.nomorSeri, item.keputusanItem].join(' ')).join(' '),
  ].join(' ').toLowerCase()
}

function buildItemCount(row: ArchiveDashboardRow) {
  return Math.max(row.items.length, row.jumlahItem || 0)
}

function matchesDecisionFilter(row: ArchiveDashboardRow, filter: z.infer<typeof archiveDashboardQuerySchema>['itemDecision']) {
  if (filter === 'all') return true

  const items = row.items
  if (filter === 'pending') {
    return items.some((item) => !item.keputusanItem)
  }

  return items.some((item) => item.keputusanItem === filter)
}

function compareArchiveRows(a: ArchiveDashboardRow, b: ArchiveDashboardRow, sortBy: string, sortDirection: DashboardSortDirection) {
  const dir = sortDirection === 'asc' ? 1 : -1
  const aValue = getArchiveSortValue(a, sortBy)
  const bValue = getArchiveSortValue(b, sortBy)

  if (aValue < bValue) return -1 * dir
  if (aValue > bValue) return 1 * dir
  return 0
}

function getArchiveSortValue(row: ArchiveDashboardRow, sortBy: string) {
  switch (sortBy) {
    case 'idPengajuan':
      return row.idPengajuan
    case 'nama':
      return row.nama.toLowerCase()
    case 'bagianCabang':
      return row.bagianCabang.toLowerCase()
    case 'status':
      return row.status
    case 'timestampSubmit':
    default:
      return getDateTime(row.timestampSubmit)
  }
}

function startOfPeriod(dateValue: Date, groupBy: DashboardChartGroupBy) {
  const date = new Date(dateValue)
  date.setHours(0, 0, 0, 0)

  if (groupBy === 'week') {
    const day = date.getDay()
    const offset = day === 0 ? 6 : day - 1
    date.setDate(date.getDate() - offset)
  } else if (groupBy === 'month') {
    date.setDate(1)
  } else if (groupBy === 'year') {
    date.setMonth(0, 1)
  }

  return date
}

function nextPeriod(dateValue: Date, groupBy: DashboardChartGroupBy) {
  const date = new Date(dateValue)
  if (groupBy === 'week') date.setDate(date.getDate() + 7)
  else if (groupBy === 'month') date.setMonth(date.getMonth() + 1)
  else if (groupBy === 'year') date.setFullYear(date.getFullYear() + 1)
  else date.setDate(date.getDate() + 1)
  return startOfPeriod(date, groupBy)
}

function formatDateKey(dateValue: Date) {
  return dateValue.toISOString().slice(0, 10)
}

function buildSummary(rows: ArchiveDashboardRow[]): ArchiveDashboardSummary {
  const summary: ArchiveDashboardSummary = {
    total: rows.length,
    totalItems: 0,
    baru: 0,
    disetujui: 0,
    ditolak: 0,
    diprint: 0,
    dikirim: 0,
    selesai: 0,
    itemDisetujui: 0,
    itemDitolak: 0,
  }

  rows.forEach((row) => {
    const statusKey = String(row.status || '').toLowerCase()
    if (Object.prototype.hasOwnProperty.call(summary, statusKey)) {
      const summaryCounts = summary as Record<string, number>
      summaryCounts[statusKey] = (summaryCounts[statusKey] || 0) + 1
    }

    summary.totalItems += buildItemCount(row)
    row.items.forEach((item) => {
      if (item.keputusanItem === 'Disetujui') summary.itemDisetujui += 1
      else if (item.keputusanItem === 'Ditolak') summary.itemDitolak += 1
    })
  })

  return summary
}

function buildRows(
  parents: Array<typeof pengajuan.$inferSelect>,
  items: Array<typeof pengajuanItems.$inferSelect>,
  params: z.infer<typeof archiveDashboardQuerySchema>,
) {
  const itemsById = new Map<string, Array<typeof pengajuanItems.$inferSelect>>()
  items.forEach((item) => {
    const id = toText(item.idPengajuan)
    if (!id) return
    if (!itemsById.has(id)) itemsById.set(id, [])
    itemsById.get(id)!.push(item)
  })

  const rows = parents.map((parent) => {
    const idPengajuan = toText(parent.idPengajuan)
    const rowItems = (itemsById.get(idPengajuan) || [])
      .slice()
      .sort((a, b) => Number(a.noItem) - Number(b.noItem))
      .map((item) => ({
        noItem: Number(item.noItem || 0),
        model: toText(item.model),
        nomorSeri: toText(item.nomorSeri),
        keputusanItem: normalizeDecision(item.keputusanItem),
      }))

    return {
      idPengajuan,
      timestampSubmit: normalizeDateTime(parent.timestampSubmit),
      nama: toText(parent.nama),
      bagianCabang: toText(parent.bagianCabang),
      pemilik: toText(parent.pemilik),
      alasanPengajuan: toText(parent.alasanPengajuan),
      tanggalForm: toText(parent.tanggalForm),
      catatanTambahan: toText(parent.catatanTambahan),
      jumlahItem: Number(parent.jumlahItem || rowItems.length || 0),
      status: normalizeStatus(parent.status),
      items: rowItems,
    }
  }).filter((row) => {
    if (params.status && params.status !== 'all' && row.status !== params.status) return false
    if (params.search) {
      const needle = params.search.toLowerCase()
      if (!buildItemHaystack(row).includes(needle)) return false
    }
    return matchesDecisionFilter(row, params.itemDecision)
  })

  rows.sort((a, b) => compareArchiveRows(a, b, params.sortBy, params.sortDirection))

  const summary = buildSummary(rows)
  const totalRows = rows.length
  const start = (params.page - 1) * params.pageSize
  const pagedRows = rows.slice(start, start + params.pageSize)

  return {
    summary,
    rows: pagedRows,
    totalRows,
    page: params.page,
    pageSize: params.pageSize,
  }
}

function buildChart(
  parents: Array<typeof pengajuan.$inferSelect>,
  items: Array<typeof pengajuanItems.$inferSelect>,
  params: z.infer<typeof archiveChartQuerySchema>,
) {
  const startDate = new Date(`${params.startDate}T00:00:00`)
  const endDate = new Date(`${params.endDate}T23:59:59.999`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Rentang tanggal tidak valid')
  }
  if (startDate > endDate) throw new Error('startDate tidak boleh lebih besar dari endDate')

  const parentsInRange = parents.filter((parent) => {
    const timestamp = new Date(toText(parent.timestampSubmit))
    if (Number.isNaN(timestamp.getTime())) return false
    if (timestamp < startDate || timestamp > endDate) return false
    return true
  })

  const itemsById = new Map<string, Array<typeof pengajuanItems.$inferSelect>>()
  items.forEach((item) => {
    const id = toText(item.idPengajuan)
    if (!id) return
    if (!itemsById.has(id)) itemsById.set(id, [])
    itemsById.get(id)!.push(item)
  })

  const periodPoints = new Map<string, ArchiveChartPoint>()
  let cursor = startOfPeriod(startDate, params.groupBy)
  const endPeriod = startOfPeriod(endDate, params.groupBy)
  while (cursor <= endPeriod) {
    const period = formatDateKey(cursor)
    periodPoints.set(period, {
      period,
      totalItems: 0,
      approvedItems: 0,
      rejectedItems: 0,
    })
    cursor = nextPeriod(cursor, params.groupBy)
  }

  const summary = {
    totalItems: 0,
    approvedItems: 0,
    rejectedItems: 0,
  }

  parentsInRange.forEach((parent) => {
    const parentDate = new Date(toText(parent.timestampSubmit))
    const period = formatDateKey(startOfPeriod(parentDate, params.groupBy))
    const point = periodPoints.get(period) || {
      period,
      totalItems: 0,
      approvedItems: 0,
      rejectedItems: 0,
    }
    const parentItems = (itemsById.get(toText(parent.idPengajuan)) || []).slice()
    const itemCount = parentItems.length || Number(parent.jumlahItem || 0)

    point.totalItems += itemCount
    parentItems.forEach((item) => {
      const decision = normalizeDecision(item.keputusanItem)
      if (decision === 'Disetujui') point.approvedItems += 1
      else if (decision === 'Ditolak') point.rejectedItems += 1
    })

    periodPoints.set(period, point)
    summary.totalItems += itemCount
    parentItems.forEach((item) => {
      const decision = normalizeDecision(item.keputusanItem)
      if (decision === 'Disetujui') summary.approvedItems += 1
      else if (decision === 'Ditolak') summary.rejectedItems += 1
    })
  })

  return {
    points: Array.from(periodPoints.values()).sort((a, b) => a.period.localeCompare(b.period)),
    summary,
    groupBy: params.groupBy,
    startDate: params.startDate,
    endDate: params.endDate,
  }
}

function buildDetail(
  parent: typeof pengajuan.$inferSelect,
  items: Array<typeof pengajuanItems.$inferSelect>,
  logs: Array<typeof statusLog.$inferSelect>,
  files: Array<typeof archiveFiles.$inferSelect>,
): ArchiveDetailResponse {
  const idPengajuan = toText(parent.idPengajuan)
  const hardcopyFile = files.find((file) => file.kind === 'hardcopy') || null
  const evidenceFiles = files
    .filter((file) => file.kind === 'bukti')
    .sort((a, b) => Number(a.sequence) - Number(b.sequence))

  return {
    idPengajuan,
    timestampSubmit: normalizeDateTime(parent.timestampSubmit),
    nama: toText(parent.nama),
    bagianCabang: toText(parent.bagianCabang),
    pemilik: toText(parent.pemilik),
    alasanPengajuan: toText(parent.alasanPengajuan),
    tanggalForm: toText(parent.tanggalForm),
    fileHardCopyUrl: hardcopyFile ? toText(hardcopyFile.publicPath) : '',
    fileHardCopyId: toText(hardcopyFile?.sourceDriveFileId || hardcopyFile?.id || ''),
    evidenceAttachmentUrls: evidenceFiles.map((file) => toText(file.publicPath)),
    evidenceAttachmentIds: evidenceFiles.map((file) => toText(file.sourceDriveFileId || file.id || '')),
    catatanTambahan: toText(parent.catatanTambahan),
    jumlahItem: Number(parent.jumlahItem || items.length || 0),
    status: normalizeStatus(parent.status),
    catatanAdmin: toText(parent.catatanAdmin),
    tanggalUpdateStatusTerakhir: normalizeDateTime(parent.tanggalUpdateStatusTerakhir),
    userUpdateStatus: toText(parent.userUpdateStatus),
    riwayatSingkat: logs.slice(0, 3).map((log) => [
      log.timestamp,
      log.statusLama,
      log.statusBaru,
      log.user,
    ].filter(Boolean).join(' · ')).join(' | '),
    items: items
      .slice()
      .sort((a, b) => Number(a.noItem) - Number(b.noItem))
      .map((item) => ({
        noItem: Number(item.noItem || 0),
        produk: toText(item.produk),
        model: toText(item.model),
        nomorSeri: toText(item.nomorSeri),
        modelNormalized: toText(item.modelNormalized),
        produkStatus: toText(item.produkStatus),
        produkSumber: toText(item.produkSumber),
        keputusanItem: normalizeDecision(item.keputusanItem),
        catatanAdminItem: toText(item.catatanAdminItem),
        tanggalUpdateKeputusanItem: normalizeDateTime(item.tanggalUpdateKeputusanItem),
        userUpdateKeputusanItem: toText(item.userUpdateKeputusanItem),
        jenisKartu: toText(item.jenisKartu),
        statusCetak: toText(item.statusCetak),
        printBatchId: toText(item.printBatchId),
        printedAt: normalizeDateTime(item.printedAt),
        statusKirim: toText(item.statusKirim),
        shipBatchId: toText(item.shipBatchId),
        shippedAt: normalizeDateTime(item.shippedAt),
      })),
    riwayat: logs
      .slice()
      .sort((a, b) => getDateTime(toText(b.timestamp)) - getDateTime(toText(a.timestamp)))
      .map((log) => ({
        timestamp: normalizeDateTime(log.timestamp),
        noItem: toText(log.noItem),
        statusLama: toText(log.statusLama),
        statusBaru: toText(log.statusBaru),
        catatanAdmin: toText(log.catatanAdmin),
        user: toText(log.user),
      })),
    dataSource: 'archive',
  }
}

export async function readArchiveDashboard(
  input: unknown,
  database: Database = defaultDb,
): Promise<ArchiveDashboardResponse> {
  const params = archiveDashboardQuerySchema.parse(input)
  const [parents, items] = await Promise.all([
    database.select().from(pengajuan).orderBy(desc(pengajuan.timestampSubmit)),
    database.select().from(pengajuanItems),
  ])

  const result = buildRows(parents, items, params)
  return {
    ...result,
    admin: 'Arsip Lokal',
    source: 'archive',
  }
}

export async function readArchiveChart(
  input: unknown,
  database: Database = defaultDb,
): Promise<ArchiveChartResponse> {
  const params = archiveChartQuerySchema.parse(input)
  const [parents, items] = await Promise.all([
    database.select().from(pengajuan).orderBy(desc(pengajuan.timestampSubmit)),
    database.select().from(pengajuanItems),
  ])

  const result = buildChart(parents, items, params)
  return {
    ...result,
    admin: 'Arsip Lokal',
    source: 'archive',
  }
}

export async function readArchiveDetail(
  idPengajuan: string,
  database: Database = defaultDb,
): Promise<ArchiveDetailResponse> {
  const id = toText(idPengajuan)
  if (!id) throw new Error('ID Pengajuan wajib diisi')

  const parentRow = (await database.select().from(pengajuan)).find((row) => toText(row.idPengajuan) === id)
  if (!parentRow) throw new Error('Pengajuan tidak ditemukan')

  const [items, logs, files] = await Promise.all([
    database.select().from(pengajuanItems),
    database.select().from(statusLog),
    database.select().from(archiveFiles),
  ])

  return buildDetail(
    parentRow,
    items.filter((item) => toText(item.idPengajuan) === id),
    logs.filter((log) => toText(log.idPengajuan) === id),
    files.filter((file) => toText(file.idPengajuan) === id),
  )
}
