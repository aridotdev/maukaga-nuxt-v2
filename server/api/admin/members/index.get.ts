import { listAdminMembers } from '../../../services/admin-members-service'

export default defineEventHandler(async (event) => {
  return await listAdminMembers(event)
})
