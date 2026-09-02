import { asc, eq } from 'drizzle-orm'
import { db, type Database } from '../database'
import { printLayouts } from '../database/schema/print-layouts'

export type PrintLayoutRecord = typeof printLayouts.$inferSelect

export type UpsertPrintLayoutInput = {
  id: string
  type: string
  name: string
  offsetX: number
  offsetY: number
  gapProductModel: number
  gapModelSerial: number
  isBuiltin: string
  createdAtGas: string
  updatedAtGas: string
  updatedBy: string
}

export type PrintLayoutsRepository = {
  listLayouts: () => Promise<PrintLayoutRecord[]>
  findLayoutById: (id: string) => Promise<PrintLayoutRecord | null>
  upsertLayout: (input: UpsertPrintLayoutInput) => Promise<PrintLayoutRecord>
  deleteLayout: (id: string) => Promise<void>
}

export function createPrintLayoutsRepository(database: Database = db): PrintLayoutsRepository {
  async function listLayouts(): Promise<PrintLayoutRecord[]> {
    return await database
      .select()
      .from(printLayouts)
      .orderBy(asc(printLayouts.type), asc(printLayouts.isBuiltin), asc(printLayouts.name))
  }

  async function findLayoutById(id: string): Promise<PrintLayoutRecord | null> {
    const rows = await database
      .select()
      .from(printLayouts)
      .where(eq(printLayouts.id, id))
      .limit(1)

    return rows[0] || null
  }

  async function upsertLayout(input: UpsertPrintLayoutInput): Promise<PrintLayoutRecord> {
    const existing = await findLayoutById(input.id)

    await database
      .insert(printLayouts)
      .values({
        id: input.id,
        type: input.type,
        name: input.name,
        offsetX: input.offsetX,
        offsetY: input.offsetY,
        gapProductModel: input.gapProductModel,
        gapModelSerial: input.gapModelSerial,
        isBuiltin: input.isBuiltin,
        createdAtGas: existing?.createdAtGas || input.createdAtGas,
        updatedAtGas: input.updatedAtGas,
        updatedBy: input.updatedBy,
      })
      .onConflictDoUpdate({
        target: printLayouts.id,
        set: {
          type: input.type,
          name: input.name,
          offsetX: input.offsetX,
          offsetY: input.offsetY,
          gapProductModel: input.gapProductModel,
          gapModelSerial: input.gapModelSerial,
          isBuiltin: input.isBuiltin,
          createdAtGas: existing?.createdAtGas || input.createdAtGas,
          updatedAtGas: input.updatedAtGas,
          updatedBy: input.updatedBy,
          updatedAt: new Date(),
        },
      })

    const saved = await findLayoutById(input.id)
    if (!saved) throw new Error('Layout gagal disimpan.')

    return saved
  }

  async function deleteLayout(id: string): Promise<void> {
    await database
      .delete(printLayouts)
      .where(eq(printLayouts.id, id))
  }

  return {
    listLayouts,
    findLayoutById,
    upsertLayout,
    deleteLayout,
  }
}

export const printLayoutsRepository = createPrintLayoutsRepository()
