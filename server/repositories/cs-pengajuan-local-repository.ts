import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { asc, eq, like, ne } from 'drizzle-orm'
import { z } from 'zod'
import { buildArchiveFileName } from '../schemas/gas-archive'
import { db, type Database } from '../database'
import { resolveArchiveLocalPath } from '../utils/local-archive'
import { archiveFiles, modelProduk, pengajuan, pengajuanItems, statusLog } from '../database/schema'

export const DRAFT_STATUS = 'Menunggu Upload'
const DEFAULT_MAX_ITEMS = 10
const DEFAULT_MAX_UPLOAD_MB = 10
const DEFAULT_MAX_EVIDENCE_FILES = 10
const DEFAULT_MAX_EVIDENCE_FILE_MB = 5
const FINAL_STATUS = 'Baru'
const FINAL_SUBMIT_LOG_NOTE = 'Final submit hard copy signed'

const saveDraftItemSchema = z.object({
  produk: z.string().trim().min(1, 'Produk wajib diisi'),
  model: z.string().trim().min(1, 'Model wajib diisi'),
  nomorSeri: z.string().trim().min(1, 'Nomor seri wajib diisi'),
})

const saveDraftPengajuanSchema = z.object({
  idPengajuan: z.string().trim().optional(),
  resumeToken: z.string().trim().optional(),
  nama: z.string().trim().min(1, 'Field wajib belum lengkap: nama'),
  bagianCabang: z.string().trim().min(1, 'Field wajib belum lengkap: bagianCabang'),
  pemilik: z.string().trim().min(1, 'Field wajib belum lengkap: pemilik'),
  tanggalForm: z.string().trim().min(1, 'Field wajib belum lengkap: tanggalForm'),
  alasanPengajuan: z.string().trim().min(1, 'Field wajib belum lengkap: alasanPengajuan'),
  catatanTambahan: z.string().trim().optional().default(''),
  items: z.array(saveDraftItemSchema).min(1, 'Minimal 1 item produk wajib diisi'),
})

const evidenceAttachmentSchema = z.object({
  fileName: z.string().trim().min(1, 'Nama lampiran foto bukti wajib diisi'),
  fileBase64: z.string().trim().min(1, 'Lampiran foto bukti belum lengkap'),
  fileExtension: z.string().trim().min(1, 'Format lampiran foto bukti wajib diisi'),
  fileMimeType: z.string().trim().min(1, 'MIME type lampiran foto bukti wajib diisi'),
})

const submitDraftPengajuanSchema = saveDraftPengajuanSchema.extend({
  idPengajuan: z.string().trim().min(1, 'Buka draft dari Draft Terakhir atau Link Lanjutkan Draft'),
  resumeToken: z.string().trim().min(1, 'Buka draft dari Draft Terakhir atau Link Lanjutkan Draft'),
  fileBase64: z.string().trim().min(1, 'File hard copy wajib dilampirkan'),
  fileExtension: z.string().trim().min(1, 'Format file wajib diisi'),
  fileMimeType: z.string().trim().min(1, 'MIME type file wajib diisi'),
  evidenceAttachments: z.array(evidenceAttachmentSchema).default([]),
})

export type CsLocalApiResult<T> = {
  success: boolean
  data?: T
  error?: string
}

export type ModelProdukResponse = {
  rows: Array<{
    model: string
    produk: string
    origin: string
    status: string
    updatedAt: string
  }>
}

export type SaveDraftPengajuanResponse = {
  idPengajuan: string
  resumeToken: string
  status: typeof DRAFT_STATUS
}

export type LocalDraftData = {
  idPengajuan: string
  status: string
  resumeToken: string
  nama: string
  bagianCabang: string
  pemilik: string
  alasanPengajuan: string
  tanggalForm: string
  catatanTambahan: string
  items: Array<{
    produk: string
    model: string
    nomorSeri: string
  }>
}

export type LocalDraftStatusResponse = {
  idPengajuan: string
  status: string
  resumeToken: string
}

export type LocalDraftLoadResponse = LocalDraftData

export type LocalSubmitDraftResponse = {
  idPengajuan: string
}

type SaveDraftOptions = {
  maxItems?: number
  now?: Date
  tokenFactory?: () => string
}

