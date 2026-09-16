import { randomUUID, createHash } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, extname, resolve, sep } from 'node:path'
import { DEFAULT_PENGAJUAN_FILE_DIRECTORY } from '../../config/storage'

export interface PendingPengajuanFile {
  kind: 'hardcopy' | 'evidence' | 'attachment'
  sequence: number
  originalName: string
  mimeType: string
  sizeBytes: number
  data: Buffer
}

export interface StoredPengajuanFile {
  id: string
  kind: 'hardcopy' | 'evidence' | 'attachment'
  sequence: number
  originalName: string
  storageKey: string
  mimeType: string
  sizeBytes: number
  sha256: string
}

export function preparePengajuanFile(
  idPengajuan: string,
  file: PendingPengajuanFile,
): StoredPengajuanFile {
  const extension = normalizeExtension(file.originalName, file.mimeType)
  const storageName = `${file.kind}-${file.sequence}-${randomUUID()}${extension}`

  return {
    id: randomUUID(),
    kind: file.kind,
    sequence: file.sequence,
    originalName: basename(file.originalName).trim() || storageName,
    storageKey: `${idPengajuan}/${storageName}`,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    sha256: createHash('sha256').update(file.data).digest('hex'),
  }
}

export async function writePengajuanFile(storageKey: string, data: Buffer) {
  const targetPath = resolvePengajuanStoragePath(storageKey)
  await mkdir(resolvePengajuanStorageRoot(), { recursive: true })
  await mkdir(targetPath.slice(0, targetPath.lastIndexOf(sep)), { recursive: true })
  await writeFile(targetPath, data)
}

export async function cleanupPengajuanFiles(storageKeys: string[]) {
  await Promise.all(storageKeys.map(async (storageKey) => {
    await rm(resolvePengajuanStoragePath(storageKey), { force: true })
  }))
}

function resolvePengajuanStorageRoot() {
  return resolve(process.env.NUXT_PENGAJUAN_FILE_DIRECTORY || DEFAULT_PENGAJUAN_FILE_DIRECTORY)
}

function resolvePengajuanStoragePath(storageKey: string) {
  const root = resolvePengajuanStorageRoot()
  const target = resolve(root, storageKey)

  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error('Invalid pengajuan storage path')
  }

  return target
}

function normalizeExtension(originalName: string, mimeType: string) {
  const extension = extname(originalName).toLowerCase()
  if (['.pdf', '.jpg', '.jpeg'].includes(extension)) return extension
  if (mimeType === 'application/pdf') return '.pdf'
  return '.jpg'
}
