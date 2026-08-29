import { callActiveGasData } from '../../../services/active-gas-service'

export default defineEventHandler(async (event) => {
  return await callActiveGasData(event, 'getPengajuanList', getQuery(event))
})
