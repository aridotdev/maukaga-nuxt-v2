import { getQuery } from 'h3'
import * as z from 'zod'
import {
  ITEM_DECISION_STATUSES,
  PENGAJUAN_STATUSES,
} from '../../database/schema'
import { listPengajuan } from '../../services/pengajuan-service'
import { normalizeApiError } from '../../utils/api-error'
import { requireApiSession } from '../../utils/auth-guard'

const querySchema = z.object({
  search: z.string().optional(),
  status: z.enum(PENGAJUAN_STATUSES).optional(),
  decision: z.enum(ITEM_DECISION_STATUSES).optional(),
  branch: z.string().optional(),
  model: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    await requireApiSession(event)
    const query = querySchema.parse(getQuery(event))
    return listPengajuan(query)
  } catch (error) {
    normalizeApiError(error)
  }
})
