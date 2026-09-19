# Implementation Plan - MAUKAGA Fullstack Nuxt

Dokumen ini adalah task list implementasi untuk mengubah MAUKAGA menjadi satu
aplikasi fullstack Nuxt/Nitro sesuai [PRD](doc/prd.md). Gunakan dokumen ini
sebagai panduan kerja developer manusia maupun AI agent.

Target akhir:

- Satu aplikasi Nuxt/Nitro menjadi aplikasi production.
- Satu database aplikasi menjadi sumber kebenaran seluruh pengajuan.
- Satu storage aplikasi menjadi sumber kebenaran seluruh file.
- Untuk overhaul pertama, pengajuan dibuat dari form manual di dashboard admin
  dengan lampiran pendukung PDF/JPG pada alur yang sama.
- Import Excel ditunda sebagai fitur lanjutan setelah alur manual stabil.
- Tidak ada dependency runtime ke Google Apps Script, Google Sheets, atau
  Google Drive.
- Tidak ada arsitektur sumber data `Active` dan `Local`.
- Tidak ada endpoint, composable, UI, env, service, repository, atau test yang
  masih diperlukan khusus untuk GAS, archive sync, atau pemisahan sumber data.

## Status Reset Saat Ini

Per 13 September 2026, working tree sudah sengaja dipotong besar untuk memulai
overhaul dari keadaan yang lebih fresh. File-file legacy berikut sudah dihapus
dari git working tree dan tidak boleh dipulihkan hanya demi membuat kode lama
berjalan lagi:

- composable lama untuk Apps Script, active API, dashboard source, draft, dan
  detail pengajuan lama;
- endpoint `/api/active/**`, `/api/archive/**`, serta sebagian endpoint admin
  lama untuk bootstrap, password, dan print layouts;
- seluruh repository dan service lama di `server/repositories/**` dan
  `server/services/**`;
- util lama `gas-bridge`, `archive-dashboard`, `archive-sync`, dan
  `local-archive`;
- test server lama di `tests/server/**`.

Setelah implementasi Fase 2, sisa route, endpoint, composable, komponen, schema,
dan test legacy yang masih menggantung ke modul terhapus sudah dibersihkan.
Aplikasi kembali bisa diverifikasi sebagai shell Nuxt/Better Auth minimal di
atas schema database unified. Implementasi service, API, form pengajuan,
workflow item, dan antrean cetak kemudian ditambahkan secara bertahap. Status
aktualnya dirangkum pada bagian berikut.

## Status Aktual Kode

Per 19 September 2026, kode sudah bergerak melewati shell awal. Modul yang sudah
ada di working tree saat ini:

- Auth Better Auth, middleware role, layout dashboard, dan navigasi dasar.
- Schema database unified untuk pengajuan, item, file, status log, audit log,
  daily sequence, model produk, config, print layout, print batch, shipping
  batch, dan tabel auth.
- Generator ID pengajuan `KG-YYYYMMDD-0001`.
- Repository dan service pengajuan unified di
  `server/repositories/pengajuan-repository.ts` dan
  `server/services/pengajuan-service.ts`.
- API pengajuan untuk list, detail, create multipart, update data utama, update
  status, bulk status, keputusan satu atau banyak item, soft delete, tandai item
  dicetak, dan tandai item dikirim.
- Form manual `app/pages/dashboard/pengajuan/create.vue` dengan hardcopy PDF
  wajib dan lampiran PDF/JPG.
- Storage tulis file pengajuan beserta metadata dan cleanup rollback, tetapi
  belum ada endpoint download file.
- Halaman daftar/detail operasional pengajuan di
  `app/pages/dashboard/pengajuan/index.vue`.
- Antrean cetak kartu garansi, set jenis kartu batch, browser print A4,
  batch penandaan cetak, serta konfigurasi layout aktif per jenis kartu.
- Antrean label pengiriman berbasis item yang sudah dicetak dan belum dikirim,
  pengelompokan label per `nama + bagianCabang`, browser print fixed A4
  beberapa label per halaman, serta batch penandaan pengiriman.
- Penandaan kirim langsung per item dari detail pengajuan sekarang memakai flow
  batch shipping yang sama dengan halaman antrean label.
- Master model produk unified tersedia melalui halaman
  `app/pages/dashboard/settings/product-name.vue`, repository/service
  `model_produk`, endpoint list/review/create/update, validasi duplikasi model,
  dan audit log mutasi.
- Editor layout kartu unified tersedia melalui halaman
  `app/pages/dashboard/settings/layout-kartu.vue`, repository/service layout
  cetak, endpoint CRUD dan aktivasi layout, penyimpanan layout aktif pada tabel
  `config`, validasi role, serta audit log mutasi.
- Alur cetak kartu menggunakan layout aktif untuk menerapkan offset dan gap ke
  hasil browser print. `print_batches.layout_id` juga menyimpan layout yang
  digunakan pada batch cetak.
- Manajemen anggota unified tersedia melalui halaman
  `app/pages/dashboard/settings/members.vue`, repository/service anggota,
  endpoint list/create/update, validasi role admin, hash password Better Auth,
  perlindungan admin terakhir, pencabutan session saat akun dinonaktifkan,
  audit log mutasi, dan sinkronisasi session sebelum request data anggota.

Yang belum ada atau masih perlu dibangun:

- Dashboard summary dan chart dari database.
- Endpoint download file pengajuan.
- API/UI admin target untuk bootstrap runtime, password, dan config.
- Backup/restore operasional.
- Test endpoint API, service create pengajuan, upload/download file, dan
  lifecycle penuh. Test service layout kartu, integrasi `layoutId` batch cetak,
  dan service members sudah tersedia.

## Cara Menggunakan Task List

- Kerjakan berurutan dari fase 0 sampai fase 12 kecuali ada dependency yang
  sudah jelas aman untuk diparalelkan.
- Jangan menandai task selesai hanya karena kode berhasil dikompilasi; gunakan
  checklist acceptance pada setiap fase.
- Jika task menemukan perilaku lama yang belum terdokumentasi, tambahkan catatan
  singkat di fase terkait sebelum mengubah kode.
- Semua perubahan perilaku server harus punya test otomatis atau alasan jelas
  mengapa hanya bisa diverifikasi manual.
- Jangan menghapus perubahan orang lain di working tree. Baca diff lebih dulu
  jika file sudah berubah.
- Setelah setiap fase besar, jalankan command verifikasi yang relevan dan catat
  hasilnya di PR atau catatan kerja.

## Fase 0 - Baseline dan Inventarisasi

Tujuan fase ini adalah membuat peta kerja yang akurat sebelum memindahkan
runtime ke arsitektur tunggal.

- Status: selesai pada 12 September 2026. Detail baseline ada di
  [doc/phase-0-baseline.md](doc/phase-0-baseline.md).

