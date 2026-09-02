import { deleteAdminPrintLayout } from '../../../services/admin-print-layouts-service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  return await deleteAdminPrintLayout(event, id)
})
