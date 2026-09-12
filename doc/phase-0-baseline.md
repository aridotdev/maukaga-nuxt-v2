# Baseline Fase 0 - Inventarisasi MAUKAGA

Dokumen ini mencatat hasil baseline sebelum migrasi MAUKAGA ke aplikasi
fullstack Nuxt tunggal. Baseline ini menjadi acuan Fase 1 dan fase berikutnya.

Tanggal baseline: 12 September 2026

## 1. Keputusan Scope Overhaul Pertama

- Jalur utama pembuatan pengajuan adalah form manual di aplikasi.
- Form manual harus dapat menambahkan satu atau beberapa item.
- Lampiran pendukung PDF/JPG diunggah langsung pada alur pembuatan pengajuan.
- Status awal pengajuan baru adalah `Baru`.
- Import Excel bukan dependency overhaul pertama dan ditunda sampai workflow
  manual, upload file, review, cetak, pengiriman, backup, dan smoke test stabil.
- Konsep sumber data `Active`, `Local`, `archive`, dan `sync` hanya dicatat
  sebagai utang migrasi; konsep tersebut tidak boleh dibawa ke desain target.

## 2. Status Worktree

Sebelum pekerjaan Fase 0 dimulai, `git status --short` menunjukkan:

```text
 M doc/prd.md
```

Perubahan pada `doc/prd.md` adalah perubahan yang sudah ada sebelumnya dan
tidak disentuh oleh Fase 0. Fase ini tidak melakukan perubahan destruktif pada
kode runtime.

## 3. Inventarisasi Route Nuxt

### Route publik dan alur lama

| Route | Kondisi saat ini | Tindak lanjut target |
| --- | --- | --- |
| `/` | Portal publik dengan CTA `Buat Permintaan Baru` dan `Cek Status Pengajuan`. | ubah menjadi Dynamic Redirect Gate untuk mengecek status login dan role pengguna, lalu melempar mereka ke halaman spesifik |
| `/new` | Form manual lama untuk membuat draft, mengambil master model, dan mencetak form fisik. Memakai `saveDraftPengajuan`. | Jadikan referensi field dan aturan bisnis; alur target perlu dipindahkan ke form admin dengan submit langsung. masukan  menjadi ke menu `pengajuan/new` |
| `/final-submit` | Memuat draft berdasarkan ID/token, menerima hardcopy PDF dan foto bukti JPG, lalu mengubah draft menjadi status final `Baru`. | hapus file ini, karena tidak ada lagi proses ini karena semua pengajuan sudah dilakukan semuanya satu user saat buat pengajuan |
| `/print-ulang` | Memuat draft/form untuk cetak ulang. Saat ini memakai `useAppsScriptApi` dan action `getPengajuanForPrint`. | hapus ini karena sudah tidak digunakan lagi |
| `/check-status` | Pengecekan status berdasarkan nomor seri melalui action GAS `checkPengajuanStatusBySerial` atau `checkPengajuanStatus`. | hapus ini karena sudah tidak digunakan lagi karena bisa dilihat di dashboard admin |
| `/panduan` | Panduan untuk workflow draft, cetak form fisik, tanda tangan, dan final submit. | hapus ini karena sudah tidak digunakan lagi  |
| `/coba` | Halaman prototype/demo dengan data statis dan visual dashboard. | hapus ini karena sudah tidak digunakan lagi  |

### Route autentikasi dan dashboard

| Route | Kondisi saat ini | Tindak lanjut target |
| --- | --- | --- |
| `/login`, `/confirm`, `/403` | Login, aktivasi undangan, dan forbidden page. | Pertahankan sebagai bagian auth Better Auth. |
| `/dashboard` dan `/dashboard/index` | Shell dan home dashboard admin. Masih menerima source `active/archive`. | Alihkan ke `/api/dashboard` dan hapus source switcher. |
| `/dashboard/pengajuan`, `/dashboard/pengajuan/[idPengajuan]` | Daftar/detail pengajuan, edit, delete, status, keputusan item, dan file. Masih bercabang ke active/archive. | Alihkan ke API unified dan file route aplikasi. |
| `/dashboard/cetak-kartu` | Antrean cetak dan jenis kartu `Local`/`Import`; data active atau local tergantung source. | Pertahankan workflow cetak, hapus source data split. `Local`/`Import` tetap hanya jika benar-benar kategori jenis kartu. |
| `/dashboard/cetak-label-pengiriman` | Antrean dan penandaan pengiriman; memakai active action API. | Alihkan ke endpoint shipping unified. |
| `/dashboard/settings/product-name` | Master model/produk dan review model; memakai active action API. | Pertahankan fitur master, alihkan ke service aplikasi. |
| `/dashboard/settings/layout-kartu` | CRUD layout cetak melalui endpoint admin. | Pertahankan dan pastikan tetap memakai repository/service lokal. |
| `/dashboard/settings/members`, `/dashboard/settings/security` | Manajemen admin dan password; security masih menjelaskan GAS/sync. | Tetapkan auth/members ke sistem better auth  |
| `/dashboard/settings/sync` | UI manual sync arsip ke SQLite dan status file. | Hapus dari production target bersama endpoint dan util sync. |

