import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import type { MaukagaDatabase } from '../../server/database'

let schemaSql: string | undefined

export async function initializeDashboardTestDatabase(database: MaukagaDatabase): Promise<void> {
  // The checked-in migrations lack the initial schema; generate test DDL without changing them.
  schemaSql ??= execFileSync(process.execPath, [
    join(process.cwd(), 'node_modules/drizzle-kit/bin.cjs'),
    'export',
    '--dialect=sqlite',
    '--schema=./server/database/schema/index.ts',
  ], { encoding: 'utf8' })

  await database.$client.executeMultiple(schemaSql)
}
