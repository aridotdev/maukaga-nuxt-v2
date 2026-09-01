# PRD MAUKAGA - Hybrid Active/Local Architecture

Dokumen ini adalah single source of truth MAUKAGA mulai versi arsitektur hybrid. Jika ada dokumen, prompt, atau catatan lama yang berbeda, ikuti dokumen ini.

## 1. Ringkasan

MAUKAGA adalah aplikasi internal untuk Pengajuan Cetak Ulang Kartu Garansi. Arsitektur terbaru memisahkan data aktif dan data lokal agar aplikasi tidak lagi bergantung penuh pada kapasitas Google Apps Script, Google Sheets, Drive, dan CacheService.

Prinsip utama:

- Data aktif tetap berada di Google Apps Script, Google Sheets, dan Google Drive.
- Data historis dengan status `Selesai` dipindahkan oleh Nitro ke SQLite lokal.
- File lampiran pengajuan selesai diunduh ke `public/arsip_file`.
- Setelah data dan file lokal aman, Nitro meminta GAS untuk menghapus baris aktif dan memindahkan file Drive ke trash.
- Nuxt/Nitro menjadi BFF admin, sedangkan build CS static tetap boleh langsung memanggil GAS untuk flow publik.

Catatan terminologi: istilah produk dan UI untuk data historis adalah `Local`. Beberapa identifier teknis masih memakai nama `archive` karena sudah ada di kode dan database, seperti `server/schemas/gas-archive.ts`, tabel `archive_files`, env `NUXT_ARCHIVE_FILE_DIRECTORY`, dan GAS action `getArchiveFile`/`finalizeArchivedPengajuan`. Rename identifier teknis ini adalah pekerjaan kode terpisah, bukan bagian dari perubahan dokumen ini.
## 2. Tujuan Arsitektur

- Menghindari limit memori GAS saat dashboard membaca data besar.
- Menghindari limit 100KB CacheService untuk data historis.
- Menjaga Google Sheets tetap ringan karena hanya memuat data aktif.
- Menyediakan data lokal yang cepat dicari untuk kebutuhan historis.
- Menjaga file lampiran pengajuan selesai tetap bisa dibuka dari aplikasi melalui path publik lokal.
- Mengurangi risiko browser admin memanggil endpoint GAS secara langsung.

## 3. Komponen Sistem

| Komponen | Lokasi | Tanggung jawab |
| --- | --- | --- |
| Admin Nuxt/Nitro | root project | Dashboard admin, auth internal, Nitro API, active proxy, local API, local sync. |
| CS Static Nuxt | `apps/cs-web` | Form publik CS, draft, upload final, cek status; hasil build static. |
| Shared UI/logic | `packages/shared` | Komponen, composable, type, dan helper yang dipakai root dan CS static. |
| GAS Active DB/Proxy | `doc/Code.gs` | API aktif, Google Sheets, Google Drive, validasi GAS, finalisasi lokal. |
| SQLite Local DB | `.data/maukaga.db` | Data historis lokal via Drizzle ORM. |
| Local files | `public/arsip_file` | Hardcopy dan bukti foto yang sudah diunduh dari Drive. |
| Validation | Zod | Validasi payload Nitro, schema offloading lokal, dan input admin lokal. |

## 4. Batas Aplikasi

Root admin app:

- Browser admin login melalui Better Auth di `/api/auth/*`.
- Browser admin memanggil Nitro API, bukan GAS langsung.
- Nitro API `/api/active/*` menjadi proxy untuk data aktif di GAS.
- Nitro API `/api/local/*` membaca data lokal SQLite.
- Local sync berjalan dari Nitro dan membutuhkan session admin valid.

CS static app:

- Dibuild dari `apps/cs-web` dengan `pnpm build:cs`.
- Tidak membutuhkan Node runtime saat serving.
- Memanggil `NUXT_PUBLIC_APPS_SCRIPT_API_URL` secara langsung karena flow publik tetap berada di GAS.
- Tidak membawa route, middleware, composable, atau API admin.

GAS:

- Tetap menjadi active store dan Drive proxy.
- Tetap bertanggung jawab atas pembuatan ID pengajuan, draft, final submit, update status aktif, dan file aktif.
- Menyediakan action offloading lokal: `getPengajuanList`, `getDetail`, `getArchiveFile`, dan `finalizeArchivedPengajuan`.

## 5. Lifecycle Data

Status pengajuan terbaru:

