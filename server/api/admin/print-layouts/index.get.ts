import { listAdminPrintLayouts } from '../../../services/admin-print-layouts-service'

export default defineEventHandler(async (event) => {
  return await listAdminPrintLayouts(event)
})