export type SaveDraftInput = z.input<typeof saveDraftPengajuanSchema>
export type SubmitDraftInput = z.input<typeof submitDraftPengajuanSchema>
type SaveDraftPayload = z.output<typeof saveDraftPengajuanSchema>
type SubmitDraftPayload = z.output<typeof submitDraftPengajuanSchema>
type SubmitDraftOptions = SaveDraftOptions & {
  maxUploadMb?: number
  maxEvidenceFiles?: number
  maxEvidenceFileMb?: number
  archiveDir?: string
  archivePublicBasePath?: string
}
type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type LocalDatabase = Database | DatabaseTransaction

type NormalizedItem = SaveDraftPayload['items'][number] & {
  modelNormalized: string
  produkStatus: 'verified' | 'needs_review'
  produkSumber: 'auto' | 'manual'
}

function toText(value: unknown) {
  return String(value || '').trim()
}

function toIso(value: unknown) {
  const text = toText(value)
  if (!text) return ''

  const date = value instanceof Date ? value : new Date(text)
  return Number.isNaN(date.getTime()) ? text : date.toISOString()
}

function normalizePengajuanId(value: unknown) {
  return toText(value).toUpperCase()
}

function normalizeModelKey(value: unknown) {
  return toText(value).replace(/\s+/g, ' ').toUpperCase()
}

function buildModelSerialDuplicateKey(model: unknown, nomorSeri: unknown) {
  const normalizedModel = normalizeModelKey(model)
  const normalizedSerial = toText(nomorSeri).replace(/\s+/g, ' ').toUpperCase()
  return normalizedModel && normalizedSerial ? `${normalizedModel}|${normalizedSerial}` : ''
}

function assertTanggalForm(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Tanggal Form tidak valid')

  const [year = 0, month = 0, day = 0] = value.split('-').map(Number)
  const tanggal = new Date(year, month - 1, day)
  if (Number.isNaN(tanggal.getTime())) throw new Error('Tanggal Form tidak valid')

  const maxDate = new Date()
  maxDate.setHours(23, 59, 59, 999)
  maxDate.setDate(maxDate.getDate() + 7)
  if (tanggal > maxDate) throw new Error('Tanggal Form tidak boleh lebih dari 7 hari ke depan')
}

function assertRequestedItemsDoNotDuplicate(items: SaveDraftPayload['items']) {
  const seen = new Map<string, string>()

  items.forEach((item, index) => {
    const key = buildModelSerialDuplicateKey(item.model, item.nomorSeri)
    if (!key) return

    const firstLabel = seen.get(key)
    const label = `${item.model} / ${item.nomorSeri}`
    if (firstLabel) {
      throw new Error(`Model dan nomor seri sudah diinput lebih dari sekali: ${firstLabel} sama dengan item #${index + 1}.`)
    }

    seen.set(key, label)
  })
}

async function assertNoDuplicateModelSerialInDatabase(
  items: SaveDraftPayload['items'],
  currentId: string,
  database: LocalDatabase,
) {
  const requestedKeys = new Map<string, string>()
  items.forEach((item) => {
    const key = buildModelSerialDuplicateKey(item.model, item.nomorSeri)
    if (key) requestedKeys.set(key, `${item.model} / ${item.nomorSeri}`)
  })
  if (!requestedKeys.size) return

  const query = database
    .select({
      idPengajuan: pengajuanItems.idPengajuan,
      model: pengajuanItems.model,
      nomorSeri: pengajuanItems.nomorSeri,
    })
    .from(pengajuanItems)

  const normalizedCurrentId = normalizePengajuanId(currentId)
  const rows = normalizedCurrentId
    ? await query.where(ne(pengajuanItems.idPengajuan, normalizedCurrentId))
    : await query

  for (const row of rows) {
    const key = buildModelSerialDuplicateKey(row.model, row.nomorSeri)
    const label = requestedKeys.get(key)
    if (!label) continue

    throw new Error(`Model dan nomor seri sudah pernah diajukan di ID Pengajuan ${row.idPengajuan}: ${label}. Gunakan data lain atau cek pengajuan yang sudah ada.`)
  }
}

async function getVerifiedModelMap(database: LocalDatabase) {
  const rows = await database
    .select()
    .from(modelProduk)
    .where(eq(modelProduk.status, 'verified'))

  return new Map(rows.map((row) => [normalizeModelKey(row.model), row]))
}

