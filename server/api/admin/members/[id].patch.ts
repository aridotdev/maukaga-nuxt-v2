import { updateAdminMember } from '../../../services/admin-members-service'

export default defineEventHandler(async (event) => {
  return await updateAdminMember(
    event,
    getRouterParam(event, 'id') || '',
    await readBody(event),
  )
})
