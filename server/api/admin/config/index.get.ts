import { listAdminConfig } from '../../../services/admin-config-service'

export default defineEventHandler(async (event) => {
  return await listAdminConfig(event)
})
