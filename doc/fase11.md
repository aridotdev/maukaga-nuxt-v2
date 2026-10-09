# Fase 11 - Backup & Restore Lokal

## Tujuan

Menyediakan cara sederhana bagi pemilik aplikasi untuk membuat backup dari
halaman aplikasi localhost. User masuk ke menu Settings > Backup, menekan
tombol **Buat Backup**, menunggu proses selesai, lalu menerima notifikasi hasilnya.

Fitur ini ditujukan untuk satu aplikasi yang dipakai pribadi di localhost,
bukan sistem backup perusahaan, multi-server, cloud, atau disaster recovery.

## Scope Yang Disepakati

- Backup dilakukan manual melalui halaman Settings > Backup.
- Satu klik membuat satu snapshot baru.
- Snapshot berisi database aplikasi dan seluruh file pengajuan.
- Snapshot disimpan di `NUXT_BACKUP_DIRECTORY`, default `storage/backups`.
- Setiap snapshot memakai folder timestamp agar backup lama tidak tertimpa.
- Sistem menampilkan status sedang diproses, berhasil, atau gagal.
- Backup gagal tidak boleh dianggap berhasil dan tidak boleh meninggalkan
  snapshot setengah jadi sebagai backup yang valid.
- Restore tersedia dari halaman Backup melalui tombol pada snapshot yang dipilih.
- Sebelum restore, admin wajib melewati modal konfirmasi yang terlihat jelas.
- Sistem membuat safety backup otomatis dari kondisi saat ini sebelum restore.
- Setelah restore berhasil, modal hasil restore wajib memberitahu admin bahwa
  aplikasi harus direstart secara manual.

## Yang Tidak Masuk Scope

- Backup otomatis atau scheduler.
- Backup ke cloud, NAS, server lain, atau object storage.
- Multi-user backup management.
- Retensi otomatis, enkripsi aplikasi, monitoring, alerting, RPO/RTO formal,
  dan disaster recovery enterprise.
- API download backup dari browser.
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
- Belum ada halaman backup, endpoint backup/restore, service backup/restore, atau
  daftar snapshot.

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
- Restore dan backup tidak boleh berjalan bersamaan.
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
- [ ] Tampilkan daftar snapshot backup yang tersedia dari backup directory.
- [ ] Tampilkan waktu, ukuran database, dan jumlah file pada setiap snapshot.
- [ ] Tambahkan tombol `Restore` pada setiap snapshot yang valid.
- [ ] Disable tombol selama proses berjalan dan tampilkan loading state.
- [ ] Tampilkan toast/notifikasi sukses setelah backup selesai.
- [ ] Notifikasi sukses menampilkan waktu, nama snapshot, dan jumlah file.
- [ ] Tampilkan notifikasi gagal yang dapat dipahami user.
- [ ] Sebelum restore, tampilkan modal konfirmasi yang jelas bahwa data aplikasi
  saat ini akan digantikan.
- [ ] Modal konfirmasi menyebutkan bahwa safety backup dibuat otomatis sebelum
  restore.
- [ ] Setelah restore berhasil, tampilkan modal/notifikasi hasil yang terlihat
  jelas dan menyatakan: `Restore berhasil. Silakan restart aplikasi secara
  manual sebelum melanjutkan.`
- [ ] Jangan menutup informasi restart sampai admin menekan tombol mengerti.
- [ ] Jangan menampilkan stack trace atau path internal penuh di UI.
- [ ] Management tidak melihat tombol mutasi bila role hanya read-only.

### D. Service Restore Sederhana

- [ ] Buat fungsi restore pada `server/services/backup-service.ts` atau service
  restore kecil yang tidak menggandakan aturan backup.
- [ ] Buat endpoint `server/api/admin/backup/restore.post.ts`.
- [ ] Endpoint menerima hanya `backupId` atau nama snapshot dari daftar server;
  tidak menerima arbitrary path dari browser.
- [ ] Validasi session dan role `admin`.
- [ ] Tolak restore ketika backup atau restore lain sedang berjalan.
- [ ] Validasi snapshot berada di dalam `NUXT_BACKUP_DIRECTORY`.
- [ ] Validasi `manifest.json`, `database.sqlite`, dan `files/`.
- [ ] Validasi checksum jika tersedia.
- [ ] Buat safety backup otomatis dari database dan storage aktif sebelum overwrite.
- [ ] Safety backup diberi nama timestamp baru dan tidak menimpa backup lama.
- [ ] Salin database snapshot dan file snapshot ke lokasi aplikasi aktif.
- [ ] Gunakan folder temporary saat menyiapkan hasil restore.
- [ ] Jika penyalinan gagal, pertahankan data aktif dan hapus temporary restore.
- [ ] Kembalikan flag `restartRequired: true` pada response sukses.
- [ ] Setelah implementasi UI selesai, script restore CLI tidak perlu dibuat karena
  restore dilakukan melalui halaman Backup.
