# Plan Implementasi Hybrid Sync Admin: Google Sheet ke SQLite Lokal

## Tujuan

Buat admin localhost terasa cepat dengan membaca data dari SQLite lokal, sementara Google Sheet tetap menjadi sumber utama data. Alur CS tidak diubah: CS tetap submit langsung ke Google Sheet melalui endpoint/Apps Script yang sudah ada.

## Prinsip Utama

- Jangan ubah flow submit CS di `apps/cs-web` atau halaman CS shared seperti `app/pages/new.vue`, `app/pages/final-submit.vue`, `app/pages/print-ulang.vue`, dan `app/pages/check-status.vue`.
- Hybrid sync hanya berlaku untuk admin.
- Admin membaca list, dashboard, search, filter, detail, dan queue dari SQLite lokal jika data tersedia.
- Google Sheet tetap source of truth.
- Operasi tulis admin tetap dikirim ke Google Sheet/Apps Script dulu. Setelah sukses, SQLite lokal dipatch atau disync ulang untuk data terkait.
- Jika sync Google Sheet lambat/error, admin tetap bisa membuka data terakhir dari SQLite dengan status "stale" atau "sync gagal".

## Gambaran Arsitektur

1. CS submit langsung ke Google Sheet seperti sekarang.
2. Admin membuka localhost.
3. Admin API lokal membaca SQLite untuk response cepat.
4. Background sync admin mengambil data terbaru dari Google Sheet/Apps Script.
5. Hasil sync disimpan/upsert ke SQLite.
6. UI admin menampilkan status sync kecil: terakhir sync, sedang sync, atau gagal sync.

Alur baca admin:

```txt
Admin UI -> Nuxt server API -> SQLite lokal -> response cepat
                              -> trigger background sync bila data stale
```

Alur sync:

```txt
Background sync -> Apps Script/Google Sheet -> normalize -> upsert SQLite -> update sync_meta
```

Alur tulis admin:

```txt
Admin UI -> Apps Script/Google Sheet -> sukses -> patch SQLite atau sync id terkait
```

## Dependency yang Disarankan

Gunakan SQLite server-side saja, bukan di browser.

Gunakan Drizzle ORM untuk akses database agar schema, query, dan upsert lebih typed dan mudah dirawat.

Dependency runtime:

- `drizzle-orm`
- `better-sqlite3`

Dependency dev:

- `drizzle-kit`
- `@types/better-sqlite3`

Catatan:

- Karena `apps/admin-web` memakai Nitro preset `node-server`, SQLite lokal cocok dijalankan di mode localhost/server Node.
- Simpan database di path lokal yang tidak ikut commit, misalnya `.data/admin-cache.sqlite`.
- Tambahkan `.data/` ke `.gitignore` jika belum ada.
- Tambahkan `drizzle.config.ts` untuk generate/push migration SQLite.
- Untuk implementasi awal lokal, boleh pakai `drizzle-kit push` agar cepat; jika schema mulai stabil, gunakan migration file versioned.

Script yang disarankan di `package.json` root atau `apps/admin-web/package.json`:

```json
{
  "db:generate": "drizzle-kit generate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
}
```

## Struktur File yang Disarankan

Tambahkan area server khusus cache admin:

```txt
server/utils/admin-cache/db.ts
server/utils/admin-cache/schema.ts
server/utils/admin-cache/sync.ts
server/utils/admin-cache/normalizers.ts
server/utils/admin-cache/queries.ts
server/api/admin-cache/dashboard.get.ts
server/api/admin-cache/pengajuan.get.ts
server/api/admin-cache/pengajuan/[id].get.ts
server/api/admin-cache/sync.post.ts
server/api/admin-cache/sync-status.get.ts
drizzle.config.ts
drizzle/
```

Atau jika ingin tetap satu pintu dengan pola sekarang:

```txt
server/api/admin-action.post.ts
```

bisa ditambah action khusus seperti:

```txt
adminCacheDashboard
adminCachePengajuanList
adminCachePengajuanDetail
adminCacheSync
adminCacheSyncStatus
```

Namun rekomendasi lebih rapi: gunakan route `/api/admin-cache/*` agar fungsi cache tidak tercampur dengan action user management.

## Schema Drizzle SQLite Awal

Definisikan schema di `server/utils/admin-cache/schema.ts` memakai Drizzle SQLite core.

```ts
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
  nomorSeri: text('nomor_seri'),
  keputusanItem: text('keputusan_item'),
  rawJson: text('raw_json').notNull(),
  cachedAt: text('cached_at').notNull()
}, table => [
  index('idx_pengajuan_items_serial').on(table.nomorSeri),
  index('idx_pengajuan_items_pengajuan').on(table.idPengajuan)
])
```

Opsional untuk debugging:

```ts
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
```

Contoh `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/utils/admin-cache/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: '.data/admin-cache.sqlite'
  }
})
```

