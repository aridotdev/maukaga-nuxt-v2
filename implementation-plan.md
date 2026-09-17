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
atas schema database unified. Pekerjaan berikutnya adalah membangun pengganti
unified untuk service, API, dan UI operasional sesuai PRD target.

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

Per 18 September 2026, alur dasar cetak kartu garansi sudah tersedia di
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
- Template print saat ini fixed dan menggunakan browser print A4. Editor layout
  belum menjadi bagian implementasi ini; `layoutId` batch tetap nullable untuk
  pengembangan layout terkelola pada fase berikutnya.
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
- `server/repositories/pengajuan-repository.ts`
- `server/services/pengajuan-service.ts`
- `tests/warranty-print-queue-service.test.ts`

Verifikasi fitur ini: `pnpm test`, `pnpm typecheck`, `pnpm lint`, dan
`git diff --check` berhasil pada 18 September 2026. `pnpm build` tidak
dijalankan sebagai bagian dari task ini.

## Fase 4 - Service dan Repository Pengajuan Tunggal

Tujuan fase ini adalah membuat lapisan domain yang menggantikan GAS repository,
archive service, dan active/local service.

- [ ] Buat repository utama, misalnya
  `server/repositories/pengajuan-repository.ts`.
- [ ] Buat service utama, misalnya `server/services/pengajuan-service.ts`.
- [ ] Jangan menghidupkan kembali repository/service lama dari git history;
  gunakan nama file lama hanya jika implementasinya sudah benar-benar unified.
- [ ] Pastikan repository hanya berisi operasi database.
- [ ] Pastikan service berisi aturan bisnis, validasi workflow, transaksi, dan
  orchestration.
- [ ] Implementasikan pembacaan dashboard summary dari database aplikasi.
- [ ] Implementasikan pembacaan chart dari database aplikasi.
- [ ] Implementasikan daftar pengajuan dengan filter status, tanggal, cabang,
  model, nomor serial, dan search umum.
- [ ] Implementasikan detail pengajuan lengkap beserta item, file, status log,
  dan metadata.
- [ ] Implementasikan update data utama pengajuan.
- [ ] Implementasikan update status pengajuan.
- [ ] Implementasikan keputusan satu item.
- [ ] Implementasikan keputusan banyak item.
- [ ] Implementasikan hapus pengajuan sesuai kebijakan audit.
- [ ] Implementasikan pembacaan dan update master model produk.
- [x] Implementasikan antrean cetak kartu dari item yang disetujui dan belum
  dicetak.
- [x] Implementasikan penyimpanan jenis kartu garansi (`Local` atau `Import`).
- [x] Implementasikan penandaan item sudah dicetak melalui batch.
- [ ] Implementasikan antrean label pengiriman.
- [ ] Implementasikan penandaan item sudah dikirim.
- [ ] Implementasikan pembacaan file metadata.
- [ ] Implementasikan audit log untuk mutasi penting.
- [ ] Pastikan setiap mutasi lintas tabel memakai transaksi.

Acceptance fase 4:

- [ ] Tidak ada service baru yang memanggil GAS, Sheets, Drive, atau bridge.
- [ ] Payload service kompatibel dengan kebutuhan UI saat ini atau perubahan UI
  tercatat jelas.
- [ ] Unit test service/repository mencakup happy path dan error path utama.
- [ ] `status_log` terisi pada setiap perubahan status.
- [ ] Audit log terisi pada pembuatan pengajuan, update, delete, cetak, dan
  pengiriman.

## Fase 5 - API Nitro Unified

Tujuan fase ini adalah mengalihkan seluruh pintu masuk dashboard ke endpoint
Nitro tunggal tanpa path source.

- [ ] Buat endpoint `server/api/dashboard.get.ts`.
- [ ] Buat endpoint `server/api/dashboard/chart.get.ts`.
- [ ] Buat endpoint `server/api/pengajuan/index.get.ts`.
- [ ] Buat endpoint `server/api/pengajuan/[idPengajuan].get.ts`.
- [ ] Buat endpoint `server/api/pengajuan/create.post.ts`.
- [ ] Buat endpoint `server/api/pengajuan/[idPengajuan]/update.post.ts`.
- [ ] Buat endpoint `server/api/pengajuan/[idPengajuan]/status.post.ts`.
- [ ] Buat endpoint `server/api/pengajuan/[idPengajuan]/item-decision.post.ts`.
- [ ] Buat endpoint `server/api/pengajuan/[idPengajuan]/items-decision.post.ts`.
- [ ] Buat endpoint `server/api/pengajuan/[idPengajuan]/delete.post.ts`.
- [ ] Buat endpoint `server/api/pengajuan/bulk-status.post.ts`.
- [ ] Buat endpoint `server/api/model-produk/index.get.ts`.
- [ ] Buat endpoint `server/api/model-produk/review.get.ts`.
- [x] Buat endpoint antrean cetak:
  `server/api/warranty-print-queue.get.ts`.