- [x] Baca [doc/prd.md](doc/prd.md) dan pastikan seluruh anggota tim memahami
  target fullstack Nuxt.
- [x] Jalankan `git status --short` dan catat file yang sudah berubah sebelum
  mulai kerja.
- [x] Inventarisasi route Nuxt di `app/pages` yang masih merupakan alur CS atau
  form publik lama.
- [x] Inventarisasi composable client yang masih memanggil Apps Script, source
  switcher, atau API `active/local/archive`.
- [x] Inventarisasi endpoint Nitro di `server/api` yang masih memakai path
  `active`, `local`, `archive`, atau `sync`.
- [x] Inventarisasi repository, service, schema, util, dan test yang masih
  memakai GAS, bridge, archive sync, atau source split.
- [x] Buat daftar kontrak request/response frontend yang perlu dipertahankan
  sementara agar migrasi UI tidak terlalu besar.
- [x] Buat daftar aturan bisnis lama yang harus dipindahkan ke service aplikasi,
  termasuk status, keputusan item, cetak, pengiriman, dan validasi model.
- [x] Buat daftar field database yang belum tersedia untuk workflow baru:
  pembuatan manual, file pengajuan, audit, dan generator ID.

Acceptance fase 0:

- [x] Ada daftar file dan fitur terdampak.
- [x] Ada pemetaan endpoint lama ke endpoint target.
- [x] Ada daftar aturan bisnis yang harus dipertahankan.
- [x] Tidak ada perubahan destruktif pada kode di fase ini.

Catatan reset: setelah baseline 12 September 2026 selesai, pemilik repo
melakukan penghapusan besar pada 13 September 2026. Fase berikutnya harus
memakai daftar reset di atas sebagai kondisi awal baru.

## Fase 1 - Bersihkan Konfigurasi Runtime Eksternal

Tujuan fase ini adalah memastikan konfigurasi production tidak lagi bergantung
pada layanan Google atau aplikasi CS terpisah.

- [x] Hapus default URL Apps Script dari `nuxt.config.ts`.
- [x] Hapus runtime config server untuk URL Apps Script.
- [x] Hapus runtime config server untuk bridge secret GAS.
- [x] Hapus runtime config public untuk URL Apps Script.
- [x] Tambahkan runtime config server untuk root storage pengajuan:
  `NUXT_PENGAJUAN_FILE_DIRECTORY`.
- [x] Tidak menambahkan runtime config public untuk base path file karena file
  target akan diakses melalui route server terproteksi.
- [x] Tambahkan runtime config untuk backup: `NUXT_BACKUP_DIRECTORY`.
- [x] Update `.env.example` agar hanya berisi env arsitektur Nuxt tunggal.
- [x] Update dokumentasi setup di `README.md` agar tidak menyebut layanan
  eksternal lama, Cloudflare CS/static, atau URL Apps Script.
- [x] Pastikan config lama seperti `NUXT_APPS_SCRIPT_API_URL`,
  `NUXT_PUBLIC_APPS_SCRIPT_API_URL`, `NUXT_GAS_BRIDGE_SECRET`, dan
  `GAS_BRIDGE_SECRET` tidak diperlukan untuk boot aplikasi.

Acceptance fase 1:

- [x] Aplikasi dapat `pnpm dev` tanpa env layanan eksternal.
- [x] `rg -n "APPS_SCRIPT|GAS_BRIDGE|script.google|Google Apps Script" nuxt.config.ts .env.example README.md`
  tidak menemukan dependency runtime.
- [x] Build config masih mengekspos `DATABASE_URL`, `BETTER_AUTH_*`, app info,
  upload limit, dan storage pengajuan.

Catatan verifikasi: setelah cleanup Fase 2, aplikasi dapat diverifikasi tanpa
env layanan eksternal lama. `pnpm typecheck`, `pnpm lint`, `pnpm test`, dan
`pnpm build` berhasil pada 13 September 2026.

## Fase 2 - Finalisasi Schema Database Tunggal

Tujuan fase ini adalah membuat schema yang cukup untuk seluruh workflow tanpa
archive sync atau split source.

- Referensi keputusan desain: [doc/design-decisions.md](doc/design-decisions.md).
- Kondisi awal: database baru dan kosong. Migration lama di `drizzle/` sudah
  dihapus dan output migration Drizzle diarahkan ke
  `server/database/migrations`.

- [x] Audit schema saat ini di `server/database/schema`.
- [x] Pastikan `pengajuan` memiliki field untuk identitas pengajuan, pelanggan,
  cabang, tanggal, status, metadata pembuatan, soft delete, dan timestamp.
- [x] Hapus field draft/resume seperti `resume_token`, `draft_created_at`, dan
  `draft_updated_at`; pengajuan baru dibuat langsung tanpa konsep draft.
- [x] Jangan menambahkan field atau tabel kontak khusus pada overhaul pertama.
- [x] Pastikan `pengajuan_items` memiliki field untuk model, nomor serial,
  keputusan, catatan, jenis kartu, status cetak, status kirim, dan relasi ke
  histori batch.
- [x] Pisahkan status lifecycle pengajuan dari keputusan dan status operasional
  item; dukung keputusan item campuran `Disetujui` dan `Ditolak`.
- [x] Pastikan `status_log` menyimpan actor, status lama, status baru, catatan,
  dan timestamp.
- [x] Buat tabel file baru bernama `pengajuan_files`.
- [x] Bentuk `pengajuan_files` sebagai schema baru untuk database kosong, tanpa
  metadata Drive/archive.
- [x] Tandai hardcopy PDF sebagai file wajib dan simpan seluruh bukti/lampiran
  pada level pengajuan, bukan level item.
- [x] Jangan wajibkan tabel `import_batches` pada overhaul pertama; tabel ini
  hanya ditambahkan saat fitur import Excel lanjutan mulai dibangun.
- [x] Tambahkan tabel `audit_log` untuk operasi admin penting.
- [x] Tambahkan tabel atau konfigurasi generator sequence harian untuk ID
  `KG-YYYYMMDD-0001`.
- [x] Tambahkan `print_batches` dan `print_batch_items` untuk histori cetak,
  termasuk cetak ulang dan hasil sebagian gagal.
- [x] Tambahkan `shipping_batches` dan `shipping_batch_items` untuk histori
  pengiriman, termasuk pengiriman ulang dan hasil sebagian gagal.
- [x] Pastikan `model_produk`, histori `print_batches`, `print_layouts`,
  `config`, histori pengiriman, dan tabel Better Auth tetap kompatibel.
- [x] Hapus tabel yang hanya bermakna sync seperti `sync_log` dan `sync_meta`;
  tidak ada tabel source split atau import batch pada schema awal.
- [x] Tambahkan unique constraint untuk ID pengajuan, nomor item, dan kunci
  bisnis yang wajib unik. Kombinasi model + nomor serial harus unik global dan
  tetap unik untuk record soft-deleted.
- [x] Tambahkan index untuk pencarian ID pengajuan, nomor serial, model, status,
  tanggal, dan cabang.
- [x] Buat migration Drizzle untuk semua perubahan schema.

Acceptance fase 2:

- [x] `pnpm db:generate` menghasilkan migration yang sesuai.
- [x] `pnpm db:push` berhasil pada database kosong.
- [x] Test database dapat membuat schema baru dari migration dan memverifikasi
  unique model + nomor serial.
- [x] Tidak ada tabel baru yang memakai istilah source `active/local`.
- [x] Istilah `Local` hanya tersisa sebagai kategori bisnis jika memang masih
  diperlukan untuk jenis kartu garansi.

Catatan verifikasi Fase 2: `pnpm db:generate`, `pnpm db:push`, `pnpm typecheck`,
`pnpm lint`, dan `pnpm test` berhasil pada 13 September 2026. Database lokal
akhir dikosongkan ulang setelah smoke test.

## Fase 3 - Generator ID Pengajuan

Tujuan fase ini adalah membuat ID pengajuan server-side tanpa bergantung pada
layanan lama.

- [x] Buat util atau service generator ID, misalnya
  `server/services/pengajuan-id-service.ts`.
- [x] Gunakan format default `KG-YYYYMMDD-0001`.
- [x] Simpan counter per tanggal di database.
- [x] Jalankan pembuatan ID di dalam transaksi.
- [x] Pastikan generator aman dari race condition untuk pembuatan pengajuan
  paralel.
- [x] Pastikan timezone yang dipakai konsisten dengan timezone aplikasi.
- [x] Sediakan test untuk beberapa ID di tanggal yang sama.
- [x] Sediakan test untuk reset counter pada tanggal berbeda.
- [x] Sediakan test untuk simulasi conflict atau retry transaksi.

Acceptance fase 3:

- [x] ID tidak bergantung pada nama file atau input browser.
- [x] ID unik dan deterministic per tanggal/counter.
- [x] Test generator ID lulus.

Catatan verifikasi Fase 3: generator di
`server/services/pengajuan-id-service.ts` menggunakan upsert atomic pada
`daily_sequence` di dalam transaksi Drizzle. Tanggal sequence mengikuti
`TZ` bila tersedia, dengan fallback `Asia/Jakarta`; transaksi yang mengalami
konflik lock dapat dicoba ulang. Test generator mencakup increment harian,
reset tanggal, timezone, retry conflict, dan pemakaian di dalam transaksi
pembuatan pengajuan. `pnpm test`, `pnpm lint`, `pnpm typecheck`, dan
`pnpm build` berhasil pada 13 September 2026.

## Catatan Implementasi - Cetak Kartu Garansi

Per 19 September 2026, alur cetak kartu garansi dan pengelolaan layout sudah
tersedia di
aplikasi unified Nuxt/Nitro. Implementasi ini mengikuti keputusan scope berikut:

- Antrean hanya mengambil item dengan `keputusanItem = Disetujui` dan
  `statusCetak = Belum Dicetak`.
- Admin dan QRCC dapat memilih item, menetapkan jenis kartu secara batch
  (`Local` atau `Import`), membuka dialog print browser, dan menandai item
  sudah dicetak.
- Management hanya dapat melihat antrean dan tidak dapat melakukan mutasi.
- Penandaan cetak membuat satu `print_batches` dan beberapa
  `print_batch_items`, memperbarui item ke `Dicetak`, lalu menghitung ulang
  status pengajuan menjadi `Diprint` jika seluruh item yang disetujui sudah
  dicetak.
- Jenis kartu wajib tersedia sebelum item dapat ditandai sudah dicetak.
- Browser print tetap menggunakan halaman A4, tetapi posisi field tidak lagi
  sepenuhnya fixed. Layout aktif untuk jenis kartu `Local` atau `Import`
  menerapkan `offsetX`, `offsetY`, `gapProductModel`, dan `gapModelSerial`.
- Layout bawaan tersedia untuk setiap jenis kartu. Admin dan QRCC dapat membuat,
  mengubah, menduplikasi, mengaktifkan, dan menghapus layout custom yang tidak
  sedang aktif. Layout bawaan tidak dapat dihapus.
- ID layout aktif per jenis kartu disimpan pada tabel `config` menggunakan key
  `ACTIVE_PRINT_LAYOUT_LOCAL` dan `ACTIVE_PRINT_LAYOUT_IMPORT`.
- Batch cetak menyimpan `layoutId` yang digunakan. Satu batch hanya boleh
  menggunakan satu jenis kartu dan layout yang sesuai dengan jenis tersebut.
- Management dapat membaca halaman layout, tetapi hanya admin dan QRCC yang
  dapat melakukan mutasi.
- Reprint belum diaktifkan. Histori batch disimpan tanpa menimpa data batch
  sebelumnya, tetapi item yang sudah `Dicetak` belum masuk antrean normal lagi.

File utama:

- `app/pages/dashboard/cetak-kartu.vue`
- `app/components/print/KartuGaransi.vue`
- `app/types/print.ts`
- `app/utils/print.ts`
- `server/api/warranty-print-queue.get.ts`
- `server/api/warranty-print-queue/types.post.ts`
- `server/api/warranty-print-queue/print.post.ts`
- `server/api/admin/print-layouts/index.get.ts`
- `server/api/admin/print-layouts/index.post.ts`
- `server/api/admin/print-layouts/active.post.ts`
- `server/api/admin/print-layouts/[id].delete.ts`
- `server/repositories/config-repository.ts`
- `server/repositories/print-layout-repository.ts`
- `server/services/print-layout-service.ts`
- `server/repositories/pengajuan-repository.ts`
- `server/services/pengajuan-service.ts`
- `tests/print-layout-service.test.ts`
- `tests/warranty-print-queue-service.test.ts`

Verifikasi fitur ini: `npm run typecheck`, `npm run lint`, `npm test`, dan
`git diff --check` berhasil pada 19 September 2026. `pnpm build` tidak
dijalankan sesuai scope task.

## Catatan Implementasi - Label Pengiriman

Per 18 September 2026, antrean label pengiriman dan batch shipping sudah
tersedia di aplikasi unified Nuxt/Nitro. Implementasi ini mengikuti keputusan
scope berikut:

- Antrean hanya mengambil item dengan `keputusanItem = Disetujui`,
  `statusCetak = Dicetak`, dan `statusKirim = Belum Dikirim`.
- Label dikelompokkan berdasarkan kombinasi case-insensitive
  `nama + bagianCabang`; beberapa item dalam grup tersebut menghasilkan satu
  label.
