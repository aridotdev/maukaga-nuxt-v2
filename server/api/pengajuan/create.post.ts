import { readMultipartFormData } from 'h3'
import { createPengajuan } from '../../services/pengajuan-service'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'
import type { PendingPengajuanFile } from '../../utils/pengajuan-file-storage'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireApiSession(event, ['admin', 'qrcc'])
    const runtimeConfig = useRuntimeConfig()
    const form = await readMultipartFormData(event)
    const payloadPart = form?.find(part => part.name === 'payload')

    if (!payloadPart) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Payload pengajuan wajib dikirim',
      })
    }

    const payload = JSON.parse(payloadPart.data.toString('utf8'))
    const files = (form ?? [])
      .filter(part => part.filename && part.name?.startsWith('file:'))
      .map((part): PendingPengajuanFile => ({
        kind: part.name?.startsWith('file:hardcopy:') ? 'hardcopy' : 'evidence',
        sequence: Number(part.name?.split(':').at(2) ?? 0),
        originalName: part.filename ?? 'lampiran',
        mimeType: part.type ?? '',
        sizeBytes: part.data.byteLength,
        data: Buffer.from(part.data),
      }))

    return createPengajuan(payload, files, {
      actorId: user.id,
      maxItems: Number(runtimeConfig.public.maxItems || 10),
    })
  } catch (error) {
    normalizeApiError(error)
  }
})
