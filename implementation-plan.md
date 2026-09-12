# Implementation Plan - MAUKAGA Fullstack Nuxt

Dokumen ini adalah task list implementasi untuk mengubah MAUKAGA menjadi satu
aplikasi fullstack Nuxt/Nitro sesuai [PRD](doc/prd.md). Gunakan dokumen ini
sebagai panduan kerja developer manusia maupun AI agent.

Target akhir:

- Satu aplikasi Nuxt/Nitro menjadi aplikasi production.
- Satu database aplikasi menjadi sumber kebenaran seluruh pengajuan.
- Satu storage aplikasi menjadi sumber kebenaran seluruh file.
- Tidak ada dependency runtime ke Google Apps Script, Google Sheets, atau
  Google Drive.
- Tidak ada arsitektur sumber data `Active` dan `Local`.
- Tidak ada endpoint, composable, UI, env, service, repository, atau test yang
  masih diperlukan khusus untuk GAS, archive sync, atau pemisahan sumber data.

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

- [ ] Baca [doc/prd.md](doc/prd.md) dan pastikan seluruh anggota tim memahami
  target fullstack Nuxt.
- [ ] Jalankan `git status --short` dan catat file yang sudah berubah sebelum
  mulai kerja.
- [ ] Inventarisasi route Nuxt di `app/pages` yang masih merupakan alur CS atau
  form publik lama.
- [ ] Inventarisasi composable client yang masih memanggil Apps Script, source
  switcher, atau API `active/local/archive`.
- [ ] Inventarisasi endpoint Nitro di `server/api` yang masih memakai path
  `active`, `local`, `archive`, atau `sync`.
- [ ] Inventarisasi repository, service, schema, util, dan test yang masih
  memakai GAS, bridge, archive sync, atau source split.
- [ ] Buat daftar kontrak request/response frontend yang perlu dipertahankan
  sementara agar migrasi UI tidak terlalu besar.
- [ ] Buat daftar aturan bisnis lama yang harus dipindahkan ke service aplikasi,
  termasuk status, keputusan item, cetak, pengiriman, dan validasi model.
- [ ] Buat daftar field database yang belum tersedia untuk workflow baru:
  import, file pengajuan, audit, batch import, dan generator ID.

Acceptance fase 0:

- [ ] Ada daftar file dan fitur terdampak.
- [ ] Ada pemetaan endpoint lama ke endpoint target.
- [ ] Ada daftar aturan bisnis yang harus dipertahankan.
- [ ] Tidak ada perubahan destruktif pada kode di fase ini.

## Fase 1 - Bersihkan Konfigurasi Runtime Eksternal

Tujuan fase ini adalah memastikan konfigurasi production tidak lagi bergantung
pada layanan Google atau aplikasi CS terpisah.

- [ ] Hapus default URL Apps Script dari `nuxt.config.ts`.
- [ ] Hapus runtime config server untuk URL Apps Script.
- [ ] Hapus runtime config server untuk bridge secret GAS.
- [ ] Hapus runtime config public untuk URL Apps Script.
- [ ] Tambahkan runtime config server untuk root storage pengajuan:
  `NUXT_PENGAJUAN_FILE_DIRECTORY`.
- [ ] Tambahkan runtime config public hanya jika diperlukan untuk base path file:
  `NUXT_PUBLIC_PENGAJUAN_FILE_BASE_PATH`.
- [ ] Tambahkan runtime config untuk backup: `NUXT_BACKUP_DIRECTORY`.
- [ ] Update `.env.example` agar hanya berisi env arsitektur Nuxt tunggal.
- [ ] Update dokumentasi setup di `README.md` agar tidak menyebut GAS, Sheets,
  Drive, Cloudflare CS/static, atau URL Apps Script.
- [ ] Pastikan config lama seperti `NUXT_APPS_SCRIPT_API_URL`,
  `NUXT_PUBLIC_APPS_SCRIPT_API_URL`, `NUXT_GAS_BRIDGE_SECRET`, dan
  `GAS_BRIDGE_SECRET` tidak diperlukan untuk boot aplikasi.

Acceptance fase 1:

- [ ] Aplikasi dapat `pnpm dev` tanpa env layanan Google.
- [ ] `rg -n "APPS_SCRIPT|GAS_BRIDGE|script.google|Google Apps Script" nuxt.config.ts .env.example README.md`
  tidak menemukan dependency runtime.
- [ ] Build config masih mengekspos `DATABASE_URL`, `BETTER_AUTH_*`, app info,
  upload limit, dan storage pengajuan.

