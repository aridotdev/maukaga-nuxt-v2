import { setAdminPassword } from '../../services/admin-password-service'

export default defineEventHandler(async (event) => {
  const rawBody = await readBody(event)
  return await setAdminPassword(event, rawBody)
})
