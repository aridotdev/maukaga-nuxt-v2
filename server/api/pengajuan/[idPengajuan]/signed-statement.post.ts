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
        statusMessage: 'File surat Permohonan wajib diunggah',
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

    const scopeValue = form?.find(part => part.name === 'scope')?.data.toString('utf8').trim()
    const scope = scopeValue || undefined
    if (scope !== undefined && scope !== 'all_rejected' && scope !== 'selected_items') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cakupan surat Permohonan tidak valid',
      })
    }

    const itemNosPart = form?.find(part => part.name === 'itemNos')
    let itemNos: number[] | undefined
    if (itemNosPart) {
      let parsedItemNos: unknown
      try {
        parsedItemNos = JSON.parse(itemNosPart.data.toString('utf8'))
      } catch {
        throw createError({
          statusCode: 400,
          statusMessage: 'Daftar item surat Permohonan tidak valid',
        })
      }

      if (
        !Array.isArray(parsedItemNos)
        || parsedItemNos.some(itemNo => !Number.isInteger(itemNo) || itemNo <= 0)
      ) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Daftar item surat Permohonan tidak valid',
        })
      }

      itemNos = parsedItemNos
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
      { noItem, scope: scope as 'all_rejected' | 'selected_items' | undefined, itemNos },
    )
  } catch (error) {
    normalizeApiError(error)
  }
})
