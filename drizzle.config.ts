import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
import { resolveDatabaseUrl } from './config/database'

export default defineConfig({
  schema: './server/database/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: resolveDatabaseUrl()
  },
  breakpoints: true
})
