import { saveAdminPrintLayout } from '../../../services/admin-print-layouts-service'

export default defineEventHandler(async (event) => {
  return await saveAdminPrintLayout(event, await readBody(event))
})