Middleware dashboard saat ini adalah `auth-guard` dan `role-guard`. Route
target pembuatan manual perlu memakai middleware yang sama.

## 4. Inventarisasi Composable dan Client API

| Module | Penggunaan saat ini | Status migrasi |
| --- | --- | --- |
| `app/composables/useAppsScriptApi.ts` | Client langsung ke URL Google Apps Script. Dipakai `/check-status` dan `/print-ulang`. | Hapus setelah endpoint unified tersedia. |
| `app/composables/useActiveApi.ts` | Client ke `/api/active/actions/[action]` dengan bearer session. Dipakai dashboard review, master produk, cetak, dan pengiriman. | Ganti dengan client API unified berbasis endpoint domain. |
| `app/composables/useActiveQuery.ts` | Cache/dedupe action API active dan invalidation global `active-action-invalidations`. | Pertahankan pola cache bila perlu, tetapi rename dan lepaskan dari active action. |
| `app/composables/useDashboardData.ts` | Tipe dan query dashboard/list/chart dengan `DashboardDataSource` serta path active/archive. | Refactor menjadi data dari database unified tanpa parameter source. |
| `app/composables/useDashboardDataSource.ts` | Membaca/mengubah query `source`; memetakan `local` menjadi `archive`. | Hapus beserta source switcher. |
| `app/composables/useAdminBffApi.ts` | Wrapper authenticated API dan cache; juga berisi `useArchiveSync`, `useLocalSync`, dan status sync. | Pertahankan wrapper generik jika diperlukan; keluarkan seluruh sync/archive API. |
| `app/composables/usePengajuanApi.ts` | Client ke `/api/pengajuan/actions/[action]` untuk draft, model, dan final submit. | Pecah menjadi endpoint form manual, model, dan file; endpoint action lama hanya sementara. |
| `app/composables/usePengajuanDetail.ts` | Detail/mutasi pengajuan dengan cabang active/archive dan fallback path arsip/Drive. | Refactor ke detail dan mutation API unified; gunakan file route lokal. |
| `app/composables/useWarrantyPrintQueue.ts` | State queue generik, tetapi dependency `useActiveApi` dan pesan backend active. | Pertahankan state machine; ganti API client dan terminology. |
| `app/composables/useReviewProductQueue.ts` | Queue review produk melalui `useActiveQuery`. | Pindahkan ke endpoint model-product unified. |
| `app/composables/useDraftReferenceStorage.ts` | Menyimpan ID/resume token draft di localStorage browser. | Hanya dipertahankan bila compatibility workflow draft lama diperlukan; tidak menjadi syarat form admin target. |

Komponen yang langsung terpengaruh oleh refactor client antara lain:

- `app/layouts/dashboard.vue`
- `app/components/dashboard/DashboardSourceSwitcher.vue`
- `app/components/home/HomeStats.vue`
- `app/components/home/HomeChart.client.vue`
- `app/components/home/HomePengajuan.vue`
- `app/components/home/HomeReviewProductName.vue`
- `app/components/print/CetakKartuStats.vue`
- `app/components/print/KartuGaransi.vue`
- `app/components/print/LabelPengiriman.vue`

## 5. Inventarisasi Endpoint Nitro

### Endpoint source split dan integrasi lama

