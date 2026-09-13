# Baseline Fase 0 - Inventarisasi dan Reset MAUKAGA

Dokumen ini mencatat hasil baseline sebelum migrasi MAUKAGA ke aplikasi
fullstack Nuxt tunggal, lalu diperbarui untuk mencatat reset file besar yang
dilakukan setelah baseline. Dokumen ini menjadi acuan kondisi awal baru untuk
Fase 1 dan fase berikutnya.

Tanggal baseline: 12 September 2026
Tanggal reset file: 13 September 2026

## 1. Keputusan Scope Overhaul Pertama

- Jalur utama pembuatan pengajuan adalah form manual di aplikasi.
- Form manual harus dapat menambahkan satu atau beberapa item.
- Hardcopy PDF wajib dan diunggah langsung pada alur pembuatan pengajuan.
- Bukti/lampiran PDF/JPG melekat pada pengajuan, bukan pada item.
- Status awal pengajuan baru adalah `Baru`.
- Tidak ada field kontak wajib pada pengajuan.
- Kombinasi model + nomor serial tidak boleh digunakan kembali, termasuk
  setelah soft delete.
- Pengajuan menggunakan soft delete dan tidak memakai konsep draft/resume.
- Keputusan item terpisah dari lifecycle pengajuan; item boleh sebagian
  `Disetujui` dan sebagian `Ditolak`.
- Jika semua item ditolak, status pengajuan tetap `Ditolak`, bukan `Selesai`.
- Histori cetak dan pengiriman disimpan per batch, termasuk pengulangan.
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

### Status setelah reset file

Setelah baseline selesai, pemilik repo menghapus modul legacy berikut secara
langsung di working tree:

| Area | Status saat ini |
| --- | --- |
| Composable | `useActiveApi`, `useActiveQuery`, `useAdminBffApi`, `useAppsScriptApi`, `useDashboardData`, `useDashboardDataSource`, `useDraftReferenceStorage`, `usePengajuanApi`, dan `usePengajuanDetail` sudah dihapus. |
| Endpoint active/archive | Seluruh file di `server/api/active/**` dan `server/api/archive/**` sudah dihapus. |
| Endpoint admin lama | Bootstrap, password, print-layouts, config, dan members lama sudah dihapus. Endpoint target akan dibangun ulang saat service unified tersedia. |
| Repository dan service | Seluruh file yang sebelumnya ada di `server/repositories/**` dan `server/services/**` sudah dihapus. |
| Util legacy | `archive-dashboard`, `archive-sync`, `gas-bridge`, dan `local-archive` sudah dihapus. |
| Test server | Seluruh test di `tests/server/**` yang tercatat di baseline sudah dihapus. |
| Sisa legacy | Sisa runtime legacy yang tercatat pada baseline sudah dihapus pada implementasi Fase 2. Dashboard sementara menjadi shell minimal sampai API/service/UI unified dibangun. |

Reset ini disengaja. Modul yang dihapus tidak boleh dipulihkan hanya untuk
memperbaiki referensi lama. Setelah implementasi Fase 2, schema database,
migration, Better Auth, login, dan dashboard shell minimal sudah bisa
diverifikasi tanpa referensi runtime ke modul draft, archive, sync, atau source
split lama.

### Status konfigurasi setelah Fase 1

Konfigurasi runtime sudah dipindahkan ke arsitektur Nuxt tunggal:

- database memakai `DATABASE_URL` atau `NUXT_DATABASE_URL`;
- storage dokumen target memakai `NUXT_PENGAJUAN_FILE_DIRECTORY`, default
  `storage/pengajuan`;
- root backup target memakai `NUXT_BACKUP_DIRECTORY`, default `storage/backups`;
- tidak ada lagi runtime config untuk Apps Script, GAS bridge, atau public
  archive path;
- file pengajuan target akan diakses melalui route server terproteksi, bukan
  melalui public file base path.

Fase 1 sudah selesai pada konfigurasi, env example, README, dan UI settings.
Setelah cleanup Fase 2, aplikasi kembali dapat diverifikasi sebagai shell
Nuxt/Better Auth minimal tanpa env layanan eksternal lama. `pnpm typecheck`,
`pnpm lint`, `pnpm test`, dan `pnpm build` berhasil pada 13 September 2026.

## 3. Inventarisasi Route Nuxt

### Route publik dan alur lama

| Route | Kondisi saat ini | Tindak lanjut target |
| --- | --- | --- |
| `/` | Portal publik dengan CTA `Buat Permintaan Baru` dan `Cek Status Pengajuan`. | ubah menjadi Dynamic Redirect Gate untuk mengecek status login dan role pengguna, lalu melempar mereka ke halaman spesifik |
| `/new` | Form manual lama untuk membuat draft, mengambil master model, dan mencetak form fisik. Memakai `saveDraftPengajuan`. | Jadikan referensi field dan aturan bisnis; alur target perlu dipindahkan ke form admin dengan submit langsung. masukan  menjadi ke menu `pengajuan/new` |
| `/final-submit` | Memuat draft berdasarkan ID/token, menerima hardcopy PDF dan foto bukti JPG, lalu mengubah draft menjadi status final `Baru`. | hapus file ini, karena tidak ada lagi proses ini karena semua pengajuan sudah dilakukan semuanya oleh satu user saat buat pengajuan |
| `/print-ulang` | Memuat draft/form untuk cetak ulang. Saat ini memakai `useAppsScriptApi` dan action `getPengajuanForPrint`. | hapus ini karena sudah tidak digunakan lagi |
| `/check-status` | Pengecekan status berdasarkan nomor seri melalui action GAS `checkPengajuanStatusBySerial` atau `checkPengajuanStatus`. | hapus ini karena sudah tidak digunakan lagi karena bisa dilihat di data table pengajuan  |
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
| `app/composables/useAppsScriptApi.ts` | Client langsung ke URL Google Apps Script. | **Sudah dihapus pada reset.** Jangan dipulihkan; halaman lama yang masih memerlukannya harus dihapus atau dialihkan. |
| `app/composables/useActiveApi.ts` | Client ke `/api/active/actions/[action]` dengan bearer session. | **Sudah dihapus pada reset.** Buat client unified baru sesuai endpoint target. |
| `app/composables/useActiveQuery.ts` | Cache/dedupe action API active dan invalidation global `active-action-invalidations`. | **Sudah dihapus pada reset.** Gunakan pola cache baru jika memang diperlukan. |
| `app/composables/useDashboardData.ts` | Tipe dan query dashboard/list/chart dengan `DashboardDataSource` serta path active/archive. | **Sudah dihapus pada reset.** Buat composable unified tanpa parameter source. |
| `app/composables/useDashboardDataSource.ts` | Membaca/mengubah query `source`; memetakan `local` menjadi `archive`. | **Sudah dihapus pada reset.** Source switcher dan query `source` juga harus dihapus dari UI. |
| `app/composables/useAdminBffApi.ts` | Wrapper authenticated API dan cache, termasuk sync/archive API. | **Sudah dihapus pada reset.** Buat wrapper API baru hanya bila benar-benar dibutuhkan. |
| `app/composables/usePengajuanApi.ts` | Client ke `/api/pengajuan/actions/[action]` untuk draft, model, dan final submit. | **Sudah dihapus pada reset.** Buat API form manual, model, dan file yang terpisah. |
| `app/composables/usePengajuanDetail.ts` | Detail/mutasi pengajuan dengan cabang active/archive dan fallback arsip/Drive. | **Sudah dihapus pada reset.** Buat detail dan mutation API unified. |
| `app/composables/useWarrantyPrintQueue.ts` | State queue generik, tetapi masih memakai `useActiveApi`. | Masih ada, tetapi rusak karena dependency lama sudah dihapus; refactor ke API queue unified. |
| `app/composables/useReviewProductQueue.ts` | Queue review produk melalui API/query lama. | Masih ada dan perlu diarahkan ke endpoint model-product unified. |
| `app/composables/useDraftReferenceStorage.ts` | Menyimpan ID/resume token draft di localStorage browser. | **Sudah dihapus pada reset.** Form admin target tidak memakai resume token draft lama. |

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
| `/api/active/**` | GAS melalui service/repository lama | **Seluruh file sudah dihapus pada reset.** Buat endpoint unified baru, bukan compatibility route. |
| `/api/archive/**` | Archive service/repository lama | **Seluruh file sudah dihapus pada reset.** Jangan hidupkan kembali; dashboard unified membaca database aplikasi. |
| `/api/local/sync`, `/api/local/sync-status` | Archive sync lama | Masih tersisa dan mengimpor service yang sudah dihapus; hapus endpoint ini. |
| `/api/local/warranty-print-queue` | Local warranty queue lama | Masih tersisa dan mengimpor service yang sudah dihapus; ganti dengan `/api/warranty-print-queue`. |

