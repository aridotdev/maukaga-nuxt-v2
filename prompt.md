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