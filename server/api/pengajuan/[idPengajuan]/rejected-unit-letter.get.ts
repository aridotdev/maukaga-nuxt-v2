import {
  defineEventHandler,
  getQuery,
  getRouterParam,
  send,
  setHeader,
} from 'h3'
import { z } from 'zod'
import {
  generateRejectedUnitLetter,
  rejectedUnitLetterInputSchema,
} from '../../../services/rejected-unit-letter-service'
import { normalizeApiError } from '../../../utils/api-error'
import { requireApiSession } from '../../../utils/auth-guard'

const rejectedUnitLetterQuerySchema = z.object({
  itemNos: z.preprocess(
    value => value ?? '',
    z.string().trim().min(1, 'Parameter itemNos wajib diisi'),
  ),
})

export function parseRejectedUnitLetterQuery(input: unknown): {
  itemNos: number[]
} {
  const query = rejectedUnitLetterQuerySchema.parse(input)
  const itemNos = query.itemNos.split(',').map((value) => {
    const normalizedValue = value.trim()
    return /^\d+$/.test(normalizedValue)
      ? Number(normalizedValue)
      : 0
  })

  return rejectedUnitLetterInputSchema.parse({ itemNos })
}

export function createRejectedUnitLetterDownloadFilename(
  idPengajuan: string,
  tanggalSurat: string,
): string {
  const safeIdPengajuan = sanitizeFilenamePart(idPengajuan) || 'pengajuan'
  const safeDate = tanggalSurat.replace(/\D/g, '') || 'tanggal'

  return `surat-permohonan-${safeIdPengajuan}-${safeDate}.pdf`
}

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireApiSession(event, ['admin'])
    const idPengajuan = getRouterParam(event, 'idPengajuan') ?? ''
    const input = parseRejectedUnitLetterQuery(getQuery(event))
    const result = await generateRejectedUnitLetter(idPengajuan, input, {
      actorId: user.id,
      actorRole: user.role,
    })

    setHeader(event, 'Content-Type', 'application/pdf')
    setHeader(
      event,
      'Content-Disposition',
      createAttachmentDisposition(
        createRejectedUnitLetterDownloadFilename(
          result.viewModel.idPengajuan,
          result.viewModel.tanggalSurat,
        ),
      ),
    )
    setHeader(event, 'Content-Length', result.pdf.length)
    setHeader(event, 'Cache-Control', 'private, no-store')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')

    return send(event, result.pdf)
  } catch (error) {
    normalizeApiError(error)
  }
})

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createAttachmentDisposition(filename: string): string {
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