## Fase 2 - Finalisasi Schema Database Tunggal

Tujuan fase ini adalah membuat schema yang cukup untuk seluruh workflow tanpa
archive sync atau split source.

- [ ] Audit schema saat ini di `server/database/schema`.
- [ ] Pastikan `pengajuan` memiliki field untuk identitas pengajuan, pelanggan,
  cabang, tanggal, status, metadata import, dan timestamp.
- [ ] Pastikan `pengajuan_items` memiliki field untuk model, nomor serial,
  keputusan, catatan, jenis kartu, status cetak, status kirim, dan relasi batch.
- [ ] Pastikan `status_log` menyimpan actor, status lama, status baru, catatan,
  dan timestamp.
- [ ] Tambahkan atau rename tabel file menjadi `pengajuan_files`.
- [ ] Pindahkan makna `archive_files` ke `pengajuan_files` melalui migration,
  bukan hanya rename variabel di kode.
- [ ] Tambahkan tabel `import_batches` untuk metadata import, fingerprint file,
  versi template, jumlah row, hasil validasi, actor, dan timestamp.
- [ ] Tambahkan tabel `audit_log` untuk operasi admin penting.
- [ ] Tambahkan tabel atau konfigurasi generator sequence harian untuk ID
  `MKG-YYYYMMDD-0001`.
- [ ] Pastikan `model_produk`, `print_batch`, `print_layouts`, `config`, dan
  tabel Better Auth tetap kompatibel.
- [ ] Hapus atau migrasikan tabel yang hanya bermakna sync seperti `sync_log`
  dan `sync_meta`.
- [ ] Tambahkan unique constraint untuk ID pengajuan, nomor item, fingerprint
  import, dan kunci bisnis yang wajib unik.
- [ ] Tambahkan index untuk pencarian ID pengajuan, nomor serial, model, status,
  tanggal, dan cabang.
- [ ] Buat migration Drizzle untuk semua perubahan schema.

Acceptance fase 2:

- [ ] `pnpm db:generate` menghasilkan migration yang sesuai.
- [ ] `pnpm db:push` berhasil pada database kosong.
- [ ] Test repository dapat membuat database test dari schema baru.
- [ ] Tidak ada tabel baru yang memakai istilah source `active/local`.
- [ ] Istilah `Local` hanya tersisa sebagai kategori bisnis jika memang masih
  diperlukan untuk jenis kartu garansi.

## Fase 3 - Generator ID Pengajuan

Tujuan fase ini adalah membuat ID pengajuan server-side tanpa bergantung pada
layanan lama.

- [ ] Buat util atau service generator ID, misalnya
  `server/services/pengajuan-id-service.ts`.
- [ ] Gunakan format default `MKG-YYYYMMDD-0001`.
- [ ] Simpan counter per tanggal di database.
- [ ] Jalankan pembuatan ID di dalam transaksi.
- [ ] Pastikan generator aman dari race condition untuk import paralel.
- [ ] Pastikan timezone yang dipakai konsisten dengan timezone aplikasi.
- [ ] Sediakan test untuk beberapa ID di tanggal yang sama.
- [ ] Sediakan test untuk reset counter pada tanggal berbeda.
- [ ] Sediakan test untuk simulasi conflict atau retry transaksi.

Acceptance fase 3:

- [ ] ID tidak bergantung pada nama file atau input browser.
- [ ] ID unik dan deterministic per tanggal/counter.
- [ ] Test generator ID lulus.

## Fase 4 - Service dan Repository Pengajuan Tunggal

Tujuan fase ini adalah membuat lapisan domain yang menggantikan GAS repository,
archive service, dan active/local service.

- [ ] Buat repository utama, misalnya
  `server/repositories/pengajuan-repository.ts`.
- [ ] Buat service utama, misalnya `server/services/pengajuan-service.ts`.
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
- [ ] Implementasikan antrean cetak kartu.
- [ ] Implementasikan penyimpanan jenis kartu garansi.
- [ ] Implementasikan penandaan item sudah dicetak.
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
- [ ] Audit log terisi pada import, update, delete, cetak, dan pengiriman.

## Fase 5 - API Nitro Unified

Tujuan fase ini adalah mengalihkan seluruh pintu masuk dashboard ke endpoint
Nitro tunggal tanpa path source.

