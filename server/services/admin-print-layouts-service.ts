import { randomUUID } from 'node:crypto'
import { createError, type H3Event } from 'h3'
import {
  localConfigRepository,
  type LocalConfigRepository,
} from '../repositories/config-repository'
import {
  printLayoutsRepository,
  type PrintLayoutRecord,
  type PrintLayoutsRepository,
} from '../repositories/print-layouts-repository'
import { requireAdminSession, type AdminSession } from './admin-auth-service'

export type CardTypeKey = 'local' | 'import'

export type AdminPrintLayout = {
  id: string
  type: CardTypeKey
  name: string
  offsetX: number
  offsetY: number
  gapProductModel: number
  gapModelSerial: number
  isBuiltin: boolean
  createdAt?: string
  updatedAt?: string
  updatedBy?: string
}

export type AdminPrintLayoutState = {
  layouts: AdminPrintLayout[]
  active: Record<CardTypeKey, string>
  activeLayouts: Record<CardTypeKey, AdminPrintLayout | null>
  savedLayoutId?: string
}

export type AdminPrintLayoutsServiceDependencies = {
  layoutRepository?: PrintLayoutsRepository
  configRepository?: LocalConfigRepository
  requireAdminSession?: (event: H3Event) => Promise<AdminSession>
}

type NormalizedPrintLayoutInput = {
  id: string
  type: CardTypeKey
  name: string
  offsetX: number
  offsetY: number
  gapProductModel: number
  gapModelSerial: number
}

const DEFAULT_PRINT_LAYOUTS = [
  {
    id: 'local-default',
    type: 'local',
    name: 'Local Default',
    offsetX: 0,
    offsetY: 0,
    gapProductModel: 0,
    gapModelSerial: 0,
    isBuiltin: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: 'system',
  },
  {
    id: 'import-default',
    type: 'import',
    name: 'Import Default',
    offsetX: 0,
    offsetY: 0,
    gapProductModel: 0,
    gapModelSerial: 0,
    isBuiltin: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: 'system',
  },
] satisfies AdminPrintLayout[]

const DEFAULT_ACTIVE_PRINT_LAYOUTS = {
  local: 'local-default',
  import: 'import-default',
} satisfies Record<CardTypeKey, string>

const ACTIVE_PRINT_LAYOUT_CONFIG_KEYS = {
  local: 'ACTIVE_PRINT_LAYOUT_LOCAL',
  import: 'ACTIVE_PRINT_LAYOUT_IMPORT',
} satisfies Record<CardTypeKey, string>

const PRINT_LAYOUT_ACCESS_ROLES = new Set(['admin', 'qrcc'])
const PRINT_LAYOUT_TYPES = ['local', 'import'] as const

const defaultDependencies = {
  layoutRepository: printLayoutsRepository,
  configRepository: localConfigRepository,
  requireAdminSession,
} satisfies Required<AdminPrintLayoutsServiceDependencies>

const defaultLayoutById = new Map(DEFAULT_PRINT_LAYOUTS.map(layout => [layout.id, layout]))

function resolveDependencies(dependencies: AdminPrintLayoutsServiceDependencies = {}) {
  return {
    ...defaultDependencies,
    ...dependencies,
  }
}

function clean(value: unknown) {
  return String(value || '').trim()
}

function badRequest(message: string) {
  return createError({
    statusCode: 400,
    statusMessage: message,
  })
}

function notFound(message: string) {
  return createError({
    statusCode: 404,
    statusMessage: message,
  })
}

function toHttpError(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) throw error

  return createError({
    statusCode: 500,
    statusMessage: error instanceof Error ? error.message : String(error),
  })
}

