# MAUKAGA AI Context

Role: Senior Fullstack Engineer & Software Architect specializing in Vue, Nuxt 4, Nitro, Google Apps Script (GAS), SQLite, Drizzle ORM v1, libSQL, and Zod.

Project: MAUKAGA, aplikasi internal Pengajuan Cetak Ulang Kartu Garansi.

Architecture: Local-first hybrid architecture. SQLite lokal adalah database utama untuk admin/read-heavy workflow dan arsip. GAS tetap dipakai sebagai active intake/proxy untuk Google Sheets dan Google Drive sampai data selesai di-offload ke lokal.

Tech stack:
- Frontend: Nuxt 4/Vue
- Backend worker/API: Nitro
- Local DB: SQLite via `@libsql/client` + `drizzle-orm/libsql`
- ORM schema/migration: Drizzle ORM v1 rc + Drizzle Kit
- Validation: Zod + `drizzle-orm/zod`
- GAS: proxy Sheets/Drive dan flow submit aktif

Current state:
- Phase 1 done: `doc/Code.gs` memakai schema GAS baru.
- Sheet `PengajuanItems` sudah menggabungkan lifecycle kartu dan pengiriman.
- Sheet legacy `WarrantyCards` dan `ShippingLabels` tidak dipakai lagi.
- Sheet `Pengajuan` sudah menghapus blob/URL panjang seperti `Riwayat Singkat`, `File Hard Copy URL`, dan list URL bukti.
- File archive memakai naming deterministik:
  - Hardcopy: `/arsip_file/{ID_Pengajuan}_hardcopy.pdf`
  - Bukti: `/arsip_file/{ID_Pengajuan}_bukti_01.jpg`
- Phase 2 done: local SQLite/Drizzle/Zod sudah disiapkan.
- DB bootstrap ada di `server/database/index.ts`.
- DB config/path ada di `config/database.ts` dan `drizzle.config.ts`.
- Runtime config Nuxt menyimpan `databaseUrl`, `archiveFileDirectory`, dan public `archiveFileBasePath`.
- Schema lokal utama ada di `server/database/schema/`:
  - `pengajuan`
  - `pengajuan_items`
  - `status_log`
  - `archive_files`
  - `sync_meta`
  - `sync_log`
- Zod GAS archive contract ada di `server/schemas/gas-archive.ts`.
- Validated upsert ke SQLite ada di `server/utils/local-archive.ts`.
- Legacy `admin-cache` backend sudah dihapus dan jangan dihidupkan lagi.

Rules for next work:
- Treat SQLite lokal sebagai source utama untuk data admin dan arsip.
- GAS jangan diberi schema berat lagi; GAS hanya active/proxy layer.
- Jangan simpan URL Drive/list ID panjang di `Pengajuan`.
- Gunakan Zod untuk semua input dari GAS sebelum masuk SQLite.
- Gunakan Drizzle ORM API, bukan raw SQL, kecuali untuk kebutuhan migrasi/maintenance yang jelas.
- Pertahankan kode modular, typed, dan kecil.

Next phase: Phase 3, Nitro Sync Worker & File Offloading.
- Buat Nitro endpoint sync, misalnya `/api/archive/sync.post` dan `/api/archive/sync-status.get`.
- Ambil data `Selesai` dari GAS melalui action khusus atau `getDetail`.
- Validasi payload GAS dengan `gasArchivePayloadSchema`.
- Upsert data ke SQLite memakai `upsertGasArchiveDetail`.
- Download file Drive via GAS proxy berdasarkan nama deterministik/ID bila tersedia.
- Simpan file ke `public/arsip_file/`.
- Update status `archive_files`: `pending`, `downloaded`, `drive_trashed`, `missing`, atau `error`.
- Setelah semua aman tersimpan lokal, minta GAS trash file Drive dan hard-delete row aktif dari Sheets.
- Catat semua proses ke `sync_log` dan state terakhir ke `sync_meta`.
Latest implementation context:
- Belum ada file yang diedit setelah investigasi terakhir.
- `server/api/` masih kosong, jadi endpoint Nitro archive sync perlu dibuat baru.
- `server/utils/local-archive.ts` sudah punya helper penting:
  - `upsertGasArchiveDetail(input, options)` untuk validasi `gasArchivePayloadSchema`, upsert `pengajuan`, `pengajuan_items`, `archive_files`, `status_log`, lalu tulis `sync_log` dan `sync_meta`.
  - `resolveArchiveLocalPath()` dan `ensureArchiveFileDirectory()` untuk path lokal arsip yang aman.
- `server/schemas/gas-archive.ts` sudah membentuk kontrak detail GAS menjadi row lokal dan daftar `archiveFiles` deterministik:
  - hardcopy: `{ID_Pengajuan}_hardcopy.pdf`
  - bukti: `{ID_Pengajuan}_bukti_01.jpg`, dst.
- `archive_files` sudah punya field yang dibutuhkan worker: `localPath`, `mimeType`, `sizeBytes`, `sha256`, `sourceDriveFileId`, `status`, `downloadedAt`, `driveTrashedAt`, `error`.
- `sync_log` dan `sync_meta` sudah cukup untuk mencatat run worker dan status terakhir tanpa migration tambahan.
- `nuxt.config.ts` sudah punya runtime config `appsScriptApiUrl`, `databaseUrl`, `archiveFileDirectory`, dan public `archiveFileBasePath`.
- `doc/Code.gs` saat ini sudah punya action `getDetail` yang mengembalikan payload detail sesuai bentuk archive schema.
- `doc/Code.gs` juga sudah punya `deletePengajuan`, tetapi action itu terlalu umum karena langsung delete rows dan trash file.
- `doc/Code.gs` belum punya action proxy untuk download file Drive/base64 berdasarkan nama deterministik.
- Implementasi Phase 3 sebaiknya menambah action GAS kecil:
  - `getArchiveFile`: validasi session, cari file di Drive folder berdasarkan `idPengajuan`, `kind`, `sequence` atau `fileName`, lalu return `{ fileName, mimeType, sizeBytes, base64, sourceDriveFileId }`.
  - `finalizeArchivedPengajuan`: validasi admin, pastikan status pengajuan masih `Selesai`, lalu hard-delete row aktif dari `Pengajuan`, `PengajuanItems`, `StatusLog` dan trash file Drive.
- Endpoint Nitro yang perlu dibuat:
  - `POST /api/archive/sync`: menerima body seperti `{ token, mode, idPengajuan?, limit?, finalize? }`, panggil GAS, validasi/upsert detail lokal, download file, update `archive_files`, dan finalize jika semua file aman.
  - `GET /api/archive/sync-status`: baca `sync_log`, `sync_meta`, dan ringkasan `archive_files` untuk status worker terakhir.
- Worker util yang disarankan:
  - buat helper panggil GAS via `fetch` POST `text/plain;charset=utf-8`, format response `{ success, data, error }`.
  - mode `detail` wajib memakai `idPengajuan`.
  - mode `full`/`changed` bisa memakai `getPengajuanList` dengan `status: 'Selesai'`, paging, lalu sync detail per ID.
  - hashing file pakai `node:crypto` SHA-256 setelah decode base64.
  - tulis file ke path dari `resolveArchiveLocalPath(file.publicPath, runtime config)`.
  - update status file ke `downloaded`, `missing`, atau `error`; setelah finalize sukses ubah ke `drive_trashed`.