### Endpoint yang sudah lokal atau dipertahankan sementara

| Endpoint saat ini | Kondisi |
| --- | --- |
| `/api/auth/[...all]` | Pertahankan sebagai Better Auth. |
| `/api/admin/config/**`, `/api/admin/members/**` | Masih ada, tetapi service admin lama sudah dihapus; bangun ulang service/repository target dengan session/role validation. |
| `/api/admin/bootstrap`, `/api/admin/password`, `/api/admin/print-layouts/**` | **Sudah dihapus pada reset.** Buat ulang hanya sebagai endpoint target yang mengikuti PRD. |
| `/api/pengajuan/actions/[action]` | Masih ada, tetapi mengimpor repository lama yang sudah dihapus; hapus atau ganti dengan endpoint form manual/model/file unified. |

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

### Status setelah reset

Seluruh repository dan service berikut sudah dihapus pada reset dan harus
dibangun ulang hanya jika dibutuhkan oleh arsitektur target:

- `server/repositories/active-gas-repository.ts`
- `server/repositories/admin-auth-repository.ts`
- `server/repositories/admin-members-repository.ts`
- `server/repositories/archive-repository.ts`
- `server/repositories/config-repository.ts`
- `server/repositories/local-warranty-print-queue-repository.ts`
- `server/repositories/pengajuan-repository.ts`
- `server/repositories/print-layouts-repository.ts`
- `server/services/active-gas-service.ts`
- `server/services/admin-auth-service.ts`
- `server/services/admin-config-service.ts`
- `server/services/admin-members-service.ts`
- `server/services/admin-password-service.ts`
- `server/services/admin-print-layouts-service.ts`
- `server/services/archive-service.ts`
- `server/services/local-warranty-print-queue-service.ts`

Schema database yang masih tersedia dan perlu diaudit:

- `server/database/schema/pengajuan.ts`,
  `pengajuan-items.ts`, `status-log.ts`, `model-produk.ts`,
  `print-batch.ts`, `print-layouts.ts`, konfigurasi, email opsional, dan
  Better Auth.

### File legacy yang sudah dihapus pada Fase 2

- `server/schemas/gas-archive.ts`
- `server/database/schema/archive-files.ts`
- `server/database/schema/sync-log.ts`
- `server/database/schema/sync-meta.ts`
- `app/components/dashboard/DashboardSourceSwitcher.vue`
- `app/pages/dashboard/settings/sync.vue`
- seluruh route API `/local/**`
- endpoint admin lama yang menggantung ke service terhapus;
- route publik lama `/new`, `/final-submit`, `/print-ulang`, `/check-status`,
  `/panduan`, dan `/coba`;
- komponen, composable, type, dan util frontend yang hanya bergantung pada
  source split, draft, dashboard lama, cetak lama, atau demo template.

### Test historis yang sudah dihapus

| Test | Fokus saat ini | Rencana |
| --- | --- | --- |
| `tests/server/active-gas-repository.test.ts`, `active-gas-service.test.ts` | Request/signature dan forwarding action GAS. | **Sudah dihapus pada reset.** Tulis test untuk API/service unified. |
| `tests/server/archive-service.test.ts` | Dashboard archive dan archive sync. | **Sudah dihapus pada reset.** Tulis test dashboard unified dan hapus sync test. |
| `tests/server/local-warranty-print-queue-repository.test.ts` | Queue database dengan nama local. | **Sudah dihapus pada reset.** Tulis test queue unified. |
| `tests/server/pengajuan-repository.test.ts` | Draft, model, duplicate, dan generator ID lama. | **Sudah dihapus pada reset.** Tulis test repository/service baru untuk form manual. |
| `tests/server/pengajuan-final-submit.test.ts` | Upload PDF/JPG dari draft ke storage lokal. | **Sudah dihapus pada reset.** Reuse aturan validasi/rollback dalam test storage baru. |
| `tests/server/admin-*.test.ts` | Auth, members, layout admin. | **Sudah dihapus pada reset.** Tulis ulang setelah service admin target tersedia. |

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
- Hardcopy PDF wajib; bukti/lampiran tambahan PDF/JPG mengikuti batas
  jumlah/ukuran yang dikonfigurasi dan melekat pada pengajuan.
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
| `pengajuan` | Field identitas, pemohon, cabang, tanggal, status, draft token, dan timestamp sudah ada. | Hapus field draft/resume, tambahkan soft delete dan metadata actor; normalkan enum agar status baru memakai `Baru`, bukan draft lama. |
| `pengajuan_items` | Field item, model, serial, keputusan, review model, cetak, kirim, dan batch sudah ada. | Pisahkan keputusan item dari lifecycle pengajuan, tegaskan unique model + serial global, dan pindahkan relasi batch ke tabel histori cetak/kirim. |
| File pengajuan | Tabel `archive_files` sudah menyimpan nama, path, MIME, ukuran, checksum, dan status download. | Bentuk `pengajuan_files`; hilangkan makna Drive/archive, simpan hardcopy dan lampiran pada level pengajuan, serta tambahkan metadata upload/owner bila diperlukan. |
| `status_log` | Sudah punya actor string, status lama/baru, catatan, item, dedupe key, dan timestamp. | Pakai untuk pembuatan manual serta pastikan actor konsisten dengan session. |
| `audit_log` | Belum ada. | Tambahkan tabel dan service untuk create, update, delete, status, file, cetak, dan kirim. |
| Sequence ID | Belum ada counter/sequence; generator saat ini scan ID pada tanggal yang sama. | Tambahkan sequence harian atau mekanisme transaksi yang aman dari race condition. |
| `model_produk` | Master dan status verifikasi tersedia; `origin` `local/import` masih dipakai sebagai kategori bisnis. | Pertahankan hanya sebagai kategori bisnis bila memang diperlukan, bukan source database. |
| `print_batch` dan layout | Sudah ada. | Bentuk histori `print_batches`/`print_batch_items` dan histori pengiriman; audit field legacy `createdAtGas`/jenis layout saat migrasi unified. |
| Better Auth | Tabel user/account/session/verification dan service auth sudah ada. | Pertahankan, lalu pastikan semua endpoint target memakainya. |
| `import_batches` | Belum ada. | Tidak diperlukan untuk overhaul pertama; tambahkan hanya saat import Excel dimulai. |
| `sync_log` dan `sync_meta` | Masih ada dan dipakai archive sync. | Hapus bersama sync runtime; database baru tidak membawa data atau tabel sync lama. |

## 10. Acceptance Fase 0

- [x] Daftar route dan fitur terdampak tersedia.
- [x] Pemetaan endpoint lama ke endpoint target tersedia.
- [x] Aturan bisnis yang harus dipertahankan tersedia.
- [x] Gap schema dan kebutuhan workflow manual tersedia.
- [x] Keputusan desain Fase 2 dicatat di
  [doc/design-decisions.md](design-decisions.md).
- [x] Status worktree awal tercatat.
- [x] Tidak ada perubahan destruktif pada kode runtime selama Fase 0 historis.
