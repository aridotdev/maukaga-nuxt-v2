import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const pengajuan = sqliteTable('pengajuan', {
  idPengajuan: text('id_pengajuan').primaryKey(),
  timestampSubmit: text('timestamp_submit'),
  nama: text('nama'),
  bagianCabang: text('bagian_cabang'),
  pemilik: text('pemilik'),
  alasanPengajuan: text('alasan_pengajuan'),
  tanggalForm: text('tanggal_form'),
  catatanTambahan: text('catatan_tambahan'),
  jumlahItem: integer('jumlah_item'),
  status: text('status'),
  rawJson: text('raw_json').notNull(),
  detailJson: text('detail_json'),
  sheetUpdatedAt: text('sheet_updated_at'),
  cachedAt: text('cached_at').notNull()
}, table => [
  index('idx_pengajuan_timestamp').on(table.timestampSubmit),
  index('idx_pengajuan_status').on(table.status),
  index('idx_pengajuan_search').on(table.nama, table.bagianCabang, table.pemilik, table.idPengajuan)
])

export const pengajuanItems = sqliteTable('pengajuan_items', {
  id: text('id').primaryKey(),
  idPengajuan: text('id_pengajuan')
    .notNull()
    .references(() => pengajuan.idPengajuan, { onDelete: 'cascade' }),
  noItem: text('no_item'),
  model: text('model'),
  produk: text('produk'),
  nomorSeri: text('nomor_seri'),
  keputusanItem: text('keputusan_item'),
  rawJson: text('raw_json').notNull(),
  cachedAt: text('cached_at').notNull()
}, table => [
  index('idx_pengajuan_items_serial').on(table.nomorSeri),
  index('idx_pengajuan_items_pengajuan').on(table.idPengajuan)
])

export const syncLog = sqliteTable('sync_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  status: text('status').notNull(),
  source: text('source').notNull(),
  rowsFetched: integer('rows_fetched').default(0),
  rowsChanged: integer('rows_changed').default(0),
  error: text('error')
})
