import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createClient } from '@libsql/client'

function loadMigration(): string {
  const migrationsRoot = join(process.cwd(), 'server/database/migrations')
  const migrationDirectory = readdirSync(migrationsRoot)
    .filter((entry) => entry !== 'meta')
    .sort()
    .at(-1)

  assert.ok(migrationDirectory, 'A generated database migration is required')

  return readFileSync(
    join(migrationsRoot, migrationDirectory, 'migration.sql'),
    'utf8',
  )
}

async function createTestDatabase() {
  const client = createClient({ url: 'file::memory:' })
  const statements = loadMigration()
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await client.execute(statement)
  }

  return client
}

test('unified schema creates domain tables and keeps serial keys globally unique', async () => {
  const client = await createTestDatabase()

  const tables = await client.execute(
    "select name from sqlite_master where type = 'table' order by name",
  )
  const tableNames = tables.rows.map((row) => String(row.name))

  assert.ok(tableNames.includes('pengajuan'))
  assert.ok(tableNames.includes('pengajuan_files'))
  assert.ok(tableNames.includes('audit_log'))
  assert.ok(tableNames.includes('print_batches'))
  assert.ok(tableNames.includes('shipping_batches'))
  assert.ok(!tableNames.includes('archive_files'))
  assert.ok(!tableNames.includes('sync_log'))
  assert.ok(!tableNames.includes('sync_meta'))

  await client.execute({
    sql: `
      insert into pengajuan (
        id_pengajuan,
        nama,
        bagian_cabang,
        pemilik,
        alasan_pengajuan,
        tanggal_form,
        status
      ) values (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      'KG-20260913-0001',
      'Test Schema',
      'Cabang Test',
      'Pemilik Test',
      'Validasi schema',
      '2026-09-13',
      'Baru',
    ],
  })

  await client.execute({
    sql: `
      insert into pengajuan_items (
        pengajuan_id,
        no_item,
        model,
        model_normalized,
        nomor_seri,
        nomor_seri_normalized
      ) values (?, ?, ?, ?, ?, ?)
    `,
    args: [1, 1, 'MODEL-1', 'MODEL-1', 'SERIAL-1', 'SERIAL-1'],
  })

  await assert.rejects(
    client.execute({
      sql: `
        insert into pengajuan_items (
          pengajuan_id,
          no_item,
          model,
          model_normalized,
          nomor_seri,
          nomor_seri_normalized
        ) values (?, ?, ?, ?, ?, ?)
      `,
      args: [1, 2, 'MODEL-1', 'MODEL-1', 'SERIAL-1', 'SERIAL-1'],
    }),
  )

  await client.execute({
    sql: 'update pengajuan set deleted_at = unixepoch() * 1000 where id = ?',
    args: [1],
  })

  await assert.rejects(
    client.execute({
      sql: `
        insert into pengajuan_items (
          pengajuan_id,
          no_item,
          model,
          model_normalized,
          nomor_seri,
          nomor_seri_normalized
        ) values (?, ?, ?, ?, ?, ?)
      `,
      args: [1, 2, 'MODEL-1', 'MODEL-1', 'SERIAL-1', 'SERIAL-1'],
    }),
  )
})
