import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import * as z from 'zod'
import { type MaukagaDatabase, useDb } from '../database'
import {
  PRINT_LAYOUT_TYPES,
  type PrintLayout,
} from '../database/schema'
import {
  findConfigRecord,
  upsertConfigRecord,
} from '../repositories/config-repository'
import {
  deletePrintLayoutRecord,
  findPrintLayoutRecord,
  insertPrintLayoutAuditLog,
  insertPrintLayoutRecord,
  listPrintLayoutRecords,
  updatePrintLayoutRecord,
  type PrintLayoutDatabase,
} from '../repositories/print-layout-repository'

export type PrintLayoutType = 'local' | 'import'

export type PrintLayoutDto = {
  id: string
  type: PrintLayoutType
  name: string
  offsetX: number
  offsetY: number
  gapProductModel: number
  gapModelSerial: number
  isBuiltin: boolean
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
}

export type PrintLayoutState = {
  layouts: PrintLayoutDto[]
  active: Record<PrintLayoutType, string>
  activeLayouts: Record<PrintLayoutType, PrintLayoutDto | null>
  savedLayoutId?: string
}

export interface PrintLayoutServiceOptions {
  database?: MaukagaDatabase
  actorId: string
}

export const printLayoutTypeSchema = z.enum(['local', 'import'])

export const printLayoutInputSchema = z.object({
  id: z.string().trim().optional(),
  type: printLayoutTypeSchema,
  name: z.string().trim().min(1, 'Nama layout wajib diisi').max(120, 'Nama layout terlalu panjang'),
  offsetX: z.coerce.number().finite().min(-1000).max(1000),
  offsetY: z.coerce.number().finite().min(-1000).max(1000),
  gapProductModel: z.coerce.number().finite().min(-1000).max(1000),
  gapModelSerial: z.coerce.number().finite().min(-1000).max(1000),
})

export const setActivePrintLayoutInputSchema = z.object({
  type: printLayoutTypeSchema,
  id: z.string().trim().min(1, 'Layout wajib dipilih'),
})

const DEFAULT_PRINT_LAYOUTS = [{
  id: 'local-default',
  type: 'local',
  name: 'Local Default',
  offsetX: 0,
  offsetY: 0,
  gapProductModel: 0,
  gapModelSerial: 0,
  isBuiltin: true,
}, {
  id: 'import-default',
  type: 'import',
  name: 'Import Default',
  offsetX: 0,
  offsetY: 0,
  gapProductModel: 0,
  gapModelSerial: 0,
  isBuiltin: true,
}] satisfies Array<Omit<PrintLayoutDto, 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>>

const DEFAULT_ACTIVE_LAYOUTS = {
  local: 'local-default',
  import: 'import-default',
} satisfies Record<PrintLayoutType, string>

const ACTIVE_LAYOUT_CONFIG_KEYS = {
  local: 'ACTIVE_PRINT_LAYOUT_LOCAL',
  import: 'ACTIVE_PRINT_LAYOUT_IMPORT',
} satisfies Record<PrintLayoutType, string>

export async function listPrintLayouts(
  database: PrintLayoutDatabase = useDb(),
): Promise<PrintLayoutState> {
  await ensureBuiltinPrintLayouts(database)
  return readPrintLayoutState(database)
}