- Isi label fixed hanya memuat nama pemohon dan bagian/cabang. Template
  browser print menggunakan A4 portrait dengan 15 label per halaman dalam grid
  3 x 5.
- Admin dan QRCC dapat memilih item, mencetak label, dan menandai item sudah
  dikirim. Management hanya dapat membaca antrean.
- Print label tidak mengubah status. Status berubah melalui konfirmasi
  `Tandai Dikirim`, yang membuat `shipping_batches` dan
  `shipping_batch_items`, memperbarui `statusKirim`, `shippedAt`, dan
  `lastShippingBatchId`.
- Status pengajuan dihitung ulang menjadi `Dikirim` jika seluruh item yang
  disetujui sudah dikirim.
- Validasi eligibility dilakukan ulang di dalam transaksi dan input dideduplikasi
  berdasarkan pengajuan dan nomor item untuk menangani selection lama atau
  klik ganda.

File utama:

- `app/pages/dashboard/cetak-label-kirim.vue`
- `app/components/print/LabelPengiriman.vue`
- `app/types/print.ts`
- `app/utils/print.ts`
- `server/api/shipping-label-queue.get.ts`
- `server/api/shipping-label-queue/ship.post.ts`
- `server/repositories/pengajuan-repository.ts`
- `server/services/pengajuan-service.ts`
- `tests/shipping-label-queue-service.test.ts`

Verifikasi fitur ini: `pnpm test`, `pnpm typecheck`, `pnpm lint`, dan
`git diff --check` berhasil pada 18 September 2026. `pnpm build` tidak
dijalankan sebagai bagian dari task ini.

## Catatan Implementasi - Members

Per 19 September 2026, halaman Settings > User Management dan API anggota
sudah tersedia di aplikasi unified Nuxt/Nitro. Implementasi ini mengikuti
aturan akses dan keamanan pada PRD:

- Daftar anggota menampilkan email, nama, role, status, tanggal dibuat, serta
  ringkasan total, aktif, nonaktif, dan admin aktif.
- Admin dapat mencari dan memfilter anggota berdasarkan nama/email, role, dan
  status.
- Admin dapat membuat anggota baru dengan email, nama, role, dan password awal.
  Email dinormalisasi lowercase dan password selalu di-hash melalui context
  Better Auth sebelum disimpan.
- Admin dapat mengubah nama dan role, serta mengaktifkan atau menonaktifkan
  akun. Akun sendiri tidak dapat dinonaktifkan atau diturunkan dari admin.
- Admin terakhir yang masih aktif tidak dapat dinonaktifkan atau diturunkan
  role-nya.
- Penonaktifan akun menghapus seluruh session aktif akun tersebut.
- Pembuatan dan perubahan anggota dicatat ke `audit_log`.
- Endpoint anggota hanya dapat diakses oleh session aktif dengan role `admin`;
  validasi payload dilakukan dengan Zod di service dan mutasi memakai transaksi.
- Halaman menunggu session Better Auth selesai dimuat sebelum mengambil data
  anggota melalui API client-side, sehingga request awal tidak balapan dengan
  proses autentikasi.
- State error hanya ditampilkan jika request terakhir benar-benar gagal tanpa
  data anggota yang valid. Pesan error membaca `statusMessage`, `message`, dan
  error standar JavaScript.
- Endpoint Members mengembalikan Promise service dengan `await` agar error
  asynchronous tetap diproses oleh normalizer API.

File utama:

- `app/pages/dashboard/settings.vue`
- `app/layouts/default.vue`
- `app/pages/dashboard/settings/members.vue`
- `app/types/member.ts`
- `server/api/admin/members/index.get.ts`
- `server/api/admin/members/index.post.ts`
- `server/api/admin/members/[id].patch.ts`
- `server/repositories/member-repository.ts`
- `server/services/member-service.ts`
- `tests/member-service.test.ts`

Verifikasi fitur ini: `npm run typecheck`, `npm run lint`, test service Members,
dan `git diff --check` berhasil pada 19 September 2026. `pnpm build` tidak
dijalankan sesuai scope task.

## Fase 4 - Service dan Repository Pengajuan Tunggal

Tujuan fase ini adalah membuat lapisan domain yang menggantikan GAS repository,
archive service, dan active/local service.

- [x] Buat repository utama, misalnya
  `server/repositories/pengajuan-repository.ts`.
- [x] Buat service utama, misalnya `server/services/pengajuan-service.ts`.
- [x] Jangan menghidupkan kembali repository/service lama dari git history;
  gunakan nama file lama hanya jika implementasinya sudah benar-benar unified.
- [x] Pastikan repository hanya berisi operasi database.
- [x] Pastikan service berisi aturan bisnis, validasi workflow, transaksi, dan
  orchestration.
- [ ] Implementasikan pembacaan dashboard summary dari database aplikasi.
- [ ] Implementasikan pembacaan chart dari database aplikasi.
- [x] Implementasikan daftar pengajuan dengan filter status, cabang, model,
  keputusan item, dan search umum. Filter tanggal eksplisit belum ada.
- [x] Implementasikan detail pengajuan lengkap beserta item, file, status log,
  dan metadata.
- [x] Implementasikan update data utama pengajuan.
- [x] Implementasikan update status pengajuan.
- [x] Implementasikan keputusan satu item.
- [x] Implementasikan keputusan banyak item dalam satu transaksi untuk satu
  pengajuan, dengan validasi seluruh target sebelum perubahan, recalculation
  status agregat sekali, status log per item, dan audit log batch.
- [x] Implementasikan hapus pengajuan sesuai kebijakan audit.
- [x] Implementasikan pembacaan dan update master model produk.
- [x] Implementasikan antrean cetak kartu dari item yang disetujui dan belum
  dicetak.
- [x] Implementasikan penyimpanan jenis kartu garansi (`Local` atau `Import`).
- [x] Implementasikan penandaan item sudah dicetak melalui batch.
- [x] Implementasikan antrean label pengiriman dengan filter item disetujui,
  sudah dicetak, dan belum dikirim.
- [x] Implementasikan batch pengiriman dan penandaan item sudah dikirim.
- [x] Implementasikan repository dan service layout kartu dengan layout
  bawaan `Local`/`Import`, layout custom, validasi nilai posisi, dan aturan
  penghapusan.
- [x] Implementasikan penyimpanan layout aktif per jenis kartu pada tabel
  `config`.
- [x] Implementasikan audit log untuk pembuatan, perubahan, aktivasi, dan
  penghapusan layout kartu.
- [x] Integrasikan layout aktif ke browser print kartu dan simpan `layoutId`
  pada `print_batches`.
- [x] Implementasikan pembacaan file metadata pada DTO pengajuan.
- [x] Implementasikan audit log untuk mutasi penting yang sudah tersedia.
- [x] Pastikan setiap mutasi lintas tabel memakai transaksi.

Acceptance fase 4:

- [x] Tidak ada service baru yang memanggil GAS, Sheets, Drive, atau bridge.
- [x] Payload service kompatibel dengan kebutuhan UI saat ini atau perubahan UI
  tercatat jelas.
- [ ] Unit test service/repository mencakup happy path dan error path utama.
  Test otomatis sudah mencakup generator ID, schema, admin seed, model produk,
  keputusan banyak item, service antrean cetak, label pengiriman, dan layout
  kartu. Coverage service create pengajuan dan lifecycle penuh masih pending.
- [x] `status_log` terisi pada perubahan status pengajuan, keputusan item,
  cetak, dan kirim yang sudah tersedia.
- [x] Audit log terisi pada pembuatan pengajuan, update, delete, cetak, dan
  pengiriman yang sudah tersedia. Coverage test belum lengkap untuk semuanya.

## Fase 5 - API Nitro Unified

Tujuan fase ini adalah mengalihkan seluruh pintu masuk dashboard ke endpoint
Nitro tunggal tanpa path source.

- [ ] Buat endpoint `server/api/dashboard.get.ts`.
- [ ] Buat endpoint `server/api/dashboard/chart.get.ts`.
- [x] Buat endpoint `server/api/pengajuan/index.get.ts`.
- [x] Buat endpoint `server/api/pengajuan/[idPengajuan].get.ts`.
- [x] Buat endpoint `server/api/pengajuan/create.post.ts`.
- [x] Buat endpoint `server/api/pengajuan/[idPengajuan]/update.post.ts`.
- [x] Buat endpoint `server/api/pengajuan/[idPengajuan]/status.post.ts`.
- [x] Buat endpoint `server/api/pengajuan/[idPengajuan]/item-decision.post.ts`.
- [x] Buat endpoint `server/api/pengajuan/[idPengajuan]/items-decision.post.ts`.
- [x] Buat endpoint `server/api/pengajuan/[idPengajuan]/item-print.post.ts`.
- [x] Buat endpoint `server/api/pengajuan/[idPengajuan]/item-shipping.post.ts`.
- [x] Buat endpoint `server/api/pengajuan/[idPengajuan]/delete.post.ts`.
- [x] Buat endpoint `server/api/pengajuan/bulk-status.post.ts`.
- [x] Buat endpoint `server/api/model-produk/index.get.ts`.
- [x] Buat endpoint `server/api/model-produk/review.get.ts`.
- [x] Buat endpoint antrean cetak:
  `server/api/warranty-print-queue.get.ts`.
- [x] Buat endpoint penyimpanan jenis kartu:
  `server/api/warranty-print-queue/types.post.ts`.
- [x] Buat endpoint batch penandaan cetak:
  `server/api/warranty-print-queue/print.post.ts`.
- [x] Buat endpoint antrean pengiriman:
  `server/api/shipping-label-queue.get.ts`.
- [x] Buat endpoint batch penandaan pengiriman:
  `server/api/shipping-label-queue/ship.post.ts`.
- [x] Buat endpoint layout kartu:
  `server/api/admin/print-layouts/index.get.ts`,
  `server/api/admin/print-layouts/index.post.ts`,
  `server/api/admin/print-layouts/active.post.ts`, dan
  `server/api/admin/print-layouts/[id].delete.ts`.
- [x] Buat endpoint admin anggota:
  `server/api/admin/members/index.get.ts`,
  `server/api/admin/members/index.post.ts`, dan
  `server/api/admin/members/[id].patch.ts`.
- [x] Endpoint yang sudah tersedia memvalidasi session Better Auth.
- [x] Endpoint mutasi yang sudah tersedia memvalidasi role.
- [x] Payload endpoint yang sudah tersedia divalidasi dengan Zod di endpoint
  atau service.
- [x] Response error endpoint yang sudah tersedia memakai normalizer API
  bersama.
- [x] Jangan membuat compatibility endpoint untuk `/api/active/**` atau
  `/api/archive/**`; route tersebut sudah dihapus pada reset awal.
- [x] Hapus atau bangun ulang endpoint yang masih menggantung ke service lama:
  `/api/local/sync`, `/api/local/sync-status`, `/api/local/warranty-print-queue`,
  dan `/api/pengajuan/actions/[action]`.
- [ ] Bangun ulang endpoint admin target yang masih diperlukan sesuai PRD:
  bootstrap, password, dan config. Endpoint print layouts dan members sudah
  tersedia.

Acceptance fase 5:

- [x] Browser dashboard memakai endpoint unified untuk modul yang sudah tersedia.
- [x] Tidak ada endpoint production yang membutuhkan `source=active`,
  `source=local`, `/api/active`, `/api/local`, `/api/archive`, atau sync.
- [ ] Test endpoint mencakup unauthorized, forbidden, valid request, dan invalid
  payload. Test endpoint khusus belum tersedia.

## Fase 6 - Storage File Pengajuan

Tujuan fase ini adalah menyimpan dan menyajikan seluruh dokumen dari storage
aplikasi.

- [x] Buat util path storage:
  `server/utils/pengajuan-file-storage.ts`.
- [x] Pastikan root storage berasal dari `NUXT_PENGAJUAN_FILE_DIRECTORY`
  dengan fallback `storage/pengajuan`.
- [x] Gunakan struktur default `storage/pengajuan/{ID Pengajuan}/...`.
- [x] Gunakan nama file storage server-side berbasis UUID dan basename aman;
  filename mentah browser tidak dipakai sebagai path final.
- [x] Jangan pernah memakai path atau filename mentah dari browser sebagai path
  final.
- [x] Tentukan daftar jenis file: hardcopy PDF wajib, bukti JPG, dan lampiran
  PDF/JPG lain jika diperlukan.
- [x] Validasi MIME type dan ekstensi file pada form dan service.
- [x] Validasi ukuran file terhadap `NUXT_PUBLIC_MAX_UPLOAD_MB` di server.
  Batas diteruskan dari runtime config server dan divalidasi sebelum transaksi.
- [x] Hitung checksum `sha256` setiap file.
- [x] Simpan metadata file ke `pengajuan_files`.
- [ ] Buat route download file yang memvalidasi session dan role.
- [ ] Pastikan route download mengirim MIME type dan filename yang aman.
- [x] Bersihkan file yang sudah ditulis jika transaksi pembuatan pengajuan atau
  upload gagal.
- [ ] Tambahkan test traversal path seperti `../` dan encoded path.
- [ ] Tambahkan test file missing dan permission denied.

Catatan implementasi: util storage melakukan validasi containment terhadap root
path saat menulis dan cleanup. Belum ada operasi baca/download file dari server,
sehingga acceptance akses baca terproteksi belum dapat dianggap selesai.

Acceptance fase 6:

