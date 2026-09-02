import { saveAdminConfig } from '../../../services/admin-config-service'

export default defineEventHandler(async (event) => {
  return await saveAdminConfig(event, await readBody(event))
})
