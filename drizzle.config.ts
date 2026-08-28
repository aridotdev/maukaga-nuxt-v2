import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
import { ensureDatabaseDirectory, resolveDatabaseUrl } from './config/database'

const databaseUrl = resolveDatabaseUrl()
ensureDatabaseDirectory(databaseUrl)

export default defineConfig({
  schema: './server/database/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: databaseUrl,
  },
  breakpoints: true,
})