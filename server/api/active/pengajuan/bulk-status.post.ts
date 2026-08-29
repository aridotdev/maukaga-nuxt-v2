import { updateActivePengajuanStatus } from '../../../services/active-gas-service'

type BulkStatusBody = {
  ids?: unknown
  statusBaru?: unknown
  catatanAdmin?: unknown
}

type BulkStatusResult = {
  idPengajuan: string
  success: boolean
  data?: unknown
  error?: string
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return []

  return Array.from(new Set(
    value
      .map(item => String(item || '').trim())
      .filter(Boolean),
  ))
}

export default defineEventHandler(async (event) => {
  const body = await readBody<BulkStatusBody>(event)
  const ids = normalizeIds(body?.ids)
  const statusBaru = String(body?.statusBaru || '').trim()
  const catatanAdmin = String(body?.catatanAdmin || '').trim()

  if (!ids.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pilih minimal satu pengajuan.',
    })
  }

  const results: BulkStatusResult[] = []

  for (const idPengajuan of ids) {
    try {
      const data = await updateActivePengajuanStatus(event, idPengajuan, {
        statusBaru,
        catatanAdmin,
      })

      results.push({
        idPengajuan,
        success: true,
        data,
      })
    } catch (error) {
      results.push({
        idPengajuan,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const updated = results.filter(result => result.success).length

  return {
    statusBaru,
    catatanAdmin,
    total: ids.length,
    updated,
    failed: ids.length - updated,
    results,
  }
})
