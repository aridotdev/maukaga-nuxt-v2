import { callActiveGasResult } from '../../../services/active-gas-service'

export default defineEventHandler(async (event) => {
  const action = getRouterParam(event, 'action') || ''
  const body = await readBody<Record<string, unknown>>(event)

  return await callActiveGasResult(event, action, body || {})
})