Contoh koneksi di `server/utils/admin-cache/db.ts`:

```ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let db: ReturnType<typeof drizzle> | null = null

export function useAdminCacheDb() {
  if (db) return db

  const sqlite = new Database('.data/admin-cache.sqlite')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  db = drizzle(sqlite, { schema })
  return db
}
```

## Strategi Sync Hybrid

### Saat admin dibuka

1. UI admin request data ke API lokal.
2. API lokal langsung return data SQLite.
3. API cek `sync_meta.last_success_at`.
4. Jika data stale, API trigger background sync tanpa menunggu sync selesai.
5. UI bisa refresh otomatis setelah sync selesai atau saat user klik refresh.

TTL awal yang disarankan:

- Dashboard summary: 30-60 detik.
- List pengajuan: 30-60 detik.
- Detail pengajuan: 15-30 detik.
- Queue cetak/kirim: 15-30 detik.

### Manual sync

Tambahkan tombol kecil di admin:

- "Sync"
- disabled saat sync sedang berjalan
- setelah sukses panggil `refreshNuxtData()` atau composable refresh existing

Manual sync berguna saat user tahu baru ada submit CS dan ingin langsung melihat data terbaru.

### Background sync

Buat satu mekanisme lock agar tidak ada sync paralel:

```txt
if sync_in_progress:
  return current status
else:
  start sync
```

Simpan status di memory dan di `sync_meta`, misalnya:

- `sync_in_progress`
- `last_started_at`
- `last_success_at`
- `last_error_at`
- `last_error_message`
- `last_row_count`

## Sumber Data Sync

Tahap awal paling aman: reuse Apps Script action yang sudah dipakai admin, misalnya:

- `getDashboard`
- `getPengajuanList`
- `getDetail`
- `getWarrantyPrintQueue`
- `getShippingLabelQueue`

Jika Apps Script sudah punya pagination, sync bisa ambil per halaman:

```txt
page 1, pageSize 100
page 2, pageSize 100
...
stop ketika loaded >= totalRows
```

Jika nanti butuh lebih cepat, baru tambahkan action Apps Script khusus:

```txt
syncAdminSnapshot
syncPengajuanChangedSince
```

Response ideal untuk sync:

```ts
type SyncSnapshotResponse = {
  rows: DashboardRow[]
  totalRows: number
  sourceUpdatedAt?: string
}
```

## Incremental Sync

Versi 1 boleh full sync bertahap karena lebih mudah dan aman.

Versi 2 bisa incremental:

1. Simpan `last_success_at` di SQLite.
2. Apps Script menerima parameter `changedSince`.
3. Apps Script return hanya row yang berubah sejak waktu tersebut.
4. Drizzle upsert row yang berubah ke SQLite.
5. Jika ada row deleted di Sheet, Apps Script perlu return daftar deleted id atau admin melakukan full reconcile berkala.

Rekomendasi implementasi:

- Mulai dengan full sync pagination.
- Tambahkan incremental sync setelah schema dan flow stabil.
- Jadwalkan full reconcile manual/berkala untuk mencegah cache melenceng.

## Perubahan di Composable Admin

Area yang sekarang banyak membaca Apps Script:

- `app/composables/useDashboardData.ts`
- `app/composables/usePengajuanDetail.ts`
- `app/composables/useAppSheetQuery.ts`
- halaman dashboard/pengajuan dan cetak

Target perubahan:

1. Untuk read-heavy admin, panggil endpoint lokal `/api/admin-cache/*`.
2. Untuk write/mutation, tetap panggil Apps Script seperti sekarang.
3. Setelah mutation sukses:
   - patch SQLite lokal untuk id terkait, atau
   - mark stale lalu trigger sync detail/list.

Contoh mapping:

```txt
getDashboard -> /api/admin-cache/dashboard
getPengajuanList -> /api/admin-cache/pengajuan
getDetail -> /api/admin-cache/pengajuan/:id
```

Mutation tetap ke Apps Script:

```txt
updateItemDecision -> Apps Script
updateStatus -> Apps Script
updatePengajuanAdmin -> Apps Script
deletePengajuan -> Apps Script
markWarrantyCardsPrinted -> Apps Script
markShippingLabelsShipped -> Apps Script
```

Setelah mutation sukses, jalankan:

```txt
POST /api/admin-cache/sync { mode: "changed", idPengajuan }
```

atau fallback:

```txt
POST /api/admin-cache/sync { mode: "background" }
```

## UI Admin yang Perlu Ditambahkan

Tambahkan indikator kecil di layout/dashboard:

- Terakhir sync: `10:32:12`
- Status: `up to date`, `syncing`, `stale`, atau `failed`
- Tombol icon refresh/manual sync

Jangan jadikan ini blocking UI. Data tetap tampil dari cache lokal.

## Error Handling