| Endpoint saat ini | Pemilik saat ini | Target/migrasi |
| --- | --- | --- |
| `/api/active/actions/[action]` | `active-gas-service` -> `active-gas-repository` -> GAS | Pecah menjadi endpoint dashboard, model, pengajuan, cetak, dan pengiriman unified. |
| `/api/active/dashboard` | GAS | Ganti `/api/dashboard`. |
| `/api/active/chart` | GAS | Ganti `/api/dashboard/chart`. |
| `/api/active/pengajuan` | GAS | Ganti `/api/pengajuan`. |
| `/api/active/pengajuan/[idPengajuan]` | GAS | Ganti `/api/pengajuan/[idPengajuan]`. |
| `/api/active/pengajuan/[idPengajuan]/update` | GAS | Ganti endpoint update unified. |
| `/api/active/pengajuan/[idPengajuan]/status` | GAS | Ganti endpoint status unified. |
| `/api/active/pengajuan/[idPengajuan]/item-decision` | GAS | Ganti endpoint keputusan item unified. |
| `/api/active/pengajuan/[idPengajuan]/items-decision` | GAS | Ganti endpoint keputusan banyak item unified. |
| `/api/active/pengajuan/[idPengajuan]/delete` | GAS | Ganti endpoint delete unified. |
| `/api/active/pengajuan/bulk-status` | GAS | Ganti endpoint bulk status unified. |
| `/api/active/pengajuan/[idPengajuan]/file` | GAS/Drive | Ganti route `/api/pengajuan/[idPengajuan]/files/[fileId]`. |
| `/api/archive/**` | `archive-service` dan `archive-repository` | Hapus setelah seluruh pembacaan memakai database unified. |
| `/api/local/sync`, `/api/local/sync-status` | `archive-service` dan `archive-sync` | Hapus; tidak ada sync pada arsitektur target. |
| `/api/local/warranty-print-queue` | local warranty queue service/repository | Ganti `/api/warranty-print-queue`. |

### Endpoint yang sudah lokal atau dipertahankan sementara

| Endpoint saat ini | Kondisi |
| --- | --- |
| `/api/auth/[...all]` | Pertahankan sebagai Better Auth. |
| `/api/admin/**` | Pertahankan, audit session/role dan payload tetap dilakukan pada fase API unified. |
| `/api/pengajuan/actions/[action]` | Saat ini melayani `getModelProduk`, draft save/load/status, dan `submitDraftPengajuan`. Pertahankan sementara untuk compatibility, lalu tambahkan `/api/pengajuan/create` untuk form admin target dan pecah action lama setelah UI berpindah. |

### Kontrak endpoint target yang perlu dibangun

- `GET /api/dashboard`
- `GET /api/dashboard/chart`
- `GET /api/pengajuan`
- `GET /api/pengajuan/[idPengajuan]`
- `POST /api/pengajuan/create`
- `POST /api/pengajuan/[idPengajuan]/update`
- `POST /api/pengajuan/[idPengajuan]/status`
- `POST /api/pengajuan/[idPengajuan]/item-decision`
- `POST /api/pengajuan/[idPengajuan]/items-decision`
- `POST /api/pengajuan/[idPengajuan]/delete`
- `POST /api/pengajuan/bulk-status`
- `POST /api/pengajuan/[idPengajuan]/files`
- `GET /api/pengajuan/[idPengajuan]/files/[fileId]`
- `GET /api/model-produk`
- `GET /api/model-produk/review`
- `GET /api/warranty-print-queue`
- `GET /api/shipping-label-queue`

Semua endpoint target harus memvalidasi Better Auth session dan role di server.

## 6. Inventarisasi Repository, Service, Util, Schema, dan Test

### Kandidat dipertahankan dan direfactor

- `server/repositories/pengajuan-repository.ts`: sudah memiliki validasi field,
  normalisasi model, deteksi duplikasi, generator ID, transaksi draft, serta
  validasi dan penyimpanan PDF/JPG. Saat ini masih terikat draft `Menunggu
  Upload`, `archiveFiles`, `local-archive`, dan schema GAS.
- `server/repositories/local-warranty-print-queue-repository.ts` dan
  `server/services/local-warranty-print-queue-service.ts`: logika antrean
  cetak berbasis database dapat direfactor menjadi queue unified.
- `server/repositories/config-repository.ts`,
  `print-layouts-repository.ts`, `admin-auth-repository.ts`, dan
  `admin-members-repository.ts`.
- `server/services/admin-auth-service.ts`, `admin-config-service.ts`,
  `admin-members-service.ts`, `admin-password-service.ts`, dan
  `admin-print-layouts-service.ts`.
