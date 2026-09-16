import { getRouterParam, readBody } from 'h3'
import * as z from 'zod'
import { markItemShipped } from '../../../services/pengajuan-service'
import { normalizeApiError } from '../../../utils/api-error'
import { requireApiSession } from '../../../utils/auth-guard'

const bodySchema = z.object({ noItem: z.number().int().positive() })

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireApiSession(event, ['admin', 'qrcc'])
    const body = bodySchema.parse(await readBody(event))
    return markItemShipped(getRouterParam(event, 'idPengajuan') ?? '', body.noItem, {
      actorId: user.id,
    })
  } catch (error) {
    normalizeApiError(error)
  }
})