- [ ] Kembalikan error yang jelas jika restore gagal.
- [ ] Dokumentasikan bahwa aplikasi wajib direstart manual setelah restore.

### E. Aturan Restart Setelah Restore

- [ ] Jangan mencoba me-restart process Nuxt dari endpoint.
- [ ] Jangan menganggap reload halaman browser sebagai restart aplikasi.
- [ ] Tampilkan modal hasil restore yang terlihat jelas untuk admin.
- [ ] Modal menyebutkan alasan restart: koneksi database runtime harus dibuat
  ulang agar hasil restore digunakan aplikasi.
- [ ] Sediakan tombol `Mengerti` atau `Tutup` yang hanya menutup modal, bukan
  menjalankan restart otomatis.
- [ ] Setelah admin restart aplikasi dan login kembali, data snapshot dapat
  dibaca seperti biasa.

### F. Test Dan Verifikasi

- [ ] Test service membuat folder snapshot berisi database dan file pengajuan.
- [ ] Test backup baru tidak menimpa snapshot sebelumnya.
- [ ] Test manifest mencatat jumlah file dan checksum.
- [ ] Test error ketika database source tidak tersedia.
- [ ] Test cleanup ketika penyalinan gagal.
- [ ] Test endpoint unauthorized dan forbidden untuk role non-admin.
- [ ] Test endpoint berhasil mengembalikan ringkasan backup.
- [ ] Test daftar snapshot hanya mengembalikan folder snapshot valid.
- [ ] Test endpoint restore unauthorized dan forbidden untuk role non-admin.
- [ ] Test restore membuat safety backup sebelum mengganti data aktif.
- [ ] Test restore ke database/storage temporary berhasil.
- [ ] Test artifact rusak ditolak.
- [ ] Test restore mengembalikan `restartRequired: true`.
- [ ] Test restore gagal tidak menghapus data aktif.
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

### Restore

1. Admin membuka daftar snapshot di `Settings > Backup`.
2. Admin memilih snapshot dan menekan `Restore`.
3. Sistem menampilkan modal konfirmasi yang jelas bahwa data aktif akan
   digantikan dan safety backup akan dibuat otomatis.
4. Admin menekan `Ya, Restore`.
5. Server membuat safety backup dari database dan file aktif.
6. Server memvalidasi lalu menyalin database dan file dari snapshot terpilih.
7. Jika berhasil, sistem menampilkan modal penting:
   `Restore berhasil. Silakan restart aplikasi secara manual sebelum melanjutkan.`
8. Admin menutup modal, menghentikan aplikasi, lalu menjalankannya kembali.
9. Admin login kembali dan memeriksa data hasil restore.
10. Jika gagal, sistem menampilkan error dan data aktif tidak boleh dilaporkan
    sebagai sudah terganti.

## Acceptance Fase 11

- [ ] Admin dapat membuka menu Backup dari localhost.
- [ ] Admin dapat membuat backup dengan satu tombol.
- [ ] Backup berisi database aplikasi dan file pengajuan.
- [ ] Backup lama tetap ada setelah backup baru dibuat.
- [ ] Backup yang gagal tidak dianggap sukses.
- [ ] User menerima notifikasi sukses atau gagal yang jelas.
- [ ] Endpoint menolak user tanpa session dan role yang sesuai.
- [ ] Admin dapat melihat daftar snapshot yang tersedia.
- [ ] Admin dapat memilih snapshot dan menjalankan restore dari UI.
- [ ] Modal konfirmasi restore terlihat jelas sebelum proses dimulai.
- [ ] Safety backup otomatis dibuat sebelum data aktif diganti.
- [ ] Modal hasil restore menyatakan restart manual wajib dilakukan.
- [ ] Restore dari satu snapshot ke database dan storage aktif berhasil.
- [ ] Setelah restore, minimal satu pengajuan dan file terkait dapat dibuka.
- [ ] Dokumentasi menjelaskan lokasi backup, restore, dan restart manual.
- [ ] `pnpm typecheck`, `pnpm lint`, dan `pnpm test` lulus.

## Catatan Untuk User

- Backup tersimpan di `NUXT_BACKUP_DIRECTORY`, default `storage/backups`.
- Folder backup harus disalin ke lokasi aman secara manual jika ingin memiliki
  salinan tambahan.
- Backup mengandung database dan dokumen pengajuan, jadi jangan dibagikan
  sembarangan.
- Restore dilakukan dari snapshot yang dipilih di menu Backup.
- Setelah restore berhasil, admin wajib menghentikan dan menjalankan kembali
  aplikasi secara manual sebelum memakai data hasil restore.
