import { readBody } from 'h3'
import * as z from 'zod'
import { updateStatusInputSchema, updateBulkPengajuanStatus } from '../../services/pengajuan-service'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'

const bodySchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1),
  status: updateStatusInputSchema.shape.status,
  note: updateStatusInputSchema.shape.note,
})

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireApiSession(event, ['admin', 'qrcc'])
    const body = bodySchema.parse(await readBody(event))
    return updateBulkPengajuanStatus(body.ids, {
      status: body.status,
      note: body.note,
    }, {
      actorId: user.id,
      actorRole: user.role,
    })
  } catch (error) {
    normalizeApiError(error)
  }
})