- `server/database/schema/pengajuan.ts`,
  `pengajuan-items.ts`, `status-log.ts`, `model-produk.ts`,
  `print-batch.ts`, `print-layouts.ts`, konfigurasi, email opsional, dan
  Better Auth.

### Kandidat dihapus atau dimigrasikan

- `server/repositories/active-gas-repository.ts`
- `server/services/active-gas-service.ts`
- `server/repositories/archive-repository.ts`
- `server/services/archive-service.ts`
- `server/utils/gas-bridge.ts`
- `server/utils/archive-dashboard.ts`
- `server/utils/archive-sync.ts`
- `server/utils/local-archive.ts`
- `server/schemas/gas-archive.ts`
- `server/database/schema/archive-files.ts`
- `server/database/schema/sync-log.ts`
- `server/database/schema/sync-meta.ts`
- `app/components/dashboard/DashboardSourceSwitcher.vue`
- seluruh route API `/active`, `/archive`, dan `/local` setelah compatibility
  window selesai.

### Test saat ini

| Test | Fokus saat ini | Rencana |
| --- | --- | --- |
| `tests/server/active-gas-repository.test.ts` | Request/signature ke GAS. | Hapus setelah unified repository tersedia. |
| `tests/server/active-gas-service.test.ts` | Auth dan forwarding action GAS. | Hapus setelah API/service unified tersedia. |
| `tests/server/archive-service.test.ts` | Dashboard archive dan archive sync. | Hapus/migrasikan bagian read ke test unified; hapus sync test. |
| `tests/server/local-warranty-print-queue-repository.test.ts` | Queue database dengan nama local. | Rename/migrasikan menjadi queue unified. |
| `tests/server/pengajuan-repository.test.ts` | Draft, model, duplicate, dan generator ID saat ini. | Reuse untuk form manual/create service; tambahkan audit, status awal `Baru`, dan actor. |
| `tests/server/pengajuan-final-submit.test.ts` | Upload PDF/JPG dari draft ke storage lokal. | Reuse validasi file dan rollback; sesuaikan schema `pengajuan_files`. |
| `tests/server/admin-*.test.ts` | Auth, members, layout admin. | Pertahankan dan sesuaikan bila kontrak endpoint berubah. |

## 7. Kontrak Frontend yang Perlu Dipertahankan Sementara

### Form pengajuan

Payload yang sudah dipakai alur `/new` dan `/final-submit`:

```text
nama
bagianCabang
pemilik
tanggalForm
alasanPengajuan
catatanTambahan
items[]
```

Setiap item saat ini memiliki:

```text
produk
model
nomorSeri
```

Payload file lama menambahkan:

```text
fileBase64
fileExtension
fileMimeType
evidenceAttachments[]
```

Kontrak target sebaiknya tetap mempertahankan nama field bisnis tersebut saat
UI dipindahkan, tetapi request form admin perlu dipisahkan dari mekanisme draft
dan resume token. File sebaiknya diproses sebagai multipart/FormData atau
mekanisme upload server yang setara, bukan menjadikan Base64 sebagai kontrak
domain permanen.

### Dashboard dan detail

Field yang sudah digunakan komponen dashboard:

- ringkasan: `total`, `totalItems`, `baru`, `disetujui`, `ditolak`, `diprint`,
  `dikirim`, `selesai`, `itemDisetujui`, `itemDitolak`;
- row: `idPengajuan`, `timestampSubmit`, `nama`, `bagianCabang`, `pemilik`,
  `alasanPengajuan`, `tanggalForm`, `catatanTambahan`, `jumlahItem`, `status`,
  dan `items`;
- item: `noItem`, `model`, `nomorSeri`, `keputusanItem`;
- detail file: `fileHardCopyUrl`, `evidenceAttachmentUrls`, ID/metadata file,
  serta riwayat status;
- queue cetak/kirim: ID pengajuan, item, produk, model, nomor seri, jenis kartu,
  status cetak, status kirim, cabang, dan waktu submit.

### Hak akses

- `admin`: full access.
- `qrcc`: review item, status operasional, cetak, dan pengiriman sesuai policy.
- `management`: read-only dashboard, daftar, detail, laporan, dan file sesuai
  policy.

## 8. Aturan Bisnis yang Harus Dipindahkan ke Service Unified

- ID pengajuan dibuat server-side dengan format `KG-YYYYMMDD-0001` dan harus
  aman saat ada pembuatan paralel.