- [x] File yang ditulis tidak dapat keluar dari root storage melalui storage key.
- [ ] File tidak dapat dibaca tanpa session valid.
- [x] Metadata database dibuat bersamaan dengan proses create dan file yang
  sudah ditulis dibersihkan saat transaksi gagal.
- [ ] Restart server tidak menghilangkan file.

## Fase 7 - Form Manual dan Lampiran

Tujuan fase ini adalah membuat pengajuan baru langsung dari aplikasi melalui
form manual admin, disertai upload lampiran pendukung PDF/JPG pada alur yang
sama. Fase ini menjadi prioritas utama overhaul pertama; import Excel tidak
dibangun dulu sampai workflow manual stabil.

- [x] Definisikan schema Zod untuk payload form pengajuan.
- [x] Definisikan schema Zod untuk satu atau banyak item pengajuan.
- [x] Definisikan schema validasi lampiran PDF/JPG.
- [x] Buat service `createPengajuan` atau padanan lokal yang membuat pengajuan
  dari input manual.
- [x] Service create membuat ID pengajuan, pengajuan, item, file metadata,
  status log, dan audit log.
- [x] Service create menyimpan lampiran PDF/JPG ke storage aplikasi.
- [x] Service create membuat status awal `Baru`.
- [x] Validasi field wajib pengajuan, cabang, model, nomor serial, tanggal, dan
  hardcopy PDF; jangan menambahkan data kontak yang tidak diperlukan.
- [x] Validasi model produk terhadap master `model_produk`.
- [x] Pastikan nomor serial diperlakukan sebagai teks.
- [x] Deteksi duplikasi item dalam form yang sama.
- [x] Deteksi duplikasi terhadap database melalui unique constraint dan
  normalisasi model + nomor serial.
- [x] Validasi MIME type, ekstensi, checksum, dan filename aman.
- [x] Validasi ukuran file di server menggunakan batas dari runtime config.
- [x] Pastikan data permanen tidak dibuat jika validasi form atau lampiran
  gagal.
- [x] Pastikan transaksi database dan penyimpanan file punya rollback/cleanup
  yang jelas jika salah satu tahap gagal.
- [x] Buat UI `Buat Pengajuan` di dashboard.
- [x] UI form mendukung tambah/hapus item, validasi inline, upload lampiran,
  koreksi data, dan submit.
- [x] Tampilkan error dan warning validasi dengan pesan yang dapat ditindak
  lanjuti admin.
- [x] Setelah submit sukses, arahkan admin ke daftar pengajuan.

Acceptance fase 7:

- [x] Admin dapat membuat minimal satu pengajuan dengan minimal satu item
  melalui form manual.
- [x] Admin dapat membuat satu pengajuan dengan banyak item sampai batas
  konfigurasi `NUXT_PUBLIC_MAX_ITEMS`.
- [x] Admin wajib melampirkan hardcopy PDF dan dapat menambahkan bukti/lampiran
  PDF/JPG pada level pengajuan.
- [x] Input invalid gagal sebelum data permanen dibuat.
- [x] Duplikasi terblokir sesuai unique constraint dan normalisasi key.
- [ ] Test validasi form, service create, penyimpanan lampiran, dan rollback
  file lulus secara khusus.

## Fase 8 - Lifecycle, Item Decision, Cetak, dan Pengiriman

Tujuan fase ini adalah memastikan workflow operasional berjalan sepenuhnya dari
database aplikasi.

- [x] Definisikan transisi status yang diperbolehkan secara lengkap.
- [x] Validasi status `Baru`, `Disetujui`, `Ditolak`, `Diprint`, `Dikirim`, dan
  `Selesai` melalui schema dan aturan `Selesai`.
- [x] Pisahkan keputusan item `Menunggu`/`Disetujui`/`Ditolak` dari status
  pengajuan.
- [x] Izinkan keputusan item campuran dalam satu pengajuan.
- [x] Perlakukan `Ditolak` sebagai final pada alur normal; hanya admin yang
  dapat mengubahnya kembali ke `Baru`, dengan audit dan alasan.
- [x] Perbarui status `Diprint` otomatis dari event item cetak, bukan
  melalui perubahan manual yang melewati batch.
- [x] Perbarui status `Dikirim` otomatis dari event item kirim melalui batch
  shipping.
- [x] Izinkan `Selesai` hanya jika minimal satu item sudah dikirim dan setiap
  item lainnya ditolak atau sudah dikirim; jika semua item ditolak, status tetap
  `Ditolak`.
- [x] Pastikan status lama seperti `Menunggu Upload` dan `Diterima` tidak dipakai
  untuk pengajuan baru.
- [x] Pastikan catatan wajib untuk penolakan.
- [x] Pastikan keputusan item memengaruhi status pengajuan sesuai aturan bisnis.
- [x] Pastikan item yang belum valid modelnya tidak bisa masuk proses cetak jika
  aturan bisnis melarangnya.
- [x] Implementasikan queue cetak dari database aplikasi.
- [x] Implementasikan simpan jenis kartu garansi.
- [x] Implementasikan batch cetak dan penandaan item sudah dicetak.
- [x] Implementasikan editor layout kartu untuk mengatur offset dan gap,
  aktivasi layout per jenis kartu, serta penerapan layout pada browser print.
- [x] Simpan `layoutId` pada histori batch cetak dan validasi agar layout sesuai
  dengan jenis kartu dalam batch.
- [ ] Simpan setiap cetak ulang sebagai batch baru; reprint belum masuk scope
  antrean normal.
- [x] Implementasikan queue label pengiriman dari database aplikasi.
- [x] Implementasikan batch pengiriman dan penandaan item sudah dikirim.
- [x] Simpan setiap operasi pengiriman sebagai batch baru tanpa menimpa histori.
  Pengiriman ulang belum masuk antrean normal karena status item sudah `Dikirim`.
- [x] Pastikan perubahan cetak menulis `status_log` item dan `audit_log` batch.
  Penandaan kirim melalui detail maupun antrean label memakai shipping batch,
  status log, dan audit log.
- [x] Pastikan data berstatus `Selesai` tetap muncul saat dicari melalui list
  pengajuan yang tidak mengecualikan status tersebut.

Acceptance fase 8:

- [ ] Workflow dari `Baru` sampai `Selesai` bisa dijalankan tanpa layanan
  eksternal.
- [x] Perubahan yang sudah tersedia memiliki actor dan timestamp.
- [ ] Test transisi status dan keputusan item lulus secara menyeluruh.
  Test service antrean cetak dan label pengiriman sudah tersedia; test endpoint
  dan lifecycle penuh masih pending.

## Fase 9 - Alihkan Frontend Dashboard

Tujuan fase ini adalah menghapus asumsi source split dari UI dan composable.

