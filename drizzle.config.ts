import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/utils/admin-cache/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: 'file:.data/admin-cache.sqlite'
  }
})