async function normalizeDraftPayload(input: SaveDraftInput, maxItems: number, database: LocalDatabase) {
  const parsed = saveDraftPengajuanSchema.parse(input)
  assertTanggalForm(parsed.tanggalForm)
  if (parsed.items.length > maxItems) throw new Error(`Jumlah item maksimal ${maxItems}`)

  assertRequestedItemsDoNotDuplicate(parsed.items)

  const modelMap = await getVerifiedModelMap(database)
  const items: NormalizedItem[] = parsed.items.map((item) => {
    const modelNormalized = normalizeModelKey(item.model)
    const master = modelMap.get(modelNormalized)

    if (master) {
      return {
        ...item,
        produk: master.produk,
        modelNormalized,
        produkStatus: 'verified',
        produkSumber: 'auto',
      }
    }

    return {
      ...item,
      modelNormalized,
      produkStatus: 'needs_review',
      produkSumber: 'manual',
    }
  })

  return { ...parsed, items }
}

async function generatePengajuanId(database: LocalDatabase, now: Date) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const prefix = `KG-${year}${month}${day}-`

  const rows = await database
    .select({ idPengajuan: pengajuan.idPengajuan })
    .from(pengajuan)
    .where(like(pengajuan.idPengajuan, `${prefix}%`))

  const max = rows.reduce((currentMax, row) => {
    const sequence = Number.parseInt(row.idPengajuan.slice(prefix.length), 10)
    return Number.isNaN(sequence) ? currentMax : Math.max(currentMax, sequence)
  }, 0)

  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

function generateResumeToken() {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 8)
}

async function replaceDraftItems(idPengajuan: string, items: NormalizedItem[], database: LocalDatabase) {
  await database.delete(pengajuanItems).where(eq(pengajuanItems.idPengajuan, idPengajuan))

  await database.insert(pengajuanItems).values(items.map((item, index) => ({
    idPengajuan,
    noItem: index + 1,
    produk: item.produk,
    model: item.model,
    nomorSeri: item.nomorSeri,
    keputusanItem: null,
    catatanAdminItem: '',
    jenisKartu: null,
    statusCetak: 'Belum Dicetak' as const,
    printBatchId: '',
    printedAt: '',
    statusKirim: 'Belum Dikirim' as const,
    shipBatchId: '',
    shippedAt: '',
    modelNormalized: item.modelNormalized,
    produkStatus: item.produkStatus,
    produkSumber: item.produkSumber,
    tanggalUpdateKeputusanItem: '',
    userUpdateKeputusanItem: '',
  })))
}

function normalizeDraftItem(item: typeof pengajuanItems.$inferSelect) {
  return {
    produk: toText(item.produk),
    model: toText(item.model),
    nomorSeri: toText(item.nomorSeri),
  }
}

async function findDraftRecord(idPengajuan: string, database: LocalDatabase) {
  const normalizedId = normalizePengajuanId(idPengajuan)
  if (!normalizedId) throw new Error('Masukkan ID Pengajuan terlebih dahulu.')

  const [draft] = await database
    .select()
    .from(pengajuan)
    .where(eq(pengajuan.idPengajuan, normalizedId))
    .limit(1)

  if (!draft) throw new Error('ID Pengajuan tidak ditemukan. Periksa kembali ID pada printout draft.')
  return draft
}

async function buildDraftResponse(
  draft: typeof pengajuan.$inferSelect,
  database: LocalDatabase,
): Promise<LocalDraftData> {
  const items = await database
    .select()
    .from(pengajuanItems)
    .where(eq(pengajuanItems.idPengajuan, draft.idPengajuan))
    .orderBy(asc(pengajuanItems.noItem))

  return {
    idPengajuan: toText(draft.idPengajuan),
    status: toText(draft.status),
    resumeToken: toText(draft.resumeToken),
    nama: toText(draft.nama),
    bagianCabang: toText(draft.bagianCabang),
    pemilik: toText(draft.pemilik),
    alasanPengajuan: toText(draft.alasanPengajuan),
    tanggalForm: toText(draft.tanggalForm),
    catatanTambahan: toText(draft.catatanTambahan),
    items: items.map(normalizeDraftItem),
  }
}

function assertDraftCanBeContinued(draft: typeof pengajuan.$inferSelect, resumeToken?: string) {
  if (draft.status !== DRAFT_STATUS) throw new Error('Draft sudah tidak dapat dilanjutkan')

  const storedToken = toText(draft.resumeToken)
  if (!storedToken) {
    throw new Error('Draft ditemukan, tetapi Resume Token tidak tersedia. Draft ini tidak bisa dilanjutkan. Silakan buat draft baru atau hubungi admin.')
  }

  if (resumeToken !== undefined && storedToken !== resumeToken) {
    throw new Error('Link lanjutkan tidak valid atau draft tidak ditemukan')
  }
}

export async function loadDraftPengajuanByIdLocal(
  idPengajuan: string,
  database: Database = db,
): Promise<LocalDraftLoadResponse> {
  const draft = await findDraftRecord(idPengajuan, database)
  assertDraftCanBeContinued(draft)
  return await buildDraftResponse(draft, database)
}

export async function getDraftPengajuanLocal(
  idPengajuan: string,
  resumeToken: string,
  database: Database = db,
): Promise<LocalDraftLoadResponse> {
  const normalizedToken = toText(resumeToken)
  if (!normalizedToken) throw new Error('Buka draft dari Draft Terakhir atau Link Lanjutkan Draft')

  const draft = await findDraftRecord(idPengajuan, database)
  assertDraftCanBeContinued(draft, normalizedToken)
  return await buildDraftResponse(draft, database)
}

export async function checkDraftPengajuanStatusLocal(
  idPengajuan: string,
  database: Database = db,
): Promise<LocalDraftStatusResponse> {
  const draft = await findDraftRecord(idPengajuan, database)
  assertDraftCanBeContinued(draft)

  return {
    idPengajuan: toText(draft.idPengajuan),
    status: toText(draft.status),
    resumeToken: toText(draft.resumeToken),
  }
}

function normalizeArchivePublicBasePath(value: string | undefined) {
  const basePath = String(value || '/arsip_file').trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!basePath || !basePath.startsWith('/')) return '/arsip_file'
  return basePath
}

function buildLocalArchiveFileId(idPengajuan: string, kind: 'hardcopy' | 'bukti', sequence: number) {
  if (kind === 'hardcopy') return `${idPengajuan}:hardcopy`
  return `${idPengajuan}:bukti:${String(sequence).padStart(2, '0')}`
}

type PreparedUploadFile = {
  id: string
  idPengajuan: string
  kind: 'hardcopy' | 'bukti'
  sequence: number
  fileName: string
  publicPath: string
  localPath: string
  mimeType: string
  bytes: Buffer
  sizeBytes: number
  sha256: string
}

type UploadFileInput = Pick<PreparedUploadFile, 'kind' | 'sequence' | 'fileName' | 'mimeType' | 'bytes'>

function decodeBase64(value: string, label: string) {
  const base64 = value.trim()
  if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 === 1) {
    throw new Error(`${label} bukan Base64 yang valid`)
  }

  const bytes = Buffer.from(base64, 'base64')
  if (!bytes.length) throw new Error(`${label} belum lengkap`)
  return bytes
}

function validateFileMetadata(
  extension: string,
  mimeType: string,
  allowedExtensions: string[],
  allowedMimeTypes: string[],
  label: string,
) {
  const normalizedExtension = extension.trim().toLowerCase().replace(/^\./, '')
  const normalizedMimeType = mimeType.trim().toLowerCase()

  if (!allowedExtensions.includes(normalizedExtension)) {
    throw new Error(`${label} memiliki format yang tidak valid`)
  }
  if (!allowedMimeTypes.includes(normalizedMimeType)) {
    throw new Error(`${label} memiliki MIME type yang tidak valid`)
  }

  return {
    extension: normalizedExtension,
    mimeType: normalizedMimeType,
  }
}