- [x] Hapus komponen source switcher dari dashboard.
- [x] Hapus state dashboard source dari composable.
- [x] Hapus query parameter `source` dari dashboard, list, detail, cetak, dan
  halaman lain.
- [ ] Buat composable unified pengganti untuk dashboard ke `/api/dashboard`.
- [ ] Buat composable unified pengganti untuk chart ke `/api/dashboard/chart`.
- [x] Buat halaman daftar pengajuan menggunakan `/api/pengajuan`.
- [x] Buat panel detail pengajuan menggunakan data lengkap dari response list
  `/api/pengajuan`; endpoint detail `/api/pengajuan/[idPengajuan]` juga sudah
  tersedia untuk kebutuhan terpisah.
- [x] Buat UI mutasi pengajuan untuk update, delete, status, keputusan item,
  cetak item, dan kirim item.
- [x] Buat halaman antrean cetak menggunakan `/api/warranty-print-queue`.
  Saat ini halaman menggunakan `useFetch` dan `$fetch` langsung, belum melalui
  composable khusus.
- [x] Buat halaman antrean label pengiriman menggunakan
  `/api/shipping-label-queue` dan `/api/shipping-label-queue/ship`.
  Halaman memakai `useFetch` dan `$fetch` langsung, belum melalui composable
  khusus.
- [x] Buat halaman pengaturan layout kartu menggunakan
  `/api/admin/print-layouts` dan endpoint aktivasi/penghapusan layout.
- [x] Buat halaman `User Management` menggunakan `/api/admin/members` dengan
  pencarian, filter role/status, pembuatan anggota, edit nama/role, dan
  aktivasi/nonaktivasi akun.
- [x] Hapus composable `useAppsScriptApi`, `useActiveApi`, `useActiveQuery`,
  `useAdminBffApi`, `useDashboardData`, `useDashboardDataSource`,
  `usePengajuanApi`, `usePengajuanDetail`, dan `useDraftReferenceStorage` dari
  working tree. Selesai via reset 13 September 2026.
- [x] Hapus label UI yang menyebut sumber data `Active` atau `Local`.
- [x] Pastikan istilah `Local` yang tersisa hanya kategori bisnis jenis kartu,
  bukan mode data.
- [x] Hapus halaman CS/public lama dari production route jika sudah tidak
  menjadi scope produk.
- [x] Tambahkan halaman `Buat Pengajuan` di dashboard melalui tombol
  `Pengajuan Baru` pada halaman daftar.
- [x] Tambahkan halaman antrean `Cetak Kartu Garansi` pada navigasi dashboard
  dengan mode mutasi sesuai role.
- [x] Tambahkan halaman antrean `Cetak Label Pengiriman` pada navigasi dashboard
  dengan selection/action hanya untuk admin dan QRCC; management read-only.
- [x] Tambahkan halaman `Layout Kartu` pada navigasi settings dengan mode baca
  untuk management dan mutasi untuk admin/QRCC.

Acceptance fase 9:

- [x] Modul dashboard yang sudah tersedia dapat dipakai tanpa memilih source.
- [x] Tidak ada request browser ke endpoint lama pada modul yang tersedia.
- [x] `rg -n "source=|dashboardSource|isArchive|/api/active|/api/local|/api/archive" app`
  tidak menemukan dependency UI production.
- [ ] Smoke test UI dashboard utama lulus.

## Fase 10 - Hapus Integrasi GAS dan Sync Lama

Tujuan fase ini adalah membersihkan kode runtime yang sudah digantikan agar
arsitektur target benar-benar murni Nuxt.

- [x] Hapus repository yang khusus memanggil GAS. Selesai via reset
  13 September 2026.
- [x] Hapus service yang khusus memanggil GAS. Selesai via reset
  13 September 2026.
- [x] Hapus bridge HMAC GAS. Selesai via reset 13 September 2026.
- [x] Hapus schema payload GAS archive.
- [x] Hapus util archive sync. Selesai via reset 13 September 2026.
- [x] Hapus util archive dashboard. Selesai via reset 13 September 2026.
- [x] Hapus endpoint sync dan sync-status yang masih tersisa di `/api/local/**`.
- [x] Hapus test active GAS repository/service. Selesai via reset
  13 September 2026.
- [x] Hapus test archive sync yang tidak lagi relevan. Selesai via reset
  13 September 2026.
- [x] Hapus konfigurasi atau helper yang hanya ada untuk `archiveFileDirectory`;
  helper tersebut sudah dihapus dan konfigurasi storage pengajuan sudah tersedia.
- [x] Hapus dokumentasi setup integrasi Google dari repo.
- [x] Pastikan tidak ada dependency module rusak setelah penghapusan.

Catatan reset: service/repository admin, config, members, password,
print-layouts, pengajuan draft, dan queue cetak lama juga sudah dihapus.
Endpoint atau UI yang masih membutuhkan fitur tersebut harus diarahkan ke modul
unified baru, bukan ke implementasi lama.

Acceptance fase 10:

- [x] `rg -n "Apps Script|APPS_SCRIPT|GAS|Google Sheets|Google Drive|gas-bridge|archive-sync|finalizeArchived|getArchiveFile" app server config nuxt.config.ts .env.example package.json README.md`
  tidak menemukan dependency runtime lama.
- [x] `pnpm typecheck` lulus.
- [x] `pnpm lint` lulus.
- [x] `pnpm test` lulus.

Catatan verifikasi Fase 10: pencarian dependency lama pada source runtime tidak
menemukan import atau runtime call di `app`, `server`, config, package script,
atau README. Referensi historis tetap ada di `implementation-plan.md`,
`doc/prd.md`, dan `doc/phase-0-baseline.md`. Command typecheck, lint, dan test
terakhir lulus pada 18 September 2026.

## Fase 11 - Backup, Restore, dan Operasional

Tujuan fase ini adalah membuat aplikasi aman dioperasikan sebagai sistem data
tunggal.

- [ ] Tentukan format backup database.
- [ ] Tentukan format backup storage file.
- [ ] Buat script backup yang mengambil database dan storage dalam satu snapshot
  operasional.
- [ ] Buat script restore ke environment terpisah.
- [ ] Dokumentasikan jadwal backup dan retensi.
- [ ] Dokumentasikan prosedur restore.
- [ ] Dokumentasikan prosedur rollback deployment dan migration.
- [ ] Pastikan storage production bersifat persisten.
- [ ] Pastikan log error tersedia untuk API, pembuatan pengajuan, dan upload
  lampiran.
- [ ] Pastikan audit log dapat ditelusuri untuk operasi penting.
- [ ] Tambahkan test atau smoke script restore minimal jika memungkinkan.

Acceptance fase 11:

- [ ] Backup database dan file dapat dibuat.
- [ ] Restore dapat dilakukan di environment terpisah.
- [ ] Setelah restore, pengajuan, item, status log, dan file masih dapat dibuka.
- [ ] README atau dokumen operasional menjelaskan backup dan restore.

