import { setActiveAdminPrintLayout } from '../../../services/admin-print-layouts-service'

export default defineEventHandler(async (event) => {
  return await setActiveAdminPrintLayout(event, await readBody(event))
})
