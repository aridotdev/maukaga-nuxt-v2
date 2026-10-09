# Fase 11 - Backup Lokal

## Tujuan

Menyediakan cara sederhana bagi pemilik aplikasi untuk membuat backup dari
halaman aplikasi localhost. User masuk ke menu Settings > Backup, menekan
tombol **Buat Backup**, menunggu proses selesai, lalu menerima notifikasi hasilnya.

Fitur ini ditujukan untuk satu aplikasi yang dipakai pribadi di localhost,

## Scope Yang Disepakati

- Backup dilakukan manual melalui halaman Settings > Backup.
- Satu klik membuat satu snapshot baru.
- Snapshot berisi database aplikasi dan seluruh file pengajuan.
- Snapshot disimpan di `NUXT_BACKUP_DIRECTORY`, default `storage/backups`.
- Setiap snapshot memakai folder timestamp agar backup lama tidak tertimpa.
- Sistem menampilkan status sedang diproses, berhasil, atau gagal.
- Backup gagal tidak boleh dianggap berhasil dan tidak boleh meninggalkan
  snapshot setengah jadi sebagai backup yang valid.
- Restore bukan tombol utama di UI. Restore dilakukan manual dengan script
  sederhana setelah aplikasi dihentikan.

## Yang Tidak Masuk Scope

- Backup otomatis atau scheduler.
- Backup ke cloud, NAS, server lain, atau object storage.
- Multi-user backup management.
- Retensi otomatis, enkripsi aplikasi, monitoring, alerting, RPO/RTO formal,
  dan disaster recovery enterprise.
- API download backup dari browser atau restore langsung dari browser.
- Migrasi schema otomatis saat restore.

## Kondisi Repo Saat Ini

- Database menggunakan SQLite/libSQL melalui Drizzle.
- Default database lokal adalah `.data/maukaga.db`, dari `DATABASE_URL` atau
  `NUXT_DATABASE_URL`.
- File pengajuan berada di `NUXT_PENGAJUAN_FILE_DIRECTORY`, default
  `storage/pengajuan`.
- `NUXT_BACKUP_DIRECTORY` sudah tersedia, default `storage/backups`.
- File pengajuan mempunyai `storageKey`, ukuran, MIME type, dan checksum
  `sha256` pada tabel `pengajuan_files`.
- Belum ada halaman backup, endpoint backup, service backup, atau script restore.

## Desain Minimal Yang Dipilih

Satu backup disimpan sebagai folder berikut:

```text
storage/backups/
  2026-10-09T153000/
    database.sqlite
    files/
      KG-20261009-0001/
        hardcopy-1-<uuid>.pdf
    manifest.json
```

Ketentuan:

- Nama folder dibuat dari timestamp server yang aman untuk nama file.
- `database.sqlite` adalah salinan database saat backup dibuat.
- `files/` mempertahankan struktur relatif storage pengajuan.
- `manifest.json` mencatat versi format, waktu backup, jumlah file, ukuran,
  dan checksum SHA-256 bila tersedia.
- Folder temporary dipakai selama proses. Folder final hanya dibuat setelah
  seluruh proses berhasil.
- Backup lama tidak ditimpa.
- Endpoint hanya boleh menjalankan satu backup pada satu waktu.
- Jika database bukan SQLite file lokal (`file:`), endpoint mengembalikan error
  yang jelas karena scope localhost belum mendukung database remote.
- Tidak perlu maintenance mode atau locking kompleks; tombol disabled selama
  request berlangsung.

## Checklist Implementasi

### A. Service Backup

- [ ] Buat `server/services/backup-service.ts`.
- [ ] Buat tipe hasil backup minimal: `backupId`, `createdAt`, `location`,
  `databaseSizeBytes`, `fileCount`, dan `totalSizeBytes`.
- [ ] Ambil konfigurasi database, storage pengajuan, dan backup directory dari
  konfigurasi server yang sudah ada.
- [ ] Validasi database URL merupakan SQLite file lokal dan source dapat dibaca.
- [ ] Validasi atau buat root storage pengajuan dan backup directory.
- [ ] Buat folder temporary unik di dalam backup directory.
- [ ] Salin database ke `temporary/database.sqlite`.
- [ ] Salin seluruh isi storage pengajuan ke `temporary/files`.
- [ ] Hindari recursive copy bila backup directory berada di dalam root storage.
- [ ] Buat `manifest.json` dengan metadata sederhana dan checksum SHA-256.
- [ ] Validasi artifact hasil copy sebelum finalisasi.
- [ ] Rename folder temporary menjadi folder snapshot final.
- [ ] Bersihkan folder temporary saat terjadi error.
- [ ] Jangan menghapus atau menimpa backup yang sudah ada.

### B. Endpoint Nitro