export async function savePrintLayout(
  input: unknown,
  options: PrintLayoutServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = normalizePrintLayoutInput(input)

  const result = await database.transaction(async (tx) => {
    await ensureBuiltinPrintLayouts(tx)

    const id = data.id || generatePrintLayoutId(data.type)
    const existing = data.id ? await findPrintLayoutRecord(tx, data.id) : null
    if (existing && getPrintLayoutTypeKey(existing.type) !== data.type) {
      throw badRequest('Layout tidak cocok dengan jenis kartu')
    }

    const isBuiltin = existing?.isBuiltin || isDefaultPrintLayoutId(id)
    const saved = existing
      ? await updatePrintLayoutRecord(tx, id, {
          type: getPrintLayoutDatabaseType(data.type),
          name: data.name,
          offsetX: data.offsetX,
          offsetY: data.offsetY,
          gapProductModel: data.gapProductModel,
          gapModelSerial: data.gapModelSerial,
          isBuiltin,
          updatedBy: options.actorId,
        })
      : await insertPrintLayoutRecord(tx, {
          id,
          type: getPrintLayoutDatabaseType(data.type),
          name: data.name,
          offsetX: data.offsetX,
          offsetY: data.offsetY,
          gapProductModel: data.gapProductModel,
          gapModelSerial: data.gapModelSerial,
          isBuiltin,
          createdBy: options.actorId,
          updatedBy: options.actorId,
        })

    if (!saved) throw notFound(`Layout ${id} tidak ditemukan`)

    await insertPrintLayoutAuditLog(tx, {
      actorId: options.actorId,
      action: existing ? 'print-layout.update' : 'print-layout.create',
      entityType: 'print_layout',
      entityId: saved.id,
      metadataJson: JSON.stringify({
        type: data.type,
        name: data.name,
        offsetX: data.offsetX,
        offsetY: data.offsetY,
        gapProductModel: data.gapProductModel,
        gapModelSerial: data.gapModelSerial,
      }),
    })

    return {
      ...await readPrintLayoutState(tx),
      savedLayoutId: saved.id,
    }
  })

  return result
}

export async function setActivePrintLayout(
  input: unknown,
  options: PrintLayoutServiceOptions,
) {
  const database = options.database ?? useDb()
  const data = setActivePrintLayoutInputSchema.parse(input)

  return database.transaction(async (tx) => {
    await ensureBuiltinPrintLayouts(tx)
    const layout = await findPrintLayoutRecord(tx, data.id)

    if (!layout || getPrintLayoutTypeKey(layout.type) !== data.type) {
      throw notFound('Layout tidak ditemukan untuk jenis kartu ini')
    }

    await upsertConfigRecord(tx, {
      key: ACTIVE_LAYOUT_CONFIG_KEYS[data.type],
      value: data.id,
    })
    await insertPrintLayoutAuditLog(tx, {
      actorId: options.actorId,
      action: 'print-layout.activate',
      entityType: 'print_layout',
      entityId: data.id,
      metadataJson: JSON.stringify({ type: data.type }),
    })

    return readPrintLayoutState(tx)
  })
}

export async function deletePrintLayout(
  id: string,
  options: PrintLayoutServiceOptions,
) {
  const database = options.database ?? useDb()
  const normalizedId = id.trim()
  if (!normalizedId) throw badRequest('Layout wajib dipilih')

  return database.transaction(async (tx) => {
    await ensureBuiltinPrintLayouts(tx)
    const state = await readPrintLayoutState(tx)
    const layout = state.layouts.find(item => item.id === normalizedId)

    if (!layout) throw notFound('Layout tidak ditemukan')
    if (layout.isBuiltin) throw badRequest('Layout bawaan tidak boleh dihapus')
    if (state.active[layout.type] === layout.id) {
      throw badRequest('Pilih layout aktif lain sebelum menghapus layout ini')
    }

    await deletePrintLayoutRecord(tx, normalizedId)
    await insertPrintLayoutAuditLog(tx, {
      actorId: options.actorId,
      action: 'print-layout.delete',
      entityType: 'print_layout',
      entityId: normalizedId,
      metadataJson: JSON.stringify({
        type: layout.type,
        name: layout.name,
      }),
    })

    return readPrintLayoutState(tx)
  })
}

export async function getActivePrintLayout(
  type: PrintLayoutType,
  database: PrintLayoutDatabase = useDb(),
) {
  const state = await listPrintLayouts(database)
  return state.activeLayouts[type]
}

export function getPrintLayoutTypeKey(value: PrintLayout['type']): PrintLayoutType {
  return value === 'Local' ? 'local' : 'import'
}

export function getPrintLayoutDatabaseType(value: PrintLayoutType): PrintLayout['type'] {
  return value === 'local' ? 'Local' : 'Import'
}

