import { callActiveGasData } from '../../../../services/active-gas-service'

export default defineEventHandler(async (event) => {
  const idPengajuan = getRouterParam(event, 'idPengajuan') || ''

  return await callActiveGasData(event, 'deletePengajuan', { idPengajuan })
})