Jika SQLite kosong dan Google Sheet gagal:

- tampilkan empty/error state seperti sekarang
- berikan pesan: "Cache lokal belum tersedia dan sync Google Sheet gagal."

Jika SQLite ada data lama dan Google Sheet gagal:

- tetap tampilkan data SQLite
- tampilkan warning kecil: "Data lokal mungkin belum terbaru."

Jika Apps Script lambat:

- API lokal tidak menunggu lama untuk read request biasa
- sync berjalan di background
- set timeout fetch Google Sheet, misalnya 20-30 detik per batch

## Keamanan

- Endpoint admin-cache harus tetap membutuhkan session admin seperti route admin lain.
- Jangan expose path SQLite ke client.
- Token admin/Apps Script tetap server-side untuk sync jika memungkinkan.
- Jika masih perlu token dari client, validasi session dulu sebelum route cache boleh dipanggil.

## Hal yang Tidak Boleh Diubah

- Jangan ubah submit CS ke SQLite.
- Jangan ubah sumber utama data dari Google Sheet.
- Jangan ubah behavior final submit CS.
- Jangan membuat CS menunggu proses sync admin.
- Jangan membuat admin read request langsung selalu menunggu Google Sheet.

## Tahapan Implementasi

### Phase 1: Fondasi SQLite

1. Tambah dependency Drizzle SQLite.
2. Buat util koneksi database Drizzle + `better-sqlite3`.
3. Buat schema Drizzle dan konfigurasi migration.
4. Generate/push migration untuk table `sync_meta`, `pengajuan`, dan `pengajuan_items`.
5. Pastikan database lokal dibuat otomatis saat admin server start atau saat API pertama dipanggil.

### Phase 2: Sync Service

1. Buat service `syncAdminCache`.
2. Reuse Apps Script action existing untuk mengambil data.
3. Normalize response ke schema Drizzle SQLite.
4. Upsert data ke SQLite memakai Drizzle transaction.
5. Simpan status sync ke `sync_meta`.
6. Tambahkan lock agar sync tidak jalan paralel.

### Phase 3: Local Read API

1. Buat endpoint dashboard dari SQLite.
2. Buat endpoint list pengajuan dengan pagination/search/filter/sort.
3. Buat endpoint detail pengajuan dari SQLite.
4. Buat endpoint sync status.
5. Buat endpoint trigger manual sync.

### Phase 4: Integrasi Admin UI

1. Ubah read admin dari Apps Script ke local cache endpoint.
2. Pertahankan mutation admin ke Apps Script.
3. Setelah mutation sukses, invalidate local cache dan trigger background sync.
4. Tambahkan indikator sync di UI.
5. Tambahkan tombol manual sync.

### Phase 5: Verifikasi

1. Jalankan admin dengan SQLite kosong.
2. Pastikan admin bisa sync awal dari Google Sheet.
3. Pastikan reload dashboard/list/detail cepat setelah SQLite terisi.
4. Submit data dari CS seperti biasa, pastikan tidak ada file CS berubah.
5. Jalankan manual sync admin, pastikan data submit CS muncul.
6. Matikan/kacaukan koneksi Apps Script, pastikan admin tetap bisa membaca cache lama.
7. Test mutation admin: update status/item tetap masuk Google Sheet dan cache ikut update/sync.

## Risiko dan Mitigasi

- Data cache telat beberapa detik.
  - Mitigasi: tampilkan last sync dan tombol manual sync.

- Sync Apps Script terlalu berat jika full sync sering.
  - Mitigasi: TTL, pagination, lock, dan incremental sync tahap berikutnya.

- Cache tidak sama dengan Sheet setelah mutation.
  - Mitigasi: setelah mutation sukses, sync detail id terkait atau patch SQLite.

- SQLite corrupt atau terhapus.
  - Mitigasi: database bisa dibuat ulang dari Google Sheet lewat full sync.

## Acceptance Criteria

- Admin dashboard/list/detail membaca dari SQLite lokal.
- Admin tetap bisa trigger sync dari Google Sheet.
- CS tetap submit langsung ke Google Sheet tanpa perubahan behavior.
- Google Sheet tetap source of truth.
- Admin tetap usable walau sync Google Sheet sedang lambat/gagal, selama cache lokal sudah pernah terisi.
- Mutasi admin tetap tersimpan ke Google Sheet dan cache lokal ikut diperbarui setelahnya


you act as a senior software engineer joining a large unfamiliar codebase. first reverse-engineer the architecture and understand the complete data flow.

then identify:
- poor architecture decisions
- potential performance bottlenecks
- duplicated logic or code smells
- scalability issues or risk
- maintainability problems

finally provide:
- a clear architecture breakdown
- critical problems areas
- refactoring strategies
- improved productions-grade code

Do not change the existing functionality. only improve code quality, scalability, and maintainability. 


A