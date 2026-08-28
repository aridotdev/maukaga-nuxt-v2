export const DEFAULT_DATABASE_URL = 'file:.data/maukaga.db'

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return (env.DATABASE_URL || env.NUXT_DATABASE_URL || DEFAULT_DATABASE_URL).trim()
}
