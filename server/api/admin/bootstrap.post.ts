import { bootstrapFirstAdmin } from '../../services/admin-members-service'

export default defineEventHandler(async (event) => {
  return await bootstrapFirstAdmin(await readBody(event))
})