function prepareUploadFiles(
  payload: SubmitDraftPayload,
  idPengajuan: string,
  options: SubmitDraftOptions,
) {
  if (idPengajuan.includes('/') || idPengajuan.includes('\\') || idPengajuan.includes('\0')) {
    throw new Error('ID Pengajuan tidak valid')
  }

  const maxUploadMb = Number(options.maxUploadMb || DEFAULT_MAX_UPLOAD_MB)
  const maxEvidenceFiles = Number(options.maxEvidenceFiles || DEFAULT_MAX_EVIDENCE_FILES)
  const maxEvidenceFileMb = Number(options.maxEvidenceFileMb || DEFAULT_MAX_EVIDENCE_FILE_MB)
  const archivePublicBasePath = normalizeArchivePublicBasePath(options.archivePublicBasePath)
  const hardcopyMetadata = validateFileMetadata(
    payload.fileExtension,
    payload.fileMimeType,
    ['pdf'],
    ['application/pdf'],
    'File hard copy',
  )
  const hardcopyBytes = decodeBase64(payload.fileBase64, 'File hard copy')
  if (hardcopyBytes.byteLength > maxUploadMb * 1024 * 1024) {
    throw new Error(`Ukuran file melebihi ${maxUploadMb}MB`)
  }

  if (payload.evidenceAttachments.length > maxEvidenceFiles) {
    throw new Error(`Jumlah lampiran foto bukti maksimal ${maxEvidenceFiles}`)
  }

  const uploadInputs: UploadFileInput[] = [{
    kind: 'hardcopy' as const,
    sequence: 0,
    fileName: buildArchiveFileName(idPengajuan, 'hardcopy'),
    mimeType: hardcopyMetadata.mimeType,
    bytes: hardcopyBytes,
  }]

  payload.evidenceAttachments.forEach((attachment, index) => {
    const metadata = validateFileMetadata(
      attachment.fileExtension,
      attachment.fileMimeType,
      ['jpg', 'jpeg'],
      ['image/jpeg', 'image/jpg'],
      `Lampiran foto bukti #${index + 1}`,
    )
    const bytes = decodeBase64(attachment.fileBase64, `Lampiran foto bukti #${index + 1}`)
    if (bytes.byteLength > maxEvidenceFileMb * 1024 * 1024) {
      throw new Error(`Ukuran lampiran foto bukti #${index + 1} melebihi ${maxEvidenceFileMb}MB`)
    }

    uploadInputs.push({
      kind: 'bukti' as const,
      sequence: index + 1,
      fileName: buildArchiveFileName(idPengajuan, 'bukti', index + 1),
      mimeType: metadata.mimeType,
      bytes,
    })
  })

  return uploadInputs.map((file) => {
    const publicPath = `${archivePublicBasePath}/${file.fileName}`
    const localPath = resolveArchiveLocalPath(publicPath, {
      archiveDir: options.archiveDir,
      archivePublicBasePath,
    })

    return {
      ...file,
      id: buildLocalArchiveFileId(idPengajuan, file.kind, file.sequence),
      idPengajuan,
      publicPath,
      localPath,
      sizeBytes: file.bytes.byteLength,
      sha256: createHash('sha256').update(file.bytes).digest('hex'),
    } satisfies PreparedUploadFile
  })
}

async function writePreparedUploadFiles(files: PreparedUploadFile[]) {
  const writtenPaths: string[] = []

  try {
    for (const file of files) {
      await mkdir(dirname(file.localPath), { recursive: true })
      await writeFile(file.localPath, file.bytes)
      writtenPaths.push(file.localPath)
    }
  } catch (error) {
    await Promise.all(writtenPaths.map(async (path) => {
      await unlink(path).catch(() => undefined)
    }))
    throw error
  }
}

type UploadFileBackup = {
  originalPath: string
  backupPath: string
}

function isMissingFileError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

async function backupExistingUploadFiles(files: PreparedUploadFile[]) {
  const backups: UploadFileBackup[] = []

  try {
    for (const file of files) {
      const backupPath = `${file.localPath}.submit-backup-${randomUUID()}`

      try {
        await rename(file.localPath, backupPath)
        backups.push({
          originalPath: file.localPath,
          backupPath,
        })
      } catch (error) {
        if (!isMissingFileError(error)) throw error
      }
    }

    return backups
  } catch (error) {
    await restoreUploadFileBackups(backups)
    throw error
  }
}

async function restoreUploadFileBackups(backups: UploadFileBackup[]) {
  await Promise.all(backups.map(async ({ originalPath, backupPath }) => {
    await unlink(originalPath).catch(() => undefined)
    await rename(backupPath, originalPath).catch(() => undefined)
  }))
}

async function removeUploadFileBackups(backups: UploadFileBackup[]) {
  await Promise.all(backups.map(({ backupPath }) => unlink(backupPath).catch(() => undefined)))
}

async function removeFiles(paths: string[]) {
  await Promise.all(paths.map(async (path) => {
    await unlink(path).catch(() => undefined)
  }))
}

export async function getLocalModelProduk(database: Database = db): Promise<ModelProdukResponse> {
  const rows = await database
    .select()
    .from(modelProduk)
    .where(eq(modelProduk.status, 'verified'))

  return {
    rows: rows.map((row) => ({
      model: normalizeModelKey(row.model),
      produk: row.produk,
      origin: toText(row.origin),
      status: toText(row.status),
      updatedAt: toIso(row.updatedAt || row.localUpdatedAt),
    })),
  }
}

export async function saveDraftPengajuanLocal(
  input: SaveDraftInput,
  database: Database = db,
  options: SaveDraftOptions = {},
): Promise<SaveDraftPengajuanResponse> {
  const maxItems = Number(options.maxItems || DEFAULT_MAX_ITEMS)
  const now = options.now || new Date()
  const nowIso = now.toISOString()
  const tokenFactory = options.tokenFactory || generateResumeToken

  const result = await database.transaction(async (tx) => {
    const normalized = await normalizeDraftPayload(input, maxItems, tx)
    const requestedId = normalizePengajuanId(normalized.idPengajuan)
    const requestedToken = toText(normalized.resumeToken)

    let idPengajuan = requestedId
    let resumeToken = requestedToken
    let draftCreatedAt = nowIso

    const [existing] = requestedId
      ? await tx.select().from(pengajuan).where(eq(pengajuan.idPengajuan, requestedId)).limit(1)
      : []

    if (existing) {
      if (!requestedToken || toText(existing.resumeToken) !== requestedToken) {
        throw new Error('Link lanjutkan tidak valid atau draft tidak ditemukan')
      }
      if (existing.status !== DRAFT_STATUS) throw new Error('Draft sudah tidak dapat diubah')

      await assertNoDuplicateModelSerialInDatabase(normalized.items, requestedId, tx)
      draftCreatedAt = toIso(existing.draftCreatedAt) || nowIso

      await tx
        .update(pengajuan)
        .set({
          timestampSubmit: '',
          nama: normalized.nama,
          bagianCabang: normalized.bagianCabang,
          pemilik: normalized.pemilik,
          alasanPengajuan: normalized.alasanPengajuan,
          tanggalForm: normalized.tanggalForm,
          catatanTambahan: normalized.catatanTambahan,
          jumlahItem: normalized.items.length,
          jumlahFileBukti: 0,
          status: DRAFT_STATUS,
          catatanAdmin: '',
          tanggalUpdateStatusTerakhir: '',
          userUpdateStatus: '',
          resumeToken,
          draftCreatedAt,
          draftUpdatedAt: nowIso,
          submittedAt: '',
        })
        .where(eq(pengajuan.idPengajuan, requestedId))
    } else {
      if (requestedId || requestedToken) throw new Error('Draft tidak ditemukan atau link lanjutkan tidak valid')

      await assertNoDuplicateModelSerialInDatabase(normalized.items, '', tx)
      idPengajuan = await generatePengajuanId(tx, now)
      resumeToken = tokenFactory()

      await tx.insert(pengajuan).values({
        idPengajuan,
        timestampSubmit: '',
        nama: normalized.nama,
        bagianCabang: normalized.bagianCabang,
        pemilik: normalized.pemilik,
        alasanPengajuan: normalized.alasanPengajuan,
        tanggalForm: normalized.tanggalForm,
        catatanTambahan: normalized.catatanTambahan,
        jumlahItem: normalized.items.length,
        jumlahFileBukti: 0,
        status: DRAFT_STATUS,
        catatanAdmin: '',
        tanggalUpdateStatusTerakhir: '',
        userUpdateStatus: '',
        resumeToken,
        draftCreatedAt: nowIso,
        draftUpdatedAt: nowIso,
        submittedAt: '',
      })
    }

    await replaceDraftItems(idPengajuan, normalized.items, tx)

    return {
      idPengajuan,
      resumeToken,
      status: DRAFT_STATUS,
    } satisfies SaveDraftPengajuanResponse
  })

  return result
}

export async function submitDraftPengajuanLocal(
  input: SubmitDraftInput,
  database: Database = db,
  options: SubmitDraftOptions = {},
): Promise<LocalSubmitDraftResponse> {
  const maxItems = Number(options.maxItems || DEFAULT_MAX_ITEMS)
  const now = options.now || new Date()
  const nowIso = now.toISOString()
  const parsed = submitDraftPengajuanSchema.parse(input)
  const idPengajuan = normalizePengajuanId(parsed.idPengajuan)
  const resumeToken = toText(parsed.resumeToken)
  const preparedFiles = prepareUploadFiles(parsed, idPengajuan, options)
  const backups = await backupExistingUploadFiles(preparedFiles)
  let filesWritten = false

  try {
    await writePreparedUploadFiles(preparedFiles)
    filesWritten = true

    const result = await database.transaction(async (tx) => {
      const draft = await findDraftRecord(idPengajuan, tx)
      assertDraftCanBeContinued(draft, resumeToken)

      const normalized = await normalizeDraftPayload(parsed, maxItems, tx)
      await assertNoDuplicateModelSerialInDatabase(normalized.items, idPengajuan, tx)

      const previousFiles = await tx
        .select({ localPath: archiveFiles.localPath })
        .from(archiveFiles)
        .where(eq(archiveFiles.idPengajuan, idPengajuan))

      await tx
        .update(pengajuan)
        .set({
          timestampSubmit: nowIso,
          nama: normalized.nama,
          bagianCabang: normalized.bagianCabang,
          pemilik: normalized.pemilik,
          alasanPengajuan: normalized.alasanPengajuan,
          tanggalForm: normalized.tanggalForm,
          catatanTambahan: normalized.catatanTambahan,
          jumlahItem: normalized.items.length,
          jumlahFileBukti: preparedFiles.filter((file) => file.kind === 'bukti').length,
          status: FINAL_STATUS,
          catatanAdmin: '',
          tanggalUpdateStatusTerakhir: '',
          userUpdateStatus: '',
          resumeToken: '',
          draftCreatedAt: toIso(draft.draftCreatedAt),
          draftUpdatedAt: toIso(draft.draftUpdatedAt),
          submittedAt: nowIso,
        })
        .where(eq(pengajuan.idPengajuan, idPengajuan))

      await replaceDraftItems(idPengajuan, normalized.items, tx)

      await tx
        .delete(archiveFiles)
        .where(eq(archiveFiles.idPengajuan, idPengajuan))

      await tx.insert(archiveFiles).values(preparedFiles.map((file) => ({
        id: file.id,
        idPengajuan: file.idPengajuan,
        kind: file.kind,
        sequence: file.sequence,
        fileName: file.fileName,
        publicPath: file.publicPath,
        localPath: file.localPath,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        sha256: file.sha256,
        sourceDriveFileId: null,
        status: 'downloaded' as const,
        downloadedAt: nowIso,
        driveTrashedAt: null,
        error: null,
      })))

      await tx
        .insert(statusLog)
        .values({
          dedupeKey: [
            idPengajuan,
            nowIso,
            DRAFT_STATUS,
            FINAL_STATUS,
            FINAL_SUBMIT_LOG_NOTE,
            'system',
            '',
          ].join('|'),
          timestamp: nowIso,
          idPengajuan,
          statusLama: DRAFT_STATUS,
          statusBaru: FINAL_STATUS,
          catatanAdmin: FINAL_SUBMIT_LOG_NOTE,
          user: 'system',
          noItem: '',
        })
        .onConflictDoNothing({ target: statusLog.dedupeKey })

      return {
        idPengajuan,
        stalePaths: previousFiles
          .map((file) => toText(file.localPath))
          .filter((path) => path && !preparedFiles.some((prepared) => prepared.localPath === path)),
      }
    })

    await removeFiles(result.stalePaths)
    await removeUploadFileBackups(backups)
    return { idPengajuan: result.idPengajuan }
  } catch (error) {
    if (filesWritten) await removeFiles(preparedFiles.map((file) => file.localPath))
    await restoreUploadFileBackups(backups)
    throw error
  }
}
