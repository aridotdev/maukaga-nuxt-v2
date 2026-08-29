import { updateActivePengajuanItemDecision } from '../../../../services/active-gas-service'

export default defineEventHandler(async (event) => {
  const idPengajuan = getRouterParam(event, 'idPengajuan') || ''
  const body = await readBody<Record<string, unknown>>(event)

  return await updateActivePengajuanItemDecision(event, idPengajuan, body || {})
})