export function getPrintLayoutConfigKey(type: PrintLayoutType) {
  return ACTIVE_LAYOUT_CONFIG_KEYS[type]
}

function normalizePrintLayoutInput(input: unknown) {
  const outer = asRecord(input)
  const rawLayout = asRecord(outer.layout || outer)
  const parsed = printLayoutInputSchema.parse({
    id: rawLayout.id || undefined,
    type: rawLayout.type,
    name: rawLayout.name,
    offsetX: rawLayout.offsetX ?? 0,
    offsetY: rawLayout.offsetY ?? 0,
    gapProductModel: rawLayout.gapProductModel ?? 0,
    gapModelSerial: rawLayout.gapModelSerial ?? 0,
  })

  return {
    ...parsed,
    id: parsed.id || '',
    name: normalizeText(parsed.name),
  }
}

async function readPrintLayoutState(database: PrintLayoutDatabase): Promise<PrintLayoutState> {
  const records = await listPrintLayoutRecords(database)
  const layouts = records.map(mapPrintLayout)
  const active = { ...DEFAULT_ACTIVE_LAYOUTS }
  const activeLayouts = {} as Record<PrintLayoutType, PrintLayoutDto | null>
  const repairs: Array<{ key: string; value: string }> = []

  for (const type of PRINT_LAYOUT_TYPES.map(getPrintLayoutTypeKey)) {
    const config = await findConfigRecord(database, ACTIVE_LAYOUT_CONFIG_KEYS[type])
    const configuredId = config?.value?.trim() || ''
    if (configuredId) active[type] = configuredId

    let layout = layouts.find(item => item.id === active[type] && item.type === type) || null
    if (!layout) {
      active[type] = DEFAULT_ACTIVE_LAYOUTS[type]
      layout = layouts.find(item => item.id === active[type] && item.type === type) || null
    }

    activeLayouts[type] = layout
    if (config?.value !== active[type]) {
      repairs.push({
        key: ACTIVE_LAYOUT_CONFIG_KEYS[type],
        value: active[type],
      })
    }
  }

  for (const repair of repairs) {
    await upsertConfigRecord(database, repair)
  }

  return {
    layouts: sortPrintLayouts(layouts),
    active,
    activeLayouts,
  }
}

async function ensureBuiltinPrintLayouts(database: PrintLayoutDatabase) {
  for (const layout of DEFAULT_PRINT_LAYOUTS) {
    const existing = await findPrintLayoutRecord(database, layout.id)
    if (existing) continue

    await insertPrintLayoutRecord(database, {
      id: layout.id,
      type: getPrintLayoutDatabaseType(layout.type),
      name: layout.name,
      offsetX: layout.offsetX,
      offsetY: layout.offsetY,
      gapProductModel: layout.gapProductModel,
      gapModelSerial: layout.gapModelSerial,
      isBuiltin: true,
      createdBy: null,
      updatedBy: null,
    })
  }
}

function mapPrintLayout(record: PrintLayout): PrintLayoutDto {
  return {
    id: record.id,
    type: getPrintLayoutTypeKey(record.type),
    name: record.name,
    offsetX: record.offsetX,
    offsetY: record.offsetY,
    gapProductModel: record.gapProductModel,
    gapModelSerial: record.gapModelSerial,
    isBuiltin: record.isBuiltin,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    createdBy: record.createdBy ?? undefined,
    updatedBy: record.updatedBy ?? undefined,
  }
}

function sortPrintLayouts(layouts: PrintLayoutDto[]) {
  return layouts.toSorted((a, b) =>
    Number(b.isBuiltin) - Number(a.isBuiltin)
    || a.type.localeCompare(b.type)
    || a.name.localeCompare(b.name),
  )
}

function generatePrintLayoutId(type: PrintLayoutType) {
  return `${type}-${randomUUID().slice(0, 8).toLowerCase()}`
}

function isDefaultPrintLayoutId(id: string) {
  return DEFAULT_PRINT_LAYOUTS.some(layout => layout.id === id)
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
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