- Status awal pembuatan manual adalah `Baru`; `Menunggu Upload` hanya aturan
  compatibility workflow draft lama dan tidak boleh menjadi status jalur baru.
- Minimal satu item dan maksimal mengikuti `NUXT_PUBLIC_MAX_ITEMS`.
- Model dan nomor seri wajib diisi; nomor seri diperlakukan sebagai teks.
- Duplikasi kombinasi model + nomor seri ditolak di dalam satu form dan terhadap
  pengajuan yang sudah tersimpan.
- Model terverifikasi dari master mengisi nama produk; model yang belum dikenal
  masuk `needs_review` sesuai kebijakan bisnis.
- Field tanggal form, termasuk aturan rentang tanggal yang saat ini dipakai,
  divalidasi server-side dan tidak hanya mengandalkan UI.
- Lampiran PDF/JPG divalidasi MIME type, ekstensi, ukuran, checksum, nama aman,
  dan path storage. File sementara harus dibersihkan saat transaksi gagal.
- Hardcopy PDF dan foto bukti JPG mengikuti batas jumlah/ukuran yang
  dikonfigurasi; kebijakan wajib/opsional harus ditetapkan sebelum Fase 7.
- Pembuatan pengajuan, item, file metadata, status log, dan audit log harus
  memiliki perilaku atomik atau cleanup yang jelas.
- Semua perubahan status mencatat status lama, status baru, actor, waktu, dan
  catatan; penolakan membutuhkan alasan.
- Keputusan item memengaruhi kelayakan status pengajuan, cetak, dan pengiriman.
- Antrean cetak hanya menerima item yang sudah disetujui dan valid menurut
  master model.
- Data `Selesai` tetap berada di database unified dan tetap dapat dicari.
- Semua halaman dashboard dan akses file memerlukan session Better Auth serta
  validasi role server-side.
- Operasi penting admin dicatat pada audit log.

## 9. Gap Schema dan Data

| Area | Kondisi saat ini | Gap untuk target |
| --- | --- | --- |
| `pengajuan` | Field identitas, pemohon, cabang, tanggal, status, draft token, dan timestamp sudah ada. | Tambahkan metadata actor/sumber pembuatan bila dibutuhkan; normalkan enum agar status baru memakai `Baru`, bukan draft lama. |
| `pengajuan_items` | Field item, model, serial, keputusan, review model, cetak, kirim, dan batch sudah ada. | Tegaskan constraint/validasi kunci bisnis dan field wajib form manual. |
| File pengajuan | Tabel `archive_files` sudah menyimpan nama, path, MIME, ukuran, checksum, dan status download. | Migrasikan menjadi `pengajuan_files`; hilangkan makna Drive/archive dan tambahkan metadata upload/owner bila diperlukan. |
| `status_log` | Sudah punya actor string, status lama/baru, catatan, item, dedupe key, dan timestamp. | Pakai untuk pembuatan manual serta pastikan actor konsisten dengan session. |
| `audit_log` | Belum ada. | Tambahkan tabel dan service untuk create, update, delete, status, file, cetak, dan kirim. |
| Sequence ID | Belum ada counter/sequence; generator saat ini scan ID pada tanggal yang sama. | Tambahkan sequence harian atau mekanisme transaksi yang aman dari race condition. |
| `model_produk` | Master dan status verifikasi tersedia; `origin` `local/import` masih dipakai sebagai kategori bisnis. | Pertahankan hanya sebagai kategori bisnis bila memang diperlukan, bukan source database. |
| `print_batch` dan layout | Sudah ada. | Audit field legacy `createdAtGas`/jenis layout saat migrasi unified. |
| Better Auth | Tabel user/account/session/verification dan service auth sudah ada. | Pertahankan, lalu pastikan semua endpoint target memakainya. |
| `import_batches` | Belum ada. | Tidak diperlukan untuk overhaul pertama; tambahkan hanya saat import Excel dimulai. |
| `sync_log` dan `sync_meta` | Masih ada dan dipakai archive sync. | Migrasikan/hapus bersama sync runtime. |

## 10. Acceptance Fase 0

- [x] Daftar route dan fitur terdampak tersedia.
- [x] Pemetaan endpoint lama ke endpoint target tersedia.
- [x] Aturan bisnis yang harus dipertahankan tersedia.
- [x] Gap schema dan kebutuhan workflow manual tersedia.
- [x] Status worktree awal tercatat.
- [x] Tidak ada perubahan destruktif pada kode runtime.