- [x] Buat endpoint penyimpanan jenis kartu:
  `server/api/warranty-print-queue/types.post.ts`.
- [x] Buat endpoint batch penandaan cetak:
  `server/api/warranty-print-queue/print.post.ts`.
- [ ] Buat endpoint antrean pengiriman:
  `server/api/shipping-label-queue.get.ts`.
- [ ] Pastikan setiap endpoint memvalidasi session Better Auth.
- [ ] Pastikan setiap endpoint mutasi memvalidasi role.
- [ ] Pastikan setiap body dan query divalidasi dengan Zod.
- [ ] Pastikan response error memakai format yang konsisten.
- [ ] Jangan membuat compatibility endpoint untuk `/api/active/**` atau
  `/api/archive/**`; route tersebut sudah dihapus pada reset awal.
- [ ] Hapus atau bangun ulang endpoint yang masih menggantung ke service lama:
  `/api/local/sync`, `/api/local/sync-status`, `/api/local/warranty-print-queue`,
  dan `/api/pengajuan/actions/[action]`.
- [ ] Bangun ulang endpoint admin target yang masih diperlukan sesuai PRD:
  bootstrap, password, members, config, dan print layouts.

Acceptance fase 5:

- [ ] Browser dashboard memakai endpoint unified.
- [ ] Tidak ada endpoint production yang membutuhkan `source=active`,
  `source=local`, `/api/active`, `/api/local`, `/api/archive`, atau sync.
- [ ] Test endpoint mencakup unauthorized, forbidden, valid request, dan invalid
  payload.

## Fase 6 - Storage File Pengajuan

Tujuan fase ini adalah menyimpan dan menyajikan seluruh dokumen dari storage
aplikasi.

- [ ] Buat util path storage, misalnya `server/utils/pengajuan-file-storage.ts`.
- [ ] Pastikan root storage berasal dari `NUXT_PENGAJUAN_FILE_DIRECTORY`.
- [ ] Gunakan struktur default `storage/pengajuan/{ID Pengajuan}/...`.
- [ ] Normalisasi ID pengajuan sebelum menjadi nama directory.
- [ ] Jangan pernah memakai path atau filename mentah dari browser sebagai path
  final.
- [ ] Tentukan daftar jenis file: hardcopy PDF wajib, bukti JPG, dan lampiran
  PDF/JPG lain jika diperlukan.
- [ ] Validasi MIME type dan ekstensi file.
- [ ] Validasi ukuran file terhadap `NUXT_PUBLIC_MAX_UPLOAD_MB`.
- [ ] Hitung checksum `sha256` setiap file.
- [ ] Simpan metadata file ke `pengajuan_files`.
- [ ] Buat route download file yang memvalidasi session dan role.
- [ ] Pastikan route download mengirim MIME type dan filename yang aman.
- [ ] Bersihkan file sementara jika transaksi pembuatan pengajuan atau upload
  gagal.
- [ ] Tambahkan test traversal path seperti `../` dan encoded path.
- [ ] Tambahkan test file missing dan permission denied.

Acceptance fase 6:

- [ ] File tidak dapat ditulis keluar dari root storage.
- [ ] File tidak dapat dibaca tanpa session valid.
- [ ] Metadata database cocok dengan file di storage.
- [ ] Restart server tidak menghilangkan file.

## Fase 7 - Form Manual dan Lampiran

Tujuan fase ini adalah membuat pengajuan baru langsung dari aplikasi melalui
form manual admin, disertai upload lampiran pendukung PDF/JPG pada alur yang
sama. Fase ini menjadi prioritas utama overhaul pertama; import Excel tidak
dibangun dulu sampai workflow manual stabil.

- [ ] Definisikan schema Zod untuk payload form pengajuan.
- [ ] Definisikan schema Zod untuk satu atau banyak item pengajuan.
- [ ] Definisikan schema validasi lampiran PDF/JPG.
- [ ] Buat service `createPengajuan` atau padanan lokal yang membuat pengajuan
  dari input manual.
- [ ] Service create harus membuat ID pengajuan, pengajuan, item, file metadata,
  status log, dan audit log.
- [ ] Service create harus menyimpan lampiran PDF/JPG ke storage aplikasi.
- [ ] Service create membuat status awal `Baru`.
- [ ] Validasi field wajib pengajuan, cabang, model, nomor serial, tanggal, dan
  hardcopy PDF; jangan menambahkan data kontak yang tidak diperlukan.
- [ ] Validasi model produk terhadap master `model_produk`.
- [ ] Pastikan nomor serial diperlakukan sebagai teks.
- [ ] Deteksi duplikasi item dalam form yang sama.
- [ ] Deteksi duplikasi terhadap database secara global untuk kombinasi model +
  nomor serial, termasuk record soft-deleted.
- [ ] Validasi MIME type, ekstensi, ukuran file, checksum, dan filename aman.
- [ ] Pastikan data permanen tidak dibuat jika validasi form atau lampiran
  gagal.
- [ ] Pastikan transaksi database dan penyimpanan file punya rollback/cleanup
  yang jelas jika salah satu tahap gagal.
- [ ] Buat UI `Buat Pengajuan` di dashboard.
- [ ] UI form mendukung tambah/hapus item, validasi inline, upload lampiran,
  koreksi data, dan submit.
- [ ] Tampilkan error dan warning validasi dengan pesan yang dapat ditindak
  lanjuti admin.
- [ ] Setelah submit sukses, arahkan admin ke detail pengajuan baru.

Acceptance fase 7:

- [ ] Admin dapat membuat minimal satu pengajuan dengan minimal satu item.
- [ ] Admin dapat membuat satu pengajuan dengan banyak item.
- [ ] Admin wajib melampirkan hardcopy PDF dan dapat menambahkan bukti/lampiran
  PDF/JPG pada level pengajuan.
- [ ] Input invalid gagal sebelum data permanen dibuat.
- [ ] Duplikasi terblokir atau membutuhkan keputusan eksplisit sesuai aturan
  bisnis.
- [ ] Test validasi form, service create, penyimpanan lampiran, dan rollback file
  lulus.

## Fase 8 - Lifecycle, Item Decision, Cetak, dan Pengiriman

Tujuan fase ini adalah memastikan workflow operasional berjalan sepenuhnya dari
database aplikasi.

- [ ] Definisikan transisi status yang diperbolehkan.
- [ ] Validasi status `Baru`, `Disetujui`, `Ditolak`, `Diprint`, `Dikirim`, dan
  `Selesai`.
- [ ] Pisahkan keputusan item `Menunggu`/`Disetujui`/`Ditolak` dari status
  pengajuan.
- [ ] Izinkan keputusan item campuran dalam satu pengajuan.
- [ ] Perlakukan `Ditolak` sebagai final pada alur normal; hanya admin yang
  dapat mengubahnya kembali ke `Baru`, dengan audit dan alasan.
- [x] Perbarui status `Diprint` otomatis dari event item cetak, bukan
  melalui perubahan manual yang melewati batch. Status `Dikirim` tetap menunggu
  implementasi antrean pengiriman.
- [ ] Perbarui status `Dikirim` otomatis dari event item, bukan
  melalui perubahan manual yang melewati batch.
- [ ] Izinkan `Selesai` hanya jika minimal satu item sudah dikirim dan setiap
  item lainnya ditolak atau sudah dikirim; jika semua item ditolak, status tetap
  `Ditolak`.
- [ ] Pastikan status lama seperti `Menunggu Upload` dan `Diterima` tidak dipakai
  untuk pengajuan baru.
- [ ] Pastikan catatan wajib untuk penolakan.
- [ ] Pastikan keputusan item memengaruhi status pengajuan sesuai aturan bisnis.
- [ ] Pastikan item yang belum valid modelnya tidak bisa masuk proses cetak jika
  aturan bisnis melarangnya.
- [x] Implementasikan queue cetak dari database aplikasi.
- [x] Implementasikan simpan jenis kartu garansi.
- [x] Implementasikan batch cetak dan penandaan item sudah dicetak.
- [ ] Simpan setiap cetak ulang sebagai batch baru; jangan menimpa histori.
- [ ] Implementasikan queue label pengiriman dari database aplikasi.
- [ ] Implementasikan batch pengiriman atau penandaan item sudah dikirim.
- [ ] Simpan setiap pengiriman ulang sebagai batch baru; jangan menimpa histori.
- [x] Pastikan perubahan cetak menulis `status_log` item dan `audit_log` batch.
  Perubahan kirim tetap menunggu implementasi antrean pengiriman.
- [ ] Pastikan data berstatus `Selesai` tetap muncul saat dicari.

Acceptance fase 8:

- [ ] Workflow dari `Baru` sampai `Selesai` bisa dijalankan tanpa layanan
  eksternal.
- [ ] Semua perubahan penting punya actor dan timestamp.
- [ ] Test transisi status, keputusan item, cetak, dan pengiriman lulus.

## Fase 9 - Alihkan Frontend Dashboard

Tujuan fase ini adalah menghapus asumsi source split dari UI dan composable.

- [x] Hapus komponen source switcher dari dashboard.
- [x] Hapus state dashboard source dari composable.
- [x] Hapus query parameter `source` dari dashboard, list, detail, cetak, dan
  halaman lain.
- [ ] Buat composable unified pengganti untuk dashboard ke `/api/dashboard`.
- [ ] Buat composable unified pengganti untuk chart ke `/api/dashboard/chart`.
- [ ] Buat composable unified pengganti untuk daftar pengajuan ke
  `/api/pengajuan`.
- [ ] Buat composable unified pengganti untuk detail pengajuan ke
  `/api/pengajuan/[idPengajuan]`.
- [ ] Buat composable unified pengganti untuk mutasi pengajuan.
- [ ] Buat composable unified pengganti untuk antrean cetak ke
  `/api/warranty-print-queue`. Saat ini halaman cetak menggunakan `useFetch`
  langsung karena hanya memiliki satu workflow queue.
- [ ] Buat composable unified pengganti untuk antrean pengiriman ke
  `/api/shipping-label-queue`.
- [x] Hapus composable `useAppsScriptApi`, `useActiveApi`, `useActiveQuery`,
  `useAdminBffApi`, `useDashboardData`, `useDashboardDataSource`,
  `usePengajuanApi`, `usePengajuanDetail`, dan `useDraftReferenceStorage` dari
  working tree. Selesai via reset 13 September 2026.
- [x] Hapus label UI yang menyebut sumber data `Active` atau `Local`.
- [x] Pastikan istilah `Local` yang tersisa hanya kategori bisnis jenis kartu,
  bukan mode data.
- [x] Hapus halaman CS/public lama dari production route jika sudah tidak
  menjadi scope produk.
- [ ] Tambahkan halaman `Buat Pengajuan` pada navigasi dashboard.
- [x] Tambahkan halaman antrean `Cetak Kartu Garansi` pada navigasi dashboard
  dengan mode mutasi sesuai role.

Acceptance fase 9:

- [x] Dashboard dapat dipakai tanpa memilih source.
- [x] Tidak ada request browser ke endpoint lama.
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

- [ ] `rg -n "Apps Script|APPS_SCRIPT|GAS|Google Sheets|Google Drive|gas-bridge|archive-sync|finalizeArchived|getArchiveFile" . --glob '!node_modules' --glob '!.git'`
  hanya menemukan catatan historis yang sengaja dipertahankan, bukan runtime.
- [ ] `pnpm typecheck` lulus.
- [ ] `pnpm lint` lulus.
- [ ] `pnpm test` lulus.

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

- [ ] Jalankan `pnpm typecheck`.
- [ ] Jalankan `pnpm lint`.
- [ ] Jalankan `pnpm test`.
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
- [ ] Cetak kartu.
- [ ] Cetak label pengiriman.
- [ ] Tandai item sudah dikirim.
- [ ] Ubah pengajuan menjadi `Selesai`.
- [ ] Cari kembali pengajuan `Selesai`.
- [ ] Restart server dan pastikan data serta file tetap ada.
- [ ] Jalankan pencarian repo untuk dependency layanan lama.
- [ ] Review diff akhir agar tidak ada perubahan unrelated.

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

- [ ] Tidak ada endpoint production dengan path `/api/active`, `/api/local`,
  `/api/archive`, atau `/api/*/sync`.
- [ ] Tidak ada query parameter source data `active/local` di UI production.
- [ ] Tidak ada browser call ke URL Apps Script.
- [ ] Tidak ada server call ke Apps Script, Sheets, atau Drive.
- [ ] Tidak ada runtime config Google yang wajib diisi.
- [ ] Semua data pengajuan berasal dari database aplikasi.
- [ ] Semua file pengajuan berasal dari storage aplikasi.
- [ ] Data `Selesai` tetap berada di database yang sama.
- [ ] Semua mutasi penting memakai validasi session dan role.
- [ ] Semua mutasi lintas tabel memakai transaksi.
- [ ] Semua perubahan status menulis `status_log`.
- [ ] Semua operasi admin penting menulis `audit_log`.
- [ ] Form manual punya validasi, pembuatan pengajuan, upload lampiran, dan
  rollback file.
- [ ] Storage file aman dari path traversal.
- [ ] Backup dan restore sudah diuji.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, dan `pnpm build` lulus.

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