| Status | Lokasi utama | Keterangan |
| --- | --- | --- |
| `Menunggu Upload` | GAS | Draft publik sudah dibuat, file hardcopy signed belum diupload. |
| `Baru` | GAS | Final submit sudah masuk dan menunggu proses admin. |
| `Disetujui` | GAS | Pengajuan disetujui; item bisa lanjut ke proses cetak jika produk verified. |
| `Ditolak` | GAS | Pengajuan ditolak; catatan admin wajib. |
| `Diprint` | GAS | Kartu garansi sudah dicetak. |
| `Dikirim` | GAS | Kartu garansi sudah dikirim. |
| `Selesai` | GAS lalu SQLite | Pengajuan selesai dan eligible untuk local sync. |

Catatan: `Diterima` bukan bagian lifecycle terbaru. Jika ada data lama dengan status itu, lakukan migrasi/backfill ke status yang valid sebelum local sync.

## 6. Local Sync

Local sync adalah proses offloading dari GAS ke SQLite.

Alur normal:

1. Admin menekan sync atau proses terjadwal memanggil `/api/local/sync`.
2. Nitro memvalidasi session admin.
3. Nitro mengambil daftar pengajuan `Selesai` dari GAS dengan action `getPengajuanList`.
4. Untuk setiap ID, Nitro mengambil detail lengkap melalui action `getDetail`.
5. Payload divalidasi oleh Zod schema `server/schemas/gas-archive.ts`.
6. Data di-upsert ke SQLite melalui Drizzle: `pengajuan`, `pengajuan_items`, `status_log`, dan `archive_files`.
7. Nitro meminta file ke GAS melalui action `getArchiveFile`.
8. Nitro menyimpan file ke `public/arsip_file`.
9. Nitro menghitung metadata file seperti `sha256`, MIME type, dan ukuran.
10. Jika semua file wajib tersedia lokal, Nitro memanggil `finalizeArchivedPengajuan`.
11. GAS memverifikasi status masih `Selesai`, memindahkan file Drive ke trash, lalu menghapus baris dari sheet aktif.
12. Nitro menandai file lokal sebagai `drive_trashed` dan mencatat hasil sync ke `sync_log` dan `sync_meta`.

Mode sync yang tersedia di schema:

| Mode | Status implementasi |
| --- | --- |
| `full` | Mengambil daftar `Selesai` dari GAS lalu memproses semuanya sesuai limit. |
| `detail` | Memproses satu `idPengajuan`; wajib mengirim ID. |
| `changed` | Tersedia di enum, tetapi belum menjadi incremental delta yang sebenarnya. |
| `background` | Tersedia di enum, tetapi belum punya scheduler produksi. |
| `manual` | Tersedia di enum dan dipakai sebagai variasi operasi manual. |

## 7. Kontrak File Lokal

Folder lokal default:

- Directory server: `public/arsip_file`
- Public base path: `/arsip_file`

Nama file deterministic:

| Jenis | Format |
| --- | --- |
| Hardcopy signed | `{ID Pengajuan}_hardcopy.pdf` |
| Bukti foto | `{ID Pengajuan}_bukti_01.jpg`, `{ID Pengajuan}_bukti_02.jpg`, dst. |

Aturan:

- Path publik harus selalu diawali `/arsip_file/`.
- File tidak boleh menulis keluar dari local directory.
- Finalisasi GAS hanya boleh dilakukan setelah file lokal berhasil diunduh atau sudah pernah aman dengan status `drive_trashed`.
- Jika file tidak ditemukan atau gagal diunduh, GAS tidak boleh difinalisasi untuk ID tersebut.

## 8. API Ownership

Public CS direct-GAS actions:

- `saveDraftPengajuan`
- `getDraftPengajuan`
- `checkDraftPengajuanStatus`
- `submitDraftPengajuan`
- `checkPengajuanStatus`
- `checkPengajuanStatusBySerial`
- `getModelProduk`

Admin active API via Nitro:

- `/api/active/dashboard`
- `/api/active/chart`
- `/api/active/pengajuan`
- `/api/active/pengajuan/[idPengajuan]`
- `/api/active/pengajuan/[idPengajuan]/update`
- `/api/active/pengajuan/[idPengajuan]/status`
- `/api/active/pengajuan/[idPengajuan]/item-decision`
- `/api/active/pengajuan/[idPengajuan]/delete`
- `/api/active/pengajuan/bulk-status`
- `/api/active/actions/[action]`

Admin local API via Nitro:

- `/api/local/dashboard`
- `/api/local/chart`
- `/api/local/pengajuan/[idPengajuan]`
- `/api/local/sync`
- `/api/local/sync-status`

Admin local API:

- `/api/auth/*`
- `/api/admin/bootstrap`
- `/api/admin/password`
- `/api/admin/members`

## 9. Data Store

GAS active sheets tetap menjadi sumber data aktif untuk:

- `Pengajuan`
- `PengajuanItems`
- `StatusLog`
- `ModelProduk`
- `WarrantyCards`
- `PrintBatch`
- `PrintLayouts`
- `EmailRecipients`
- `EmailLog`
- `Config`

SQLite local memakai tabel:

- `pengajuan`
- `pengajuan_items`
- `status_log`
- `archive_files`
- `sync_log`
- `sync_meta`
- `model_produk`
- `print_batch`
- `print_layouts`
- `email_recipients`
- `email_log`
- `config`
- Better Auth tables: `user`, `account`, `session`, `verification`

## 10. Auth dan Role

Role admin lokal:

- `admin`
- `qrcc`
- `management`

Kontrak terbaru:

- Admin user dikelola di SQLite melalui Better Auth dan endpoint `/api/admin/*`.
- Session admin divalidasi oleh Nitro sebelum mengakses data active atau local.
- Browser admin tidak menyimpan atau mengirim token GAS secara langsung.
- Nitro membuat signed server-to-server bridge berbasis HMAC-SHA256 untuk setiap panggilan admin ke GAS active/proxy endpoint.
- Body bridge berisi `action`, `bridge.version`, `bridge.timestamp`, `bridge.nonce`, `bridge.actor`, dan `bridgeSignature`.
- GAS memvalidasi allowlist action, umur signature maksimal 5 menit, nonce sekali pakai via CacheService, dan secret `GAS_BRIDGE_SECRET` dari Script Properties sebelum menjalankan action admin.
- Session/token GAS lama hanya fallback kompatibilitas untuk endpoint legacy dan bukan kontrak utama admin Nuxt.
- Endpoint admin GAS lama seperti login dan user management tetap dianggap legacy compatibility, bukan jalur operasional utama root app.

Kebutuhan operasional:

- Nilai `NUXT_GAS_BRIDGE_SECRET` di Nitro harus sama persis dengan Script Property `GAS_BRIDGE_SECRET` di Apps Script.

## 11. Runtime Configuration

| Env key | Dipakai oleh | Keterangan |
| --- | --- | --- |
| `NUXT_APPS_SCRIPT_API_URL` | Nitro server | URL GAS Web App untuk active proxy dan local sync. |
| `NUXT_GAS_BRIDGE_SECRET` | Nitro server | Secret HMAC untuk signing request server-to-server ke GAS. Nilainya harus sama dengan Script Property `GAS_BRIDGE_SECRET`. |
| `GAS_BRIDGE_SECRET` | Apps Script Script Properties / Nitro fallback | Secret HMAC yang divalidasi GAS; dapat menjadi alias fallback server lokal. |
| `NUXT_PUBLIC_APPS_SCRIPT_API_URL` | CS static/public runtime | URL GAS Web App yang boleh terekspos ke browser untuk flow CS. |
| `DATABASE_URL` | Drizzle/libSQL | URL SQLite/libSQL, default `file:.data/maukaga.db`. |
| `NUXT_DATABASE_URL` | Nuxt runtime | Alias server runtime untuk database. |
| `NUXT_ARCHIVE_FILE_DIRECTORY` | Nitro server | Directory file lokal, default `public/arsip_file`. |
| `ARCHIVE_FILE_DIRECTORY` | server utility | Alias non-Nuxt untuk directory file lokal. |
| `NUXT_PUBLIC_ARCHIVE_FILE_BASE_PATH` | Public runtime | Base path file lokal, default `/arsip_file`. |
| `NUXT_APP_URL` | Nitro/Better Auth | URL root admin app server-side. |
| `NUXT_PUBLIC_APP_URL` | Public runtime | URL publik app jika perlu dibaca client. |
| `BETTER_AUTH_URL` | Better Auth | Base URL auth, biasanya sama dengan URL admin production. |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Better Auth | Daftar origin yang dipercaya, pisahkan dengan koma. |
| `BETTER_AUTH_SECRET` | Better Auth | Secret produksi untuk signing/encryption Better Auth. |
| `ADMIN_BOOTSTRAP_TOKEN` | Admin bootstrap | Token untuk membuat admin pertama di production. |
| `NUXT_PUBLIC_APP_NAME` | UI | Nama app, default `Mau KaGa`. |
| `NUXT_PUBLIC_MAX_UPLOAD_MB` | CS form | Batas ukuran upload hardcopy/bukti. |
| `NUXT_PUBLIC_MAX_ITEMS` | CS form | Batas jumlah item pengajuan. |
| `NUXT_APP_BASE_URL` | CS static build | Base URL jika CS static dideploy di subfolder. |
| `NUXT_PUBLIC_APP_VERSION` | Build info | Override versi app publik. |
| `NUXT_PUBLIC_APP_REVISION` | Build info | Commit/build revision manual. |
| `NUXT_PUBLIC_APP_BRANCH` | Build info | Nama branch build. |
| `NUXT_PUBLIC_APP_BUILD_DATE` | Build info | Timestamp build eksplisit. |
| `NUXT_PUBLIC_APP_DEPLOY_URL` | Build info | URL deploy publik. |

