import { createError, getRouterParam, readMultipartFormData } from 'h3'
import { uploadSignedStatement } from '../../../services/pengajuan-service'
import { normalizeApiError } from '../../../utils/api-error'
import { requireApiSession } from '../../../utils/auth-guard'
import type { PendingPengajuanFile } from '../../../utils/pengajuan-file-storage'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireApiSession(event, ['admin'])
    const form = await readMultipartFormData(event)
    const filePart = form?.find(part => part.name === 'file' && part.filename)

    if (!filePart?.filename) {
      throw createError({
        statusCode: 400,
        statusMessage: 'File surat pernyataan wajib diunggah',
      })
    }

    const noItemPart = form?.find(part => part.name === 'noItem')
    const noItemValue = noItemPart?.data.toString('utf8').trim()
    const noItem = noItemValue ? Number(noItemValue) : undefined

    if (noItem !== undefined && (!Number.isInteger(noItem) || noItem <= 0)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Nomor item tidak valid',
      })
    }

    const file: PendingPengajuanFile = {
      kind: 'signed_statement',
      sequence: 0,
      originalName: filePart.filename,
      mimeType: filePart.type ?? '',
      sizeBytes: filePart.data.byteLength,
      data: Buffer.from(filePart.data),
    }

    return await uploadSignedStatement(
      getRouterParam(event, 'idPengajuan') ?? '',
      file,
      {
        actorId: user.id,
        actorRole: user.role,
        maxUploadMb: Math.max(1, Number(useRuntimeConfig().public.maxUploadMb || 10)),
      },
      { noItem },
    )
  } catch (error) {
    normalizeApiError(error)
  }
})
