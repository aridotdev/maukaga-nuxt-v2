import { createAdminMember } from '../../../services/admin-members-service'

export default defineEventHandler(async (event) => {
  return await createAdminMember(event, await readBody(event))
})