- [ ] Buat endpoint `server/api/dashboard.get.ts`.
- [ ] Buat endpoint `server/api/dashboard/chart.get.ts`.
- [ ] Buat endpoint `server/api/pengajuan/index.get.ts`.
- [ ] Buat endpoint `server/api/pengajuan/[idPengajuan].get.ts`.
- [ ] Buat endpoint `server/api/pengajuan/[idPengajuan]/update.post.ts`.
- [ ] Buat endpoint `server/api/pengajuan/[idPengajuan]/status.post.ts`.
- [ ] Buat endpoint `server/api/pengajuan/[idPengajuan]/item-decision.post.ts`.
- [ ] Buat endpoint `server/api/pengajuan/[idPengajuan]/items-decision.post.ts`.
- [ ] Buat endpoint `server/api/pengajuan/[idPengajuan]/delete.post.ts`.
- [ ] Buat endpoint `server/api/pengajuan/bulk-status.post.ts`.
- [ ] Buat endpoint `server/api/model-produk/index.get.ts`.
- [ ] Buat endpoint `server/api/model-produk/review.get.ts`.
- [ ] Buat endpoint antrean cetak: `server/api/warranty-print-queue.get.ts`.
- [ ] Buat endpoint antrean pengiriman:
  `server/api/shipping-label-queue.get.ts`.
- [ ] Pastikan setiap endpoint memvalidasi session Better Auth.
- [ ] Pastikan setiap endpoint mutasi memvalidasi role.
- [ ] Pastikan setiap body dan query divalidasi dengan Zod.
- [ ] Pastikan response error memakai format yang konsisten.
- [ ] Alihkan endpoint lama sementara ke service baru jika perlu masa transisi.
- [ ] Setelah UI selesai dialihkan, hapus endpoint lama `active`, `local`,
  `archive`, dan `sync`.

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
- [ ] Tentukan daftar jenis file: Excel sumber, hardcopy PDF, bukti JPG/PNG,
  dan lampiran lain jika diperlukan.
- [ ] Validasi MIME type dan ekstensi file.
- [ ] Validasi ukuran file terhadap `NUXT_PUBLIC_MAX_UPLOAD_MB`.
- [ ] Hitung checksum `sha256` setiap file.
- [ ] Simpan metadata file ke `pengajuan_files`.
- [ ] Buat route download file yang memvalidasi session dan role.
- [ ] Pastikan route download mengirim MIME type dan filename yang aman.
- [ ] Bersihkan file sementara jika transaksi import gagal.
- [ ] Tambahkan test traversal path seperti `../` dan encoded path.
- [ ] Tambahkan test file missing dan permission denied.

Acceptance fase 6:

- [ ] File tidak dapat ditulis keluar dari root storage.
- [ ] File tidak dapat dibaca tanpa session valid.
- [ ] Metadata database cocok dengan file di storage.
- [ ] Restart server tidak menghilangkan file.

## Fase 7 - Import Excel dan Lampiran

Tujuan fase ini adalah membuat pengajuan baru dari file admin, bukan dari form
publik atau layanan eksternal.

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
- [ ] Simpan metadata preview sementara jika diperlukan.
- [ ] Buat service confirm import.
- [ ] Confirm import membuat batch import, pengajuan, item, file metadata,
  status log, dan audit log.
- [ ] Confirm import menyimpan Excel sumber dan dokumen pendukung ke storage.
- [ ] Confirm import membuat status awal `Baru`.
- [ ] Pastikan confirm import bersifat idempotent terhadap fingerprint yang sudah
  dikonfirmasi.
- [ ] Buat UI `Import Pengajuan` di dashboard.
- [ ] UI import mendukung pilih Excel, pilih lampiran, preview, koreksi jika
  diperlukan, dan konfirmasi.

Acceptance fase 7:

- [ ] Admin dapat import minimal satu pengajuan dengan minimal satu item.
- [ ] Admin dapat import satu pengajuan dengan banyak item.
- [ ] Import invalid gagal sebelum data permanen dibuat.
- [ ] Import duplikat terblokir atau membutuhkan keputusan eksplisit sesuai
  aturan bisnis.
- [ ] Test parser, preview, confirm, dan rollback file lulus.

## Fase 8 - Lifecycle, Item Decision, Cetak, dan Pengiriman

Tujuan fase ini adalah memastikan workflow operasional berjalan sepenuhnya dari
database aplikasi.

- [ ] Definisikan transisi status yang diperbolehkan.
- [ ] Validasi status `Baru`, `Disetujui`, `Ditolak`, `Diprint`, `Dikirim`, dan
  `Selesai`.
- [ ] Pastikan status lama seperti `Menunggu Upload` dan `Diterima` tidak dipakai
  untuk pengajuan baru.