- [ ] Buat `server/api/admin/backup.post.ts`.
- [ ] Validasi session dan role `admin` menggunakan guard yang sudah ada.
- [ ] Tolak request kedua saat backup sedang berjalan.
- [ ] Panggil backup service dan tunggu sampai selesai.
- [ ] Kembalikan response ringkas yang dapat dipakai UI.
- [ ] Gunakan normalizer error yang sudah dipakai endpoint lain.
- [ ] Jangan mengembalikan absolute path sensitif; cukup nama snapshot dan
  lokasi relatif yang aman.

### C. Halaman UI

- [ ] Buat `app/pages/dashboard/settings/backup.vue` atau panel Backup pada
  halaman Settings existing.
- [ ] Tambahkan menu/link `Backup` di Settings.
- [ ] Tampilkan penjelasan bahwa backup berisi database dan file pengajuan.
- [ ] Tambahkan tombol `Buat Backup`.
- [ ] Disable tombol selama proses berjalan dan tampilkan loading state.
- [ ] Tampilkan toast/notifikasi sukses setelah backup selesai.
- [ ] Notifikasi sukses menampilkan waktu, nama snapshot, dan jumlah file.
- [ ] Tampilkan notifikasi gagal yang dapat dipahami user.
- [ ] Jangan menampilkan stack trace atau path internal penuh di UI.
- [ ] Management tidak melihat tombol mutasi bila role hanya read-only.

### D. Restore Manual Sederhana

- [ ] Buat `scripts/backup-restore.ts` tanpa tombol restore di UI.
- [ ] Tambahkan command package `backup:restore`.
- [ ] Script menerima path folder snapshot sebagai argumen.
- [ ] Minta konfirmasi eksplisit sebelum mengganti database/storage target.
- [ ] Validasi `manifest.json`, `database.sqlite`, dan `files/`.
- [ ] Validasi checksum jika tersedia.
- [ ] Dokumentasikan bahwa aplikasi harus dihentikan sebelum restore.
- [ ] Buat salinan safety sederhana dari target sebelum overwrite.
- [ ] Salin database dan file ke lokasi konfigurasi target.
- [ ] Kembalikan error yang jelas jika restore gagal.
- [ ] Dokumentasikan command restore di README.

### E. Test Dan Verifikasi

- [ ] Test service membuat folder snapshot berisi database dan file pengajuan.
- [ ] Test backup baru tidak menimpa snapshot sebelumnya.
- [ ] Test manifest mencatat jumlah file dan checksum.
- [ ] Test error ketika database source tidak tersedia.
- [ ] Test cleanup ketika penyalinan gagal.
- [ ] Test endpoint unauthorized dan forbidden untuk role non-admin.
- [ ] Test endpoint berhasil mengembalikan ringkasan backup.
- [ ] Test restore ke database/storage temporary berhasil.
- [ ] Test artifact rusak ditolak.
- [ ] Jalankan `pnpm typecheck`, `pnpm lint`, `pnpm test`, dan `pnpm build`.

## Alur User

1. User login sebagai admin.
2. User membuka `Settings > Backup`.
3. User menekan `Buat Backup`.
4. Tombol disabled dan UI menampilkan `Backup sedang dibuat...`.
5. Server menyalin database dan seluruh file pengajuan.
6. Server membuat manifest dan memvalidasi hasil salinan.
7. UI menampilkan `Backup berhasil dibuat` beserta waktu, nama snapshot, dan
   jumlah file.
8. Jika gagal, UI menampilkan `Backup gagal dibuat` dan user dapat mencoba lagi.

## Acceptance Fase 11

- [ ] Admin dapat membuka menu Backup dari localhost.
- [ ] Admin dapat membuat backup dengan satu tombol.
- [ ] Backup berisi database aplikasi dan file pengajuan.
- [ ] Backup lama tetap ada setelah backup baru dibuat.
- [ ] Backup yang gagal tidak dianggap sukses.
- [ ] User menerima notifikasi sukses atau gagal yang jelas.
- [ ] Endpoint menolak user tanpa session dan role yang sesuai.
- [ ] Restore manual dari satu snapshot ke folder/database temporary berhasil.
- [ ] Setelah restore, minimal satu pengajuan dan file terkait dapat dibuka.
- [ ] README menjelaskan lokasi backup dan cara restore manual.
- [ ] `pnpm typecheck`, `pnpm lint`, dan `pnpm test` lulus.

## Catatan Untuk User

- Backup tersimpan di `NUXT_BACKUP_DIRECTORY`, default `storage/backups`.
- Folder backup harus disalin ke lokasi aman secara manual jika ingin memiliki
  salinan tambahan.
- Backup mengandung database dan dokumen pengajuan, jadi jangan dibagikan
  sembarangan.
- Untuk restore, hentikan aplikasi terlebih dahulu dan gunakan command restore;
  restore tidak dilakukan dari tombol UI.
