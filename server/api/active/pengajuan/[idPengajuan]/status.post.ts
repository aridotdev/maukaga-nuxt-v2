import { updateActivePengajuanStatus } from '../../../../services/active-gas-service'

export default defineEventHandler(async (event) => {
  const idPengajuan = getRouterParam(event, 'idPengajuan') || ''
  const body = await readBody<Record<string, unknown>>(event)

  return await updateActivePengajuanStatus(event, idPengajuan, body || {})
})