- [ ] Pastikan catatan wajib untuk penolakan.
- [ ] Pastikan keputusan item memengaruhi status pengajuan sesuai aturan bisnis.
- [ ] Pastikan item yang belum valid modelnya tidak bisa masuk proses cetak jika
  aturan bisnis melarangnya.
- [ ] Implementasikan queue cetak dari database aplikasi.
- [ ] Implementasikan simpan jenis kartu garansi.
- [ ] Implementasikan batch cetak dan penandaan item sudah dicetak.
- [ ] Implementasikan queue label pengiriman dari database aplikasi.
- [ ] Implementasikan batch pengiriman atau penandaan item sudah dikirim.
- [ ] Pastikan perubahan cetak dan kirim menulis `status_log` atau audit log
  sesuai jenis perubahan.
- [ ] Pastikan data berstatus `Selesai` tetap muncul saat dicari.

Acceptance fase 8:

- [ ] Workflow dari `Baru` sampai `Selesai` bisa dijalankan tanpa layanan
  eksternal.
- [ ] Semua perubahan penting punya actor dan timestamp.
- [ ] Test transisi status, keputusan item, cetak, dan pengiriman lulus.

## Fase 9 - Alihkan Frontend Dashboard

Tujuan fase ini adalah menghapus asumsi source split dari UI dan composable.

- [ ] Hapus komponen source switcher dari dashboard.
- [ ] Hapus state dashboard source dari composable.
- [ ] Hapus query parameter `source` dari dashboard, list, detail, cetak, dan
  halaman lain.
- [ ] Alihkan `useDashboardData` ke `/api/dashboard`.
- [ ] Alihkan chart ke `/api/dashboard/chart`.
- [ ] Alihkan daftar pengajuan ke `/api/pengajuan`.
- [ ] Alihkan detail pengajuan ke `/api/pengajuan/[idPengajuan]`.
- [ ] Alihkan mutasi pengajuan ke endpoint unified.
- [ ] Alihkan antrean cetak ke `/api/warranty-print-queue`.
- [ ] Alihkan antrean pengiriman ke `/api/shipping-label-queue`.
- [ ] Hapus composable `useAppsScriptApi`, `useActiveApi`, dan composable lain
  yang hanya ada untuk layanan lama.
- [ ] Hapus label UI yang menyebut sumber data `Active` atau `Local`.
- [ ] Pastikan istilah `Local` yang tersisa hanya kategori bisnis jenis kartu,
  bukan mode data.
- [ ] Hapus halaman CS/public lama dari production route jika sudah tidak
  menjadi scope produk.
- [ ] Tambahkan halaman `Import Pengajuan` pada navigasi dashboard.

Acceptance fase 9:

- [ ] Dashboard dapat dipakai tanpa memilih source.
- [ ] Tidak ada request browser ke endpoint lama.
- [ ] `rg -n "source=|dashboardSource|isArchive|/api/active|/api/local|/api/archive" app`
  tidak menemukan dependency UI production.
- [ ] Smoke test UI dashboard utama lulus.

## Fase 10 - Hapus Integrasi GAS dan Sync Lama

Tujuan fase ini adalah membersihkan kode runtime yang sudah digantikan agar
arsitektur target benar-benar murni Nuxt.

- [ ] Hapus repository yang khusus memanggil GAS.
- [ ] Hapus service yang khusus memanggil GAS.
- [ ] Hapus bridge HMAC GAS.
- [ ] Hapus schema payload GAS archive.
- [ ] Hapus util archive sync.
- [ ] Hapus util archive dashboard jika sudah digantikan service baru.
- [ ] Hapus endpoint sync dan sync-status.
- [ ] Hapus test active GAS repository/service.
- [ ] Hapus test archive sync yang tidak lagi relevan.
- [ ] Hapus konfigurasi atau helper yang hanya ada untuk `archiveFileDirectory`
  jika sudah diganti storage pengajuan.
- [ ] Hapus dokumentasi setup integrasi Google dari repo.
- [ ] Pastikan tidak ada import rusak setelah penghapusan.

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
- [ ] Pastikan log error tersedia untuk API dan import.
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
- [ ] Import satu file Excel valid dan dokumen PDF/JPG.
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
- [ ] Import Excel punya preview, validasi, fingerprint, dan rollback file.
- [ ] Storage file aman dari path traversal.
- [ ] Backup dan restore sudah diuji.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, dan `pnpm build` lulus.

## Catatan Untuk AI Agent Berikutnya

- Mulai dari fase paling awal yang belum selesai.
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