Env key dari auth provider lama tidak termasuk arsitektur terbaru dan tidak boleh dipakai untuk konfigurasi Nuxt baru.
Jika deployment lama masih butuh endpoint admin GAS lama, perlakukan sebagai kompatibilitas sementara saja.

## 12. Operasional

Command utama:

```bash
pnpm install
pnpm dev
pnpm build
pnpm build:cs
pnpm sync:cs:check
pnpm typecheck
pnpm lint
pnpm test
```

Database:

```bash
pnpm db:generate
pnpm db:push
pnpm db:studio
```

Local runtime directory:

- `.data` dan `public/arsip_file` adalah data lokal runtime dan di-ignore dari git.
- Commit hanya menyimpan kode, schema, migration, dan `.env.example`.

## 13. Acceptance Criteria Arsitektur

Arsitektur dianggap lengkap jika:

- Data aktif non-`Selesai` tetap terbaca dari GAS.
- Data `Selesai` dapat disync ke SQLite dengan semua item, status log, dan metadata file.
- File hardcopy/bukti berhasil disimpan ke `public/arsip_file`.
- GAS hanya difinalisasi setelah data dan file lokal aman.
- Setelah finalisasi, row aktif di Sheets hilang dan file Drive masuk trash.
- Dashboard admin bisa membaca active dan local tanpa browser memanggil GAS langsung.
- CS static tetap bisa submit draft/final dan cek status melalui GAS public URL.
- Better Auth lokal menjadi satu-satunya auth admin Nuxt.
- Tidak ada dependency konfigurasi auth provider lama di `.env` Nuxt.
- `pnpm typecheck`, `pnpm lint`, dan `pnpm test` lulus.

## 14. Status Implementasi Saat Ini

Sudah ada:

- Root Nuxt/Nitro admin app.
- CS static app di `apps/cs-web`.
- Runtime config untuk GAS URL, database, local directory, public local file path, app name, upload limit, dan item limit.
- Drizzle SQLite schema dan migration local.
- Zod schema untuk payload offloading lokal dari GAS.
- Local sync utility yang mengambil pengajuan `Selesai`, menyimpan SQLite, mengunduh file, dan memanggil finalisasi GAS.
- GAS action `getArchiveFile` dan `finalizeArchivedPengajuan`.
- Manual local sync button di layout dashboard.
- Dashboard data source sudah mendukung query `?source=local`.
- Kontrol UI Active/Local sudah tersedia di header dashboard, list pengajuan, dan detail pengajuan.
- Auth bridge Nitro -> GAS sudah memakai signed server-to-server HMAC-SHA256 dengan timestamp, nonce, allowlist action, dan role actor.
- Test unit untuk bootstrap admin, active GAS bridge, dan local service sudah lulus di `pnpm test`.

Belum lengkap:

- Belum ada scheduler produksi untuk local sync.
- Mode `changed`/`background` belum benar-benar incremental.
- Toggle active/local belum menjadi kontrol UI yang jelas di semua halaman dashboard.
- Smoke test end-to-end dengan GAS dan Drive production/staging belum terdokumentasi sebagai hasil lulus.

## 15. Prinsip Kebersihan Dokumen

PRD ini tidak mendokumentasikan arsitektur lama secara detail. Jika perlu audit historis, gunakan git history. Untuk pekerjaan berjalan, hanya kontrak pada dokumen ini yang berlaku.