## Fase 12 - Verifikasi Akhir dan Cutover

Tujuan fase ini adalah memastikan implementasi sesuai PRD sebelum dianggap
selesai.

- [x] Jalankan `pnpm typecheck`.
- [x] Jalankan `pnpm lint`.
- [x] Jalankan `pnpm test`.
- [ ] Jalankan `pnpm build`.
- [ ] Jalankan aplikasi dengan env production-like tanpa env Google.
- [ ] Login sebagai admin.
- [ ] Buat satu pengajuan valid melalui form manual dan upload dokumen PDF/JPG.
- [ ] Buka dashboard summary dan chart.
- [ ] Buka daftar pengajuan.
- [ ] Buka detail pengajuan.
- [ ] Buka atau download seluruh file pengajuan.
- [ ] Ubah data utama pengajuan.
- [ ] Setujui atau tolak item.
- [ ] Ubah status pengajuan.
- [x] Atur layout kartu dan aktifkan layout cetak per jenis kartu.
- [ ] Cetak kartu.
- [ ] Cetak label pengiriman.
- [ ] Tandai item sudah dikirim.
- [ ] Verifikasi browser print label pada printer/browser production-like.
- [ ] Ubah pengajuan menjadi `Selesai`.
- [ ] Cari kembali pengajuan `Selesai`.
- [ ] Restart server dan pastikan data serta file tetap ada.
- [x] Jalankan pencarian repo untuk dependency layanan lama.
- [x] Review diff akhir agar tidak ada perubahan unrelated pada task ini.

Acceptance fase 12:

- [ ] Semua command verifikasi lulus.
- [ ] Smoke test workflow admin penuh lulus.
- [ ] Tidak ada dependency runtime ke GAS, Sheets, Drive, bridge, archive sync,
  atau source split.
- [ ] PRD dan README konsisten dengan implementasi.
- [ ] Developer berikutnya dapat menjalankan aplikasi dari dokumentasi tanpa
  mengetahui arsitektur lama.

## Backlog Setelah Form Manual Stabil - Import Excel

Fitur ini bukan acceptance overhaul pertama. Kerjakan hanya setelah pembuatan
pengajuan manual, upload lampiran PDF/JPG, review, cetak, pengiriman, backup,
dan smoke test sudah stabil.

- [ ] Pilih library parser Excel dan tambahkan dependency jika belum tersedia.
- [ ] Definisikan versi template Excel yang didukung.
- [ ] Buat schema Zod untuk row hasil parsing.
- [ ] Buat service preview import.
- [ ] Preview harus menampilkan data hasil mapping, error, warning, dan ringkasan
  jumlah pengajuan/item.
- [ ] Pastikan nomor serial dibaca sebagai teks.
- [ ] Validasi field wajib pelanggan, cabang, model, nomor serial, dan tanggal.
- [ ] Validasi model produk terhadap master `model_produk`.
- [ ] Deteksi duplikasi dalam file yang sama.
- [ ] Deteksi duplikasi terhadap database.
- [ ] Hitung fingerprint file Excel.
- [ ] Tambahkan tabel `import_batches` untuk metadata import, fingerprint file,
  versi template, jumlah row, hasil validasi, actor, dan timestamp.
- [ ] Buat service confirm import.
- [ ] Confirm import membuat batch import, pengajuan, item, file metadata,
  status log, dan audit log.
- [ ] Confirm import menyimpan Excel sumber dan dokumen pendukung ke storage.
- [ ] Confirm import membuat status awal `Baru`.
- [ ] Pastikan confirm import bersifat idempotent terhadap fingerprint yang sudah
  dikonfirmasi.
- [ ] Buat UI `Import Pengajuan` di dashboard sebagai menu terpisah dari
  `Buat Pengajuan`.
- [ ] UI import mendukung pilih Excel, pilih lampiran, preview, koreksi jika
  diperlukan, dan konfirmasi.

Acceptance backlog:

- [ ] Admin dapat import minimal satu pengajuan dengan minimal satu item.
- [ ] Admin dapat import satu pengajuan dengan banyak item.
- [ ] Import invalid gagal sebelum data permanen dibuat.
- [ ] Import duplikat terblokir atau membutuhkan keputusan eksplisit sesuai
  aturan bisnis.
- [ ] Test parser, preview, confirm, fingerprint, dan rollback file lulus.

## Checklist Global Sebelum Merge

- [x] Tidak ada endpoint production dengan path `/api/active`, `/api/local`,
  `/api/archive`, atau `/api/*/sync`.
- [x] Tidak ada query parameter source data `active/local` di UI production.
- [x] Tidak ada browser call ke URL Apps Script.
- [x] Tidak ada server call ke Apps Script, Sheets, atau Drive.
- [x] Tidak ada runtime config Google yang wajib diisi.
- [x] Semua data pengajuan yang sudah tersedia berasal dari database aplikasi.
- [x] Semua file pengajuan yang sudah tersedia ditulis ke storage aplikasi.
- [x] Data `Selesai` tetap berada di database yang sama.
- [x] Semua mutasi API yang sudah tersedia memakai validasi session dan role.
- [x] Semua mutasi lintas tabel yang sudah tersedia memakai transaksi.
- [x] Semua perubahan status yang sudah tersedia menulis `status_log`.
- [x] Semua operasi admin penting yang sudah tersedia menulis `audit_log`.
- [x] Form manual punya validasi, pembuatan pengajuan, upload lampiran, dan
  rollback file.
- [x] Storage file aman dari path traversal pada operasi tulis dan cleanup.
- [ ] Backup dan restore sudah diuji.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, dan `pnpm build` lulus.
  Typecheck, lint, dan test sudah lulus; build belum dijalankan sesuai scope
  task terakhir.

## Catatan Untuk AI Agent Berikutnya

- Mulai dari fase paling awal yang belum selesai.
- Jangan restore file legacy yang sudah dihapus pada reset 13 September 2026,
  kecuali user secara eksplisit meminta recovery file tertentu.
- Baca PRD sebelum mengubah kode.
- Gunakan `rg` untuk mencari jejak arsitektur lama sebelum menghapus atau
  mengganti modul.
- Saat mengganti endpoint, pertahankan kontrak response frontend jika masih
  mungkin.
- Jika harus mengubah kontrak response, update composable, halaman, test, dan
  dokumentasi pada task yang sama.
- Jangan memperkenalkan ulang istilah source `Active` atau `Local`.
- Jangan memakai GAS sebagai fallback runtime.
- Boleh membaca kode GAS lama hanya sebagai referensi aturan bisnis.
- Setiap kali selesai satu fase, update checklist ini dalam commit yang sama
  atau catatan PR agar handoff berikutnya jelas.
