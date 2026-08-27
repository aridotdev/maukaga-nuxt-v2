import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/libsql/node'
import * as schema from './schema'

type AdminCacheDb = ReturnType<typeof drizzle<typeof schema>>

let db: AdminCacheDb | null = null
let dbPromise: Promise<AdminCacheDb> | null = null

export async function useAdminCacheDb() {
  if (db) return db

  dbPromise ||= createAdminCacheDb().catch((error) => {
    dbPromise = null
    throw error
  })

  db = await dbPromise
  return db
}

async function createAdminCacheDb() {
  const sqlitePath = resolve(process.cwd(), '.data/admin-cache.sqlite')
  mkdirSync(dirname(sqlitePath), { recursive: true })

  const database = drizzle({
    connection: {
      url: 'file:.data/admin-cache.sqlite'
    },
    schema
  })

  await database.run('PRAGMA journal_mode = WAL')
  await database.run('PRAGMA foreign_keys = ON')
  await ensureAdminCacheSchema(database)

  return database
}

async function ensureAdminCacheSchema(database: AdminCacheDb) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS pengajuan (
      id_pengajuan TEXT PRIMARY KEY,
      timestamp_submit TEXT,
      nama TEXT,
      bagian_cabang TEXT,
      pemilik TEXT,
      alasan_pengajuan TEXT,
      tanggal_form TEXT,
      catatan_tambahan TEXT,
      jumlah_item INTEGER,
      status TEXT,
      raw_json TEXT NOT NULL,
      detail_json TEXT,
      sheet_updated_at TEXT,
      cached_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS pengajuan_items (
      id TEXT PRIMARY KEY,
      id_pengajuan TEXT NOT NULL,
      no_item TEXT,
      model TEXT,
      produk TEXT,
      nomor_seri TEXT,
      keputusan_item TEXT,
      raw_json TEXT NOT NULL,
      cached_at TEXT NOT NULL,
      FOREIGN KEY (id_pengajuan) REFERENCES pengajuan(id_pengajuan) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      rows_fetched INTEGER DEFAULT 0,
      rows_changed INTEGER DEFAULT 0,
      error TEXT
    )`,
    'CREATE INDEX IF NOT EXISTS idx_pengajuan_timestamp ON pengajuan(timestamp_submit)',
    'CREATE INDEX IF NOT EXISTS idx_pengajuan_status ON pengajuan(status)',
    'CREATE INDEX IF NOT EXISTS idx_pengajuan_search ON pengajuan(nama, bagian_cabang, pemilik, id_pengajuan)',
    'CREATE INDEX IF NOT EXISTS idx_pengajuan_items_serial ON pengajuan_items(nomor_seri)',
    'CREATE INDEX IF NOT EXISTS idx_pengajuan_items_pengajuan ON pengajuan_items(id_pengajuan)'
  ]

  for (const statement of statements) {
    await database.run(statement)
  }
}
