import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../server/database'
import {
  auditLog,
  dailySequence,
  modelProduk,
  pengajuan,
  pengajuanItems,
  statusLog,
} from '../server/database/schema'
import {
  getSubmissionDate,
  normalizeBusinessKey,
  parseLegacyItemCsv,
  parseLegacyPengajuanCsv,
  type CsvIssue,
  type LegacyItemRow,
  type LegacyPengajuanRow,
} from './import-pengajuan-legacy-lib'

interface ModelRecord {
  id: string
  model: string
  produk: string
  origin: 'local' | 'import' | 'unset'
  status: 'verified' | 'needs_review'
}

interface ImportPlan {
  pengajuanRows: LegacyPengajuanRow[]
  itemRows: LegacyItemRow[]
  modelByKey: Map<string, ModelRecord>
  issues: CsvIssue[]
}

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const fileArguments = args.filter(argument => !argument.startsWith('--'))

try {
  if (fileArguments.length !== 2) {
    throw new Error('Gunakan: pnpm db:import-pengajuan -- <pengajuan.csv> <item.csv> [--apply]')
  }

  const [pengajuanArgument, itemArgument] = fileArguments as [string, string]
  const pengajuanPath = resolve(pengajuanArgument)
  const itemPath = resolve(itemArgument)
  const plan = await createImportPlan(
    readFileSync(pengajuanPath, 'utf8'),
    readFileSync(itemPath, 'utf8'),
  )

  printPlan(pengajuanPath, itemPath, plan, apply)

  if (plan.issues.length) {
    throw new Error('Import dibatalkan karena terdapat data yang tidak valid atau konflik.')
  }

  if (!apply) {
    console.log('Mode preview: tidak ada perubahan yang disimpan.')
  } else {
    await applyImport(plan, pengajuanPath, itemPath)
    console.log(`Import selesai: ${plan.pengajuanRows.length} pengajuan dan ${plan.itemRows.length} item ditambahkan.`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  db.$client.close()
}

async function createImportPlan(pengajuanInput: string, itemInput: string): Promise<ImportPlan> {
  const parsedPengajuan = parseLegacyPengajuanCsv(pengajuanInput)
  const parsedItems = parseLegacyItemCsv(itemInput)
  const issues = [...parsedPengajuan.issues, ...parsedItems.issues]

  const pengajuanIds = new Set<string>()
  for (const row of parsedPengajuan.data) {
    if (pengajuanIds.has(row.idPengajuan)) {
      issues.push({ file: 'pengajuan', line: row.line, message: `id_pengajuan ${row.idPengajuan} duplikat di CSV` })
    }
    pengajuanIds.add(row.idPengajuan)
  }

  const itemKeys = new Set<string>()
  const serialKeys = new Set<string>()
  for (const row of parsedItems.data) {
    if (!pengajuanIds.has(row.idPengajuan)) {
      issues.push({ file: 'item', line: row.line, message: `id_pengajuan ${row.idPengajuan} tidak ditemukan di CSV pengajuan` })
    }

    const itemKey = `${row.idPengajuan}\u0000${row.noItem}`
    if (itemKeys.has(itemKey)) {
      issues.push({ file: 'item', line: row.line, message: `no_item ${row.noItem} duplikat untuk ${row.idPengajuan}` })
    }
    itemKeys.add(itemKey)

    const serialKey = `${normalizeBusinessKey(row.model)}\u0000${normalizeBusinessKey(row.nomorSeri)}`
    if (serialKeys.has(serialKey)) {
      issues.push({ file: 'item', line: row.line, message: `kombinasi model dan nomor_seri duplikat di CSV` })
    }
    serialKeys.add(serialKey)
  }

  for (const idPengajuan of pengajuanIds) {
    if (!parsedItems.data.some(item => item.idPengajuan === idPengajuan)) {
      const row = parsedPengajuan.data.find(candidate => candidate.idPengajuan === idPengajuan)!
      issues.push({ file: 'pengajuan', line: row.line, message: `${idPengajuan} tidak memiliki item` })
    }
  }

  const models = await db.select({
    id: modelProduk.id,
    model: modelProduk.model,
    produk: modelProduk.produk,
    origin: modelProduk.origin,
    status: modelProduk.status,
  }).from(modelProduk)
  const modelByKey = new Map<string, ModelRecord>()
  const ambiguousModelKeys = new Set<string>()
  for (const model of models) {
    const key = normalizeBusinessKey(model.model)
    if (modelByKey.has(key)) ambiguousModelKeys.add(key)
    modelByKey.set(key, model)
  }

  for (const row of parsedItems.data) {
    const master = modelByKey.get(normalizeBusinessKey(row.model))
    if (!master) {
      issues.push({ file: 'item', line: row.line, message: `model ${row.model} tidak ditemukan di master model produk` })
      continue
    }
    if (ambiguousModelKeys.has(normalizeBusinessKey(row.model))) {
      issues.push({ file: 'item', line: row.line, message: `model ${row.model} ambigu karena memiliki lebih dari satu master setelah normalisasi` })
    }
    if (master.status !== 'verified') {
      issues.push({ file: 'item', line: row.line, message: `model ${row.model} belum berstatus verified` })
    }
    if (normalizeBusinessKey(master.produk) !== normalizeBusinessKey(row.produk)) {
      issues.push({ file: 'item', line: row.line, message: `produk ${row.produk} tidak sama dengan master (${master.produk}) untuk model ${row.model}` })
    }
    const expectedOrigin = row.jenisKartu === 'Local' ? 'local' : 'import'
    if (master.origin !== expectedOrigin) {
      issues.push({ file: 'item', line: row.line, message: `jenis_kartu ${row.jenisKartu} tidak sama dengan origin master (${master.origin}) untuk model ${row.model}` })
    }
  }

  validateHistoricalStatuses(parsedPengajuan.data, parsedItems.data, issues)

  if (pengajuanIds.size) {
    const existingPengajuan = await db
      .select({ idPengajuan: pengajuan.idPengajuan })
      .from(pengajuan)
      .where(inArray(pengajuan.idPengajuan, [...pengajuanIds]))
    for (const record of existingPengajuan) {
      const row = parsedPengajuan.data.find(candidate => candidate.idPengajuan === record.idPengajuan)!
      issues.push({ file: 'pengajuan', line: row.line, message: `${record.idPengajuan} sudah ada di database` })
    }
  }

  for (const row of parsedItems.data) {
    const [existingItem] = await db
      .select({ id: pengajuanItems.id })
      .from(pengajuanItems)
      .where(and(
        eq(pengajuanItems.modelNormalized, normalizeBusinessKey(row.model)),
        eq(pengajuanItems.nomorSeriNormalized, normalizeBusinessKey(row.nomorSeri)),
      ))
      .limit(1)
    if (existingItem) {
      issues.push({ file: 'item', line: row.line, message: `kombinasi model ${row.model} dan nomor_seri ${row.nomorSeri} sudah ada di database` })
    }
  }

  return {
    pengajuanRows: parsedPengajuan.data,
    itemRows: parsedItems.data,
    modelByKey,
    issues,
  }
}

async function applyImport(plan: ImportPlan, pengajuanPath: string, itemPath: string) {
  await db.transaction(async (tx) => {
    for (const row of plan.pengajuanRows) {
      const submittedAt = getSubmissionDate(row.idPengajuan)
      const [created] = await tx.insert(pengajuan).values({
        idPengajuan: row.idPengajuan,
        nama: row.nama,
        bagian: row.bagian,
        cabang: row.cabang,
        pemilik: row.pemilik,
        alasanPengajuan: row.alasanPengajuan,
        tanggalForm: row.tanggalForm,
        status: row.status,
        submittedAt,
        createdAt: submittedAt,
        updatedAt: submittedAt,
      }).returning({ id: pengajuan.id })

      if (!created) throw new Error(`Gagal membuat pengajuan ${row.idPengajuan}`)

      const itemRows = plan.itemRows.filter(item => item.idPengajuan === row.idPengajuan)
      const createdItems = await tx.insert(pengajuanItems).values(itemRows.map((item) => {
        const master = plan.modelByKey.get(normalizeBusinessKey(item.model))!
        return {
          pengajuanId: created.id,
          noItem: item.noItem,
          modelProdukId: master.id,
          produk: master.produk,
          model: master.model,
          modelNormalized: normalizeBusinessKey(master.model),
          nomorSeri: item.nomorSeri,
          nomorSeriNormalized: normalizeBusinessKey(item.nomorSeri),
          keputusanItem: item.keputusanItem,
          jenisKartu: item.jenisKartu,
          statusCetak: item.statusCetak,
          statusKirim: item.statusKirim,
          createdAt: submittedAt,
          updatedAt: submittedAt,
        }
      })).returning({ id: pengajuanItems.id, keputusanItem: pengajuanItems.keputusanItem })

      await tx.insert(statusLog).values(createdItems.map((item) => ({
        pengajuanId: created.id,
        itemId: item.id,
        scope: 'item' as const,
        statusLama: null,
        statusBaru: item.keputusanItem,
        catatan: 'Status item historis diimpor dari CSV.',
        actorId: null,
        dedupeKey: `legacy-import:${row.idPengajuan}:item:${item.id}`,
        createdAt: submittedAt,
      })))

      await tx.insert(statusLog).values({
        pengajuanId: created.id,
        scope: 'pengajuan',
        statusLama: null,
        statusBaru: row.status,
        catatan: 'Data historis diimpor dari CSV.',
        actorId: null,
        dedupeKey: `legacy-import:${row.idPengajuan}`,
        createdAt: submittedAt,
      })
      await tx.insert(auditLog).values({
        actorId: null,
        action: 'pengajuan.legacy-import',
        entityType: 'pengajuan',
        entityId: row.idPengajuan,
        metadataJson: JSON.stringify({
          itemCount: itemRows.length,
          pengajuanSource: pengajuanPath,
          itemSource: itemPath,
        }),
        createdAt: submittedAt,
      })
    }

    for (const [sequenceDate, currentValue] of getMaximumSequences(plan.pengajuanRows)) {
      await tx.insert(dailySequence).values({ sequenceDate, currentValue })
        .onConflictDoUpdate({
          target: dailySequence.sequenceDate,
          set: {
            currentValue: sql`max(${dailySequence.currentValue}, ${currentValue})`,
            updatedAt: new Date(),
          },
        })
    }
  })
}

function validateHistoricalStatuses(
  pengajuanRows: LegacyPengajuanRow[],
  itemRows: LegacyItemRow[],
  issues: CsvIssue[],
) {
  for (const item of itemRows) {
    if (item.statusKirim === 'Dikirim' && item.statusCetak !== 'Dicetak') {
      issues.push({ file: 'item', line: item.line, message: 'item Dikirim harus berstatus Dicetak' })
    }
    if ((item.statusCetak === 'Dicetak' || item.statusKirim === 'Dikirim') && item.keputusanItem !== 'Disetujui') {
      issues.push({ file: 'item', line: item.line, message: 'item tercetak atau terkirim harus berkeputusan Disetujui' })
    }
  }

  for (const row of pengajuanRows) {
    const items = itemRows.filter(item => item.idPengajuan === row.idPengajuan)
    if (!items.length) continue

    const aggregateStatus = resolveAggregateStatus(items)
    const valid = row.status === aggregateStatus || (row.status === 'Selesai' && aggregateStatus === 'Dikirim')
    if (!valid) {
      issues.push({
        file: 'pengajuan',
        line: row.line,
        message: `status ${row.status} tidak konsisten dengan status item (seharusnya ${aggregateStatus}${aggregateStatus === 'Dikirim' ? ' atau Selesai' : ''})`,
      })
    }
  }
}

function resolveAggregateStatus(items: LegacyItemRow[]): LegacyPengajuanRow['status'] {
  const approvedItems = items.filter(item => item.keputusanItem === 'Disetujui')
  const rejectedItems = items.filter(item => item.keputusanItem === 'Ditolak')
  if (rejectedItems.length === items.length) return 'Ditolak'
  if (approvedItems.length && approvedItems.every(item => item.statusKirim === 'Dikirim')) return 'Dikirim'
  if (approvedItems.length && approvedItems.every(item => item.statusCetak === 'Dicetak')) return 'Diprint'
  if (approvedItems.length) return 'Disetujui'
  return 'Baru'
}

function getMaximumSequences(rows: LegacyPengajuanRow[]) {
  const values = new Map<string, number>()
  for (const row of rows) {
    const compactDate = row.idPengajuan.slice(3, 11)
    const sequenceDate = `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`
    const sequence = Number(row.idPengajuan.slice(12))
    values.set(sequenceDate, Math.max(values.get(sequenceDate) ?? 0, sequence))
  }
  return values
}

function printPlan(
  pengajuanPath: string,
  itemPath: string,
  plan: ImportPlan,
  shouldApply: boolean,
) {
  console.log(`${shouldApply ? 'Import' : 'Preview'} data pengajuan lama`)
  console.log(`File pengajuan: ${pengajuanPath}`)
  console.log(`File item: ${itemPath}`)
  console.log(`Pengajuan terbaca: ${plan.pengajuanRows.length}`)
  console.log(`Item terbaca: ${plan.itemRows.length}`)
  console.log(`Masalah ditemukan: ${plan.issues.length}`)
  for (const entry of plan.issues) {
    console.log(`- ${entry.file}, baris ${entry.line}: ${entry.message}`)
  }
}
