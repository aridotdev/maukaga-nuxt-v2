import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import {
  createError,
  getRouterParam,
  sendStream,
  setHeader,
} from 'h3'
import { getPengajuanFile } from '../../../../services/pengajuan-service'
import { normalizeApiError } from '../../../../utils/api-error'
import { resolvePengajuanStoragePath } from '../../../../utils/pengajuan-file-storage'
import { requireApiSession } from '../../../../utils/auth-guard'

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
])

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)

    const idPengajuan = getRouterParam(event, 'idPengajuan') ?? ''
    const fileId = getRouterParam(event, 'fileId') ?? ''
    const file = await getPengajuanFile(idPengajuan, fileId)

    if (!SUPPORTED_MIME_TYPES.has(file.mimeType)) {
      throw createError({
        statusCode: 415,
        statusMessage: 'Tipe file lampiran tidak didukung',
      })
    }

    let filePath: string
    try {
      filePath = resolvePengajuanStoragePath(file.storageKey)
    } catch {
      throw createError({
        statusCode: 404,
        statusMessage: 'File lampiran tidak ditemukan',
      })
    }

    let fileStats: Awaited<ReturnType<typeof stat>>
    try {
      fileStats = await stat(filePath)
    } catch (error) {
      if (isMissingFileError(error)) {
        throw createError({
          statusCode: 404,
          statusMessage: 'File lampiran tidak ditemukan',
        })
      }

      throw error
    }

    if (!fileStats.isFile()) {
      throw createError({
        statusCode: 404,
        statusMessage: 'File lampiran tidak ditemukan',
      })
    }

    setHeader(event, 'Content-Type', file.mimeType)
    setHeader(event, 'Content-Length', fileStats.size)
    setHeader(event, 'Content-Disposition', createInlineDisposition(file.originalName))
    setHeader(event, 'Cache-Control', 'private, no-store')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')

    return sendStream(event, createReadStream(filePath))
  } catch (error) {
    normalizeApiError(error)
  }
})

function createInlineDisposition(filename: string) {
  const safeFilename = [...basename(filename)]
    .map((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127 || character === '"' ? '_' : character
    })
    .join('')
    .trim() || 'lampiran'

  return `inline; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
