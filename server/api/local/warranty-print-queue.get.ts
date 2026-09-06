import { readLocalWarrantyPrintQueueForAdmin } from '../../services/local-warranty-print-queue-service'

export default defineEventHandler(async (event) => {
  return await readLocalWarrantyPrintQueueForAdmin(event)
})
