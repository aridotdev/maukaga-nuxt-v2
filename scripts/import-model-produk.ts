import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { db } from '../server/database'
import {
  insertModelProdukAuditLog,
  insertModelProdukRecord,
  listModelProdukRecords,
} from '../server/repositories/model-produk-repository'
import type { ModelProdukOrigin } from '../server/services/model-produk-service'

type ImportRow = {
  line: number
  model: string
  produk: string
  origin: ModelProdukOrigin
}

type InvalidRow = {
  line: number
  message: string
}

type ImportPlan = {
  rows: ImportRow[]
  invalidRows: InvalidRow[]
  duplicateRows: InvalidRow[]
  existingRows: InvalidRow[]
}

const REQUIRED_HEADERS = ['model', 'produk', 'origin'] as const

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const fileArgument = args.find(arg => !arg.startsWith('--'))

try {
  if (!fileArgument) {
    throw new Error('Gunakan: npm run db:import-model-produk -- <file.csv> [--apply]')
  }

  const filePath = resolve(fileArgument)
  const input = readFileSync(filePath, 'utf8')
  const plan = await createImportPlan(input)

  printPlan(filePath, plan, apply)

  if (plan.invalidRows.length) {
    throw new Error('Import dibatalkan karena terdapat data yang tidak valid.')
  }

  if (!apply) {
    console.log('Mode preview: tidak ada perubahan yang disimpan.')
  } else {
    const importedCount = await applyImport(plan.rows, filePath)
    console.log(`Import selesai: ${importedCount} model produk ditambahkan.`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  db.$client.close()
}

async function createImportPlan(input: string): Promise<ImportPlan> {
  const records = parseCsv(input)
  if (!records.length) throw new Error('File CSV kosong.')

  const headers = records[0].map((header, index) =>
    header.trim().replace(/^\uFEFF/, '').toLowerCase() || `column-${index + 1}`,
  )

  validateHeaders(headers)

  const invalidRows: InvalidRow[] = []
  const duplicateRows: InvalidRow[] = []
  const rows: ImportRow[] = []
  const seenModels = new Set<string>()

  for (const [index, record] of records.slice(1).entries()) {
    const line = index + 2
    if (record.every(value => !value.trim())) continue

    if (record.length > headers.length) {
      invalidRows.push({
        line,
        message: `jumlah kolom harus ${headers.length}`,
      })
      continue
    }

    const values = Object.fromEntries(
      headers.map((header, columnIndex) => [header, record[columnIndex]?.trim() ?? '']),
    )
    const model = normalizeModel(values.model)
    const produk = normalizeText(values.produk)

    if (!model) {
      invalidRows.push({ line, message: 'model wajib diisi' })
      continue
    }

    if (!produk) {
      invalidRows.push({ line, message: 'produk wajib diisi' })
      continue
    }

    const origin = normalizeOrigin(values.origin)
    if (!origin) {
      invalidRows.push({
        line,
        message: `origin harus local, import, atau kosong; nilai diterima: "${values.origin}"`,
      })
      continue
    }

    if (seenModels.has(model)) {
      duplicateRows.push({ line, message: `model "${model}" duplikat di file` })
      continue
    }

    seenModels.add(model)
    rows.push({ line, model, produk, origin })
  }

  const existingModels = new Set(
    (await listModelProdukRecords(db)).map(record => normalizeModel(record.model)),
  )
  const existingRows: InvalidRow[] = []
  const newRows = rows.filter((row) => {
    if (!existingModels.has(row.model)) return true
    existingRows.push({
      line: row.line,
      message: `model "${row.model}" sudah ada dan dilewati`,
    })
    return false
  })

  return {
    rows: newRows,
    invalidRows,
    duplicateRows,
    existingRows,
  }
}

async function applyImport(rows: ImportRow[], filePath: string): Promise<number> {
  if (!rows.length) return 0

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const created = await insertModelProdukRecord(tx, {
        id: randomUUID(),
        model: row.model,
        produk: row.produk,
        origin: row.origin,
        status: 'verified',
        createdBy: null,
        updatedBy: null,
      })

      await insertModelProdukAuditLog(tx, {
        actorId: null,
        action: 'model-produk.import',
        entityType: 'model_produk',
        entityId: created.id,
        metadataJson: JSON.stringify({
          model: created.model,
          produk: created.produk,
          origin: created.origin,
          sourceFile: filePath,
          sourceLine: row.line,
        }),
      })
    }
  })

  return rows.length
}

function validateHeaders(headers: string[]) {
  if (
    headers.length !== REQUIRED_HEADERS.length
    || REQUIRED_HEADERS.some(header => !headers.includes(header))
  ) {
    throw new Error(
      `Header CSV harus tepat: ${REQUIRED_HEADERS.join(',')}`,
    )
  }
}

function parseCsv(input: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    const nextCharacter = input[index + 1]

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"'
      index += 1
      continue
    }

    if (character === '"') {
      quoted = !quoted
      continue
    }

    if (character === ',' && !quoted) {
      record.push(value)
      value = ''
      continue
    }

    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1
      record.push(value)
      records.push(record)
      record = []
      value = ''
      continue
    }

    value += character
  }

  if (quoted) throw new Error('CSV memiliki tanda kutip yang tidak berpasangan.')

  if (value || record.length) {
    record.push(value)
    records.push(record)
  }

  return records
}

function normalizeModel(value: string) {
  return normalizeText(value).toUpperCase()
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeOrigin(value: string): ModelProdukOrigin | null {
  const origin = normalizeText(value).toLowerCase()
  if (!origin || origin === 'unset' || origin === 'belum dipilih') return 'unset'
  if (origin === 'local') return 'local'
  if (origin === 'import') return 'import'
  return null
}

function printPlan(filePath: string, plan: ImportPlan, apply: boolean) {
  console.log(`${apply ? 'Import' : 'Preview'} file: ${filePath}`)
  console.log(`Akan ditambahkan: ${plan.rows.length}`)
  console.log(`Model sudah ada: ${plan.existingRows.length}`)
  console.log(`Duplikat di file: ${plan.duplicateRows.length}`)
  console.log(`Data tidak valid: ${plan.invalidRows.length}`)

  for (const row of [...plan.invalidRows, ...plan.duplicateRows, ...plan.existingRows]) {
    console.log(`- Baris ${row.line}: ${row.message}`)
  }
}
