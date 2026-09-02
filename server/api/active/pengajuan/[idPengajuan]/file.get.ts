import { createError } from 'h3'
import { callActiveGasResult } from '../../../../services/active-gas-service'

type ActiveArchiveFileResponse = {
  fileName: string
  mimeType: string
  sizeBytes: number
  base64: string
  sourceDriveFileId: string
}

export default defineEventHandler(async (event) => {
  const idPengajuan = getRouterParam(event, 'idPengajuan') || ''
  const kind = String(getQuery(event).kind || 'hardcopy').trim()
  const sequence = Number(getQuery(event).sequence || 0)
  const fileName = String(getQuery(event).fileName || '').trim()

  const result = await callActiveGasResult<ActiveArchiveFileResponse>(event, 'getArchiveFile', {
    idPengajuan,
    kind,
    sequence,
    fileName,
  })

  const file = result.data
  if (!file?.base64) {
    throw createError({
      statusCode: 502,
      statusMessage: 'File arsip aktif tidak tersedia.',
    })
  }

  const buffer = Buffer.from(file.base64, 'base64')
  const safeFileName = file.fileName || `${idPengajuan}_${kind}`

  return new Response(buffer, {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Length': String(buffer.byteLength),
      'Content-Disposition': `inline; filename="${safeFileName}"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
})
