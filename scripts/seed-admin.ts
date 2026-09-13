import { db } from '../server/database'
import {
  DEFAULT_ADMIN_SEED_EMAIL,
  DEFAULT_ADMIN_SEED_NAME,
  seedAdminUser,
} from '../server/services/admin-seed-service'

const email = process.env.ADMIN_SEED_EMAIL?.trim() || DEFAULT_ADMIN_SEED_EMAIL
const name = process.env.ADMIN_SEED_NAME?.trim() || DEFAULT_ADMIN_SEED_NAME

try {
  const password = process.env.ADMIN_SEED_PASSWORD

  if (!password) {
    throw new Error(
      'ADMIN_SEED_PASSWORD is required. Set it only for the seed command and do not commit it.',
    )
  }

  const result = await seedAdminUser({ email, name, password })
  const action = result.created ? 'created' : 'already exists'

  console.log(`Admin account ${action}: ${result.email}`)
} finally {
  db.$client.close()
}