function assertPrintLayoutAccess(session: AdminSession): void {
  if (!PRINT_LAYOUT_ACCESS_ROLES.has(session.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }
}

function normalizePrintLayoutType(value: unknown, required: true): CardTypeKey
function normalizePrintLayoutType(value: unknown, required: false): CardTypeKey | ''
function normalizePrintLayoutType(value: unknown, required: boolean): CardTypeKey | '' {
  const raw = clean(value).toLowerCase()

  if (!raw) {
    if (required) throw badRequest('Jenis layout wajib dipilih')
    return ''
  }

  if (raw === 'local' || raw === 'lokal') return 'local'
  if (raw === 'import' || raw === 'impor') return 'import'

  throw badRequest('Jenis layout tidak valid')
}

function normalizeNumber(value: unknown, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback

  const number = Number(value)
  if (!Number.isFinite(number)) throw badRequest('Nilai angka tidak valid')

  return number
}

function parseBoolean(value: unknown) {
  const raw = clean(value).toLowerCase()
  return raw === 'true' || raw === 'yes' || raw === '1'
}

function toIso(value: unknown) {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()

  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toISOString()
}

function getBodyRecord(body: unknown) {
  if (!body || typeof body !== 'object') return {}
  return body as Record<string, unknown>
}

function getSessionActor(session: AdminSession) {
  return clean(session.fullName) || clean(session.email) || session.userId
}

function generatePrintLayoutId(type: CardTypeKey) {
  return `${type}-${randomUUID().slice(0, 8).toLowerCase()}`
}

function normalizePrintLayoutInput(body: unknown): NormalizedPrintLayoutInput {
  const outer = getBodyRecord(body)
  const input = getBodyRecord(outer.layout || outer)
  const type = normalizePrintLayoutType(input.type, true)
  const name = clean(input.name)

  if (!name) throw badRequest('Nama layout wajib diisi')

  return {
    id: clean(input.id || input.layoutId),
    type,
    name,
    offsetX: normalizeNumber(input.offsetX),
    offsetY: normalizeNumber(input.offsetY),
    gapProductModel: normalizeNumber(input.gapProductModel),
    gapModelSerial: normalizeNumber(input.gapModelSerial),
  }
}

function normalizeActiveLayoutInput(body: unknown) {
  const input = getBodyRecord(body)
  const type = normalizePrintLayoutType(input.type, true)
  const id = clean(input.id || input.layoutId)

  if (!id) throw badRequest('Layout wajib dipilih')

  return { type, id }
}

function normalizeDeleteLayoutInput(idOrBody: unknown) {
  if (typeof idOrBody === 'string') return clean(idOrBody)

  const input = getBodyRecord(idOrBody)
  return clean(input.id || input.layoutId)
}

function toPrintLayout(record: PrintLayoutRecord): AdminPrintLayout | null {
  const fallback = defaultLayoutById.get(record.id)
  const type = fallback?.type || normalizePrintLayoutType(record.type, false)

  if (!type) return null

  return {
    id: record.id,
    type,
    name: clean(record.name) || fallback?.name || 'Layout',
    offsetX: normalizeNumber(record.offsetX, fallback?.offsetX || 0),
    offsetY: normalizeNumber(record.offsetY, fallback?.offsetY || 0),
    gapProductModel: normalizeNumber(record.gapProductModel, fallback?.gapProductModel || 0),
    gapModelSerial: normalizeNumber(record.gapModelSerial, fallback?.gapModelSerial || 0),
    isBuiltin: Boolean(fallback) || parseBoolean(record.isBuiltin),
    createdAt: toIso(record.createdAtGas) || toIso(record.createdAt),
    updatedAt: toIso(record.updatedAtGas) || toIso(record.updatedAt),
    updatedBy: clean(record.updatedBy) || fallback?.updatedBy || '',
  }
}

function sortPrintLayouts(layouts: AdminPrintLayout[]) {
  const typeOrder: Record<CardTypeKey, number> = { local: 1, import: 2 }

  return layouts.sort((a, b) =>
    typeOrder[a.type] - typeOrder[b.type]
    || Number(b.isBuiltin) - Number(a.isBuiltin)
    || a.name.localeCompare(b.name)
  )
}

function mergeDefaultAndStoredLayouts(records: PrintLayoutRecord[]) {
  const layoutsById = new Map<string, AdminPrintLayout>()

  for (const layout of DEFAULT_PRINT_LAYOUTS) {
    layoutsById.set(layout.id, { ...layout })
  }

  for (const record of records) {
    const layout = toPrintLayout(record)
    if (!layout) continue

    const fallback = layoutsById.get(layout.id)
    layoutsById.set(layout.id, {
      ...fallback,
      ...layout,
      isBuiltin: Boolean(fallback) || layout.isBuiltin,
    })
  }

  return sortPrintLayouts(Array.from(layoutsById.values()))
}

async function readPrintLayoutState(
  dependencies: Required<AdminPrintLayoutsServiceDependencies>,
  repairActiveConfig = true,
): Promise<AdminPrintLayoutState> {
  const layouts = mergeDefaultAndStoredLayouts(await dependencies.layoutRepository.listLayouts())
  const activeConfig = await dependencies.configRepository.getValues(Object.values(ACTIVE_PRINT_LAYOUT_CONFIG_KEYS))
  const active = { ...DEFAULT_ACTIVE_PRINT_LAYOUTS }
  const activeLayouts = {} as Record<CardTypeKey, AdminPrintLayout | null>
  const repairs: Record<string, string> = {}

  for (const type of PRINT_LAYOUT_TYPES) {
    const configKey = ACTIVE_PRINT_LAYOUT_CONFIG_KEYS[type]
    const configuredId = clean(activeConfig[configKey])
    if (configuredId) active[type] = configuredId

    let layout = layouts.find(item => item.id === active[type] && item.type === type) || null

    if (!layout) {
      active[type] = DEFAULT_ACTIVE_PRINT_LAYOUTS[type]
      layout = layouts.find(item => item.id === active[type] && item.type === type) || null
    }

    activeLayouts[type] = layout

    if (repairActiveConfig && activeConfig[configKey] !== active[type]) {
      repairs[configKey] = active[type]
    }
  }

  if (repairActiveConfig && Object.keys(repairs).length) {
    await dependencies.configRepository.setValues(repairs)
  }

  return { layouts, active, activeLayouts }
}

export async function listAdminPrintLayouts(
  event: H3Event,
  dependencies: AdminPrintLayoutsServiceDependencies = {},
): Promise<AdminPrintLayoutState> {
  const resolved = resolveDependencies(dependencies)
  const session = await resolved.requireAdminSession(event)
  assertPrintLayoutAccess(session)

  try {
    return await readPrintLayoutState(resolved)
  } catch (error) {
    throw toHttpError(error)
  }
}

export async function saveAdminPrintLayout(
  event: H3Event,
  body: unknown,
  dependencies: AdminPrintLayoutsServiceDependencies = {},
): Promise<AdminPrintLayoutState> {
  const resolved = resolveDependencies(dependencies)
  const session = await resolved.requireAdminSession(event)
  assertPrintLayoutAccess(session)

  try {
    const layout = normalizePrintLayoutInput(body)
    const id = layout.id || generatePrintLayoutId(layout.type)
    const defaultLayout = defaultLayoutById.get(id)

    if (defaultLayout && defaultLayout.type !== layout.type) {
      throw badRequest('Layout bawaan tidak cocok dengan jenis kartu')
    }

    const existing = layout.id ? await resolved.layoutRepository.findLayoutById(layout.id) : null
    const now = new Date().toISOString()

    await resolved.layoutRepository.upsertLayout({
      ...layout,
      id,
      isBuiltin: defaultLayout || parseBoolean(existing?.isBuiltin) ? 'TRUE' : 'FALSE',
      createdAtGas: existing?.createdAtGas || now,
      updatedAtGas: now,
      updatedBy: getSessionActor(session),
    })

    return {
      ...await readPrintLayoutState(resolved),
      savedLayoutId: id,
    }
  } catch (error) {
    throw toHttpError(error)
  }
}

export async function deleteAdminPrintLayout(
  event: H3Event,
  idOrBody: unknown,
  dependencies: AdminPrintLayoutsServiceDependencies = {},
): Promise<AdminPrintLayoutState> {
  const resolved = resolveDependencies(dependencies)
  const session = await resolved.requireAdminSession(event)
  assertPrintLayoutAccess(session)

  try {
    const id = normalizeDeleteLayoutInput(idOrBody)
    if (!id) throw badRequest('Layout wajib dipilih')

    const state = await readPrintLayoutState(resolved)
    const layout = state.layouts.find(item => item.id === id)

    if (!layout) throw notFound('Layout tidak ditemukan')
    if (layout.isBuiltin) throw badRequest('Layout bawaan tidak boleh dihapus')
    if (state.active[layout.type] === id) throw badRequest('Pilih layout aktif lain sebelum menghapus layout ini')

    await resolved.layoutRepository.deleteLayout(id)

    return await readPrintLayoutState(resolved)
  } catch (error) {
    throw toHttpError(error)
  }
}

export async function setActiveAdminPrintLayout(
  event: H3Event,
  body: unknown,
  dependencies: AdminPrintLayoutsServiceDependencies = {},
): Promise<AdminPrintLayoutState> {
  const resolved = resolveDependencies(dependencies)
  const session = await resolved.requireAdminSession(event)
  assertPrintLayoutAccess(session)

  try {
    const input = normalizeActiveLayoutInput(body)
    const state = await readPrintLayoutState(resolved)
    const layout = state.layouts.find(item => item.id === input.id && item.type === input.type)

    if (!layout) throw notFound('Layout tidak ditemukan untuk jenis kartu ini')

    await resolved.configRepository.setValue(ACTIVE_PRINT_LAYOUT_CONFIG_KEYS[input.type], input.id)

    return await readPrintLayoutState(resolved)
  } catch (error) {
    throw toHttpError(error)
  }
}
