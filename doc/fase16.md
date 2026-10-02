# Fase 16 - Backup, Restore Database, dan View File Lampiran

## Tujuan

Fase ini menambahkan dua kemampuan operasional:

1. Membuat dan memulihkan backup database beserta file lampiran sebagai satu
   snapshot yang konsisten.
2. Membuka file lampiran yang sudah tersimpan dari detail pengajuan melalui
   route server yang aman.

Pendekatan fase ini harus tetap minimal dan mudah dirawat. Backup dan restore
tidak dibuat sebagai workflow bisnis baru, sedangkan file lampiran tidak
dipindahkan ke storage provider atau sistem preview terpisah.

## Status

- [ ] Belum diimplementasikan
- [ ] Rencana sudah disepakati

## Kondisi Kode Saat Ini

Implementasi berikut sudah tersedia dan menjadi dasar fase ini:

- Database memakai SQLite/libSQL melalui Drizzle.
- URL database lokal default adalah `file:.data/maukaga.db`.
- Root file pengajuan berasal dari `NUXT_PENGAJUAN_FILE_DIRECTORY`.
- Root backup sudah disiapkan melalui `NUXT_BACKUP_DIRECTORY`, dengan default
  `storage/backups`.
- Metadata file tersimpan pada tabel `pengajuan_files`.
- Relasi satu file ke beberapa item tersimpan pada
  `pengajuan_file_items`.
- Storage key file dibuat server-side dan helper penulisan sudah melakukan
  containment check terhadap root storage.
- DTO detail pengajuan saat ini hanya mengirim metadata tampilan file dan belum
  mengirim ID file atau URL untuk membukanya.
- File yang sudah diunggah belum memiliki endpoint baca/download.
- Fase sebelumnya sudah menetapkan bahwa semua file pengajuan berada pada satu
  storage root yang sama, termasuk `signed_statement`.

## Keputusan Utama

### Backup dan restore

- Backup dibuat sebagai operasi server/CLI, bukan melalui halaman web.
- Restore hanya menerima target yang disebutkan secara eksplisit dan tidak
  boleh secara default menimpa database atau storage environment aktif.
- Database dan storage file harus berada dalam satu snapshot yang sama.
- Backup tidak memakai backup incremental, sinkronisasi cloud, object storage,
  atau format proprietary.
- Backup hanya menargetkan database lokal berbasis URL `file:` yang digunakan
  aplikasi saat ini. Database remote/libSQL cloud membutuhkan strategi
  terpisah pada fase lain.
- Backup berisi tabel auth, termasuk user, account, dan session. Karena itu
  folder backup diperlakukan sebagai data rahasia.

### File lampiran

- File tetap disimpan pada `NUXT_PENGAJUAN_FILE_DIRECTORY`.
- File dibuka melalui endpoint server terproteksi, bukan dari folder `public`
  dan bukan dengan mengekspos `storageKey`.
- Semua role yang dapat membaca detail pengajuan
  (`admin`, `qrcc`, dan `management`) boleh melihat lampiran.
- File PDF dan JPG/JPEG dikirim dengan `Content-Type` yang benar dan
  `Content-Disposition: inline`, sehingga browser dapat membuka PDF atau gambar
  di tab baru.
- File yang dapat dibuka dari detail pengajuan terdiri dari:
  - `hardcopy` sebagai hardcopy pengajuan;
  - `evidence` dan `attachment` sebagai satu kategori UI `Lampiran tambahan`;
  - `signed_statement` sebagai surat pernyataan.
- Tipe internal `evidence` dan `attachment` tetap dipertahankan agar metadata,
  validasi, dan kompatibilitas data lama tidak berubah.
- Tombol utama di UI adalah `Lihat file`. Kemampuan download bawaan browser
  tetap tersedia dari viewer PDF/gambar, tanpa membuat komponen preview khusus.
- Penghapusan file bukan bagian fase ini.
- Membuka file tidak perlu ditulis ke `audit_log` satu per satu karena akan
  menghasilkan noise. Mutasi dan upload tetap mengikuti audit yang sudah ada.

## Bagian A - View File Lampiran

### A.1 Kontrak endpoint

Tambahkan endpoint:

```text
GET /api/pengajuan/:idPengajuan/files/:fileId
```

Aturan endpoint:

- Wajib memanggil `requireApiSession(event)`.
- Mencari file berdasarkan `fileId` dan memastikan file tersebut memang milik
  `idPengajuan` pada URL.
- Pengajuan yang sudah soft-delete tidak dapat membuka file melalui endpoint
  biasa.
- Tidak pernah menerima path filesystem atau `storageKey` dari client sebagai
  input.
- Mengambil `storageKey` hanya dari record database yang sudah tervalidasi.
- Menggunakan helper storage terpusat untuk membuat path absolut dan memastikan
  path tetap berada di dalam root storage.
- Mengembalikan `404` jika metadata file atau file fisik tidak ditemukan.
- Mengembalikan `Content-Type` berdasarkan metadata yang sudah divalidasi.
- Mengirim nama file aman melalui header `Content-Disposition`, dengan nama
  asli hanya sebagai nama tampilan.
- Menambahkan `X-Content-Type-Options: nosniff`.
- Menggunakan cache privat atau `no-store` karena lampiran dapat berisi data
  pribadi.

### A.2 Perubahan service dan DTO

- Tambahkan `id` file pada `PengajuanFileDto`.
- Jangan mengirim `storageKey`, absolute path, atau nama root storage ke
  frontend.
- Tambahkan helper repository/service untuk mengambil satu file berdasarkan
  `idPengajuan` dan `fileId`.
- Tambahkan helper storage untuk membaca atau membuat stream file tanpa
  menggandakan logika containment check.
- Pertahankan DTO metadata yang sudah dipakai UI:
  nama, jenis file, item terkait, MIME type, dan ukuran.
- Jika file fisik hilang, tampilkan error endpoint yang jelas tanpa menghapus
  metadata database secara otomatis.

### A.3 Perubahan UI

Pada bagian `Dokumen` di
`app/pages/dashboard/pengajuan/index.vue`:

- Tambahkan `id` pada tipe file frontend.
- Ganti ikon kunci yang saat ini hanya menandakan file belum dapat dibuka
  dengan aksi `Lihat file`.
- Buka endpoint file pada tab baru agar detail pengajuan tetap terbuka.
- Gunakan ikon familiar seperti `eye` atau `external-link` dan tooltip/label
  yang jelas.
- Tampilkan `evidence` dan `attachment` dengan label `Lampiran tambahan`;
  gunakan label khusus untuk `hardcopy` dan `signed_statement`.
- Pertahankan informasi nama, jenis, item, MIME type, dan ukuran.
- Tampilkan state disabled atau pesan singkat jika file fisik tidak tersedia.
- Tidak membuat modal preview PDF, image gallery, thumbnail generator, atau
  viewer pihak ketiga pada fase ini.

### A.4 Keamanan file

- Session tetap divalidasi di server pada setiap request.
- Role tidak dipercaya dari payload atau query string.
- `fileId` harus terikat pada pengajuan yang diminta.
- Path traversal harus ditolak walaupun record database berisi storage key yang
  tidak valid.
- Nama file browser tidak boleh menjadi path tujuan.
- File tetap berada di luar `public/`.
- Jangan menambahkan endpoint wildcard seperti `/files/*path`.

## Bagian B - Format Backup

### B.1 Bentuk snapshot

Gunakan satu folder snapshot yang mudah diperiksa dan dipulihkan tanpa
dependency archive tambahan:

```text
<backup-root>/
  2026-10-02T153000Z-<id>/
    manifest.json
    database.sqlite
    files/
      <storage-key asli>
```

`<backup-root>` berasal dari `NUXT_BACKUP_DIRECTORY`. Nama snapshot harus
memiliki timestamp UTC dan suffix unik agar dua backup pada detik yang sama
tidak saling menimpa.

`manifest.json` minimal berisi:

```json
{
  "formatVersion": 1,
  "createdAt": "2026-10-02T15:30:00.000Z",
  "appVersion": "1.0.0",
  "databaseFile": "database.sqlite",
  "storageDirectory": "files",
  "databaseSha256": "...",
  "fileCount": 2,
  "files": [
    {
      "storageKey": "KG-20261002-0001/hardcopy-0-uuid.pdf",
      "sizeBytes": 12345,
      "sha256": "..."
    }
  ]
}
```

Keputusan format:

- Database disimpan sebagai satu file SQLite yang dapat dibuka langsung.
- File disalin dengan struktur storage key yang sama.
- Manifest menjadi sumber verifikasi isi snapshot, bukan sumber data aplikasi.
- Jangan memasukkan secret, password plaintext, atau isi file ke manifest.
- Snapshot sementara dibuat lebih dulu, lalu di-rename menjadi nama final setelah
  database, file, manifest, dan checksum selesai ditulis.
- Backup gagal tidak boleh meninggalkan folder yang terlihat sebagai snapshot
  valid.

### B.2 Konsistensi database dan file

Database dan file tidak dapat di-commit dalam satu transaksi lintas filesystem.
Karena itu backup production harus dijalankan pada maintenance window singkat:

1. Hentikan sementara proses yang dapat mengubah data atau upload file, atau
   hentikan service aplikasi.
2. Buat salinan database yang konsisten dari database lokal, idealnya melalui
   mekanisme SQLite seperti `VACUUM INTO` pada file tujuan.
3. Salin seluruh root file pengajuan ke direktori `files`.
4. Hitung checksum dan tulis `manifest.json`.
5. Validasi snapshot.
6. Rename direktori sementara menjadi snapshot final.
7. Jalankan ulang service aplikasi.

Jangan mengandalkan penyalinan file database utama secara mentah ketika SQLite
sedang aktif menulis WAL. Jika deployment membutuhkan backup tanpa downtime,
mekanisme quiesce/lock perlu dirancang sebagai pekerjaan terpisah.

### B.3 Validasi konfigurasi

Saat backup dijalankan, tolak konfigurasi yang berbahaya:

- `NUXT_BACKUP_DIRECTORY` tidak boleh sama dengan root database.
- `NUXT_BACKUP_DIRECTORY` tidak boleh berada di dalam root file pengajuan.
- Root storage file dan database harus dapat dibaca.
- Database URL harus berupa URL `file:` yang menunjuk ke file nyata.
- Snapshot sementara dan final harus dibuat di bawah backup root yang sudah
  di-resolve secara absolut.

## Bagian C - Command Backup

Tambahkan script operasional Node/TypeScript, misalnya:

```text
scripts/backup.ts
```

Tambahkan command package:

```text
pnpm backup
```

Perilaku command:

- Membaca database, storage, backup root, dan versi aplikasi dari konfigurasi
  yang sama dengan runtime.
- Membuat satu snapshot baru.
- Menampilkan lokasi snapshot, jumlah file, ukuran database, dan hasil validasi.
- Mengembalikan exit code bukan nol jika salah satu tahap gagal.
- Tidak menghapus snapshot lama secara default.
- Menyediakan opsi prune sederhana setelah kebijakan retensi disepakati.

Tidak perlu membuat API `/api/admin/backup` atau tombol backup pada fase awal.
Backup dapat dijalankan manual atau melalui cron/systemd timer pada host yang
menjalankan aplikasi. Dengan cara ini, backup tidak bergantung pada session
browser dan tidak membuat file database rahasia tersedia melalui HTTP.

## Bagian D - Restore

### D.1 Command restore

Tambahkan script operasional, misalnya:

```text
scripts/restore.ts
```

Tambahkan command package:

```text
pnpm restore -- --source storage/backups/2026-10-02T153000Z-example \
  --database file:.data/restore/maukaga.db \
  --storage storage/restore/pengajuan
```

Nama option boleh disesuaikan dengan konvensi script, tetapi target database dan
target storage harus selalu eksplisit.

### D.2 Aturan restore

- Source wajib berupa snapshot directory dengan `manifest.json`.
- Validasi `formatVersion` sebelum menyalin apa pun.
- Validasi semua checksum database dan file sebelum target diubah.
- Target database dan storage tidak boleh sama dengan source.
- Target harus berada di environment terpisah pada smoke test pertama.
- Jika target sudah berisi data, command harus berhenti kecuali ada flag
  eksplisit untuk overwrite.
- Restore ke production bukan mode default dan wajib didahului backup kondisi
  saat ini.
- Restore tidak menjalankan migration otomatis.
- Setelah restore, migration yang diperlukan dapat dijalankan secara manual
  setelah kompatibilitas versi diperiksa.
- Salin ke lokasi sementara pada target lalu rename agar restore yang gagal tidak
  meninggalkan target setengah jadi.
- File target harus mempertahankan storage key yang sama dengan metadata
  `pengajuan_files`.
- Jangan menyalin snapshot ke `public/`.

### D.3 Verifikasi setelah restore

Smoke test restore harus memeriksa:

- Database dapat dibuka oleh Drizzle.
- Tabel pengajuan, item, status log, audit log, dan auth tersedia.
- Jumlah metadata file sama dengan `fileCount` pada manifest.
- Setiap file yang direferensikan database tersedia pada target storage.
- Satu pengajuan contoh dapat dibaca melalui service detail.
- File pengajuan contoh dapat dibuka melalui endpoint setelah aplikasi
  diarahkan ke target.
- User admin dapat login pada environment restore jika data auth memang ikut
  dipulihkan.

## Bagian E - Retensi dan Operasional

Rekomendasi awal yang sederhana:

- Buat satu backup penuh setiap hari setelah jam operasional.
- Pertahankan minimal 14 snapshot harian.
- Simpan setidaknya satu salinan di host atau media yang berbeda dari server
  aplikasi.
- Uji restore ke environment terpisah minimal sekali setiap bulan atau setelah
  perubahan schema besar.
- Catat lokasi backup, timestamp, checksum, dan hasil restore pada log command
  atau catatan operasional.

Retensi 14 hari dapat dibuat sebagai default dokumentasi terlebih dahulu.
Automasi penghapusan snapshot lama hanya ditambahkan setelah command backup
dan restore stabil.

README atau dokumentasi operasional perlu menjelaskan:

- env yang wajib disiapkan;
- cara membuat backup;
- lokasi hasil snapshot;
- cara memeriksa manifest;
- cara restore ke environment terpisah;
- prosedur jika file atau checksum rusak;
- prosedur rollback deployment dan migration;
- larangan menyimpan backup di lokasi yang dapat diakses publik.

## Urutan Implementasi

### Langkah 1 - Finalisasi kontrak

- [ ] Pastikan format `manifest.json`, nama command, dan target restore
  disepakati.
- [ ] Tetapkan bahwa scope awal hanya database lokal `file:` dan storage lokal.
- [ ] Tetapkan maintenance window untuk backup production.

### Langkah 2 - View file

- [ ] Tambahkan `fileId` pada DTO file.
- [ ] Tambahkan repository/service untuk lookup file berdasarkan pengajuan dan
  file ID.
- [ ] Tambahkan helper baca file yang memakai containment check terpusat.
- [ ] Buat endpoint GET file dengan session, header, dan error handling yang
  aman.
- [ ] Tambahkan aksi `Lihat file` pada detail pengajuan.

### Langkah 3 - Backup

- [ ] Buat helper resolusi path database, storage, dan backup root.
- [ ] Buat script snapshot database lokal yang konsisten.
- [ ] Salin file storage dan hitung checksum.
- [ ] Tulis dan validasi manifest.
- [ ] Gunakan temporary directory lalu atomic rename.
- [ ] Tambahkan command `pnpm backup`.
- [ ] Tolak konfigurasi root yang berpotensi membuat backup recursive atau
  mengekspos data.

### Langkah 4 - Restore

- [ ] Buat parser option source dan target.
- [ ] Validasi manifest dan seluruh checksum sebelum perubahan target.
- [ ] Restore ke temporary target lalu rename.
- [ ] Tambahkan command `pnpm restore`.
- [ ] Tambahkan smoke script atau test restore ke direktori sementara.

### Langkah 5 - Dokumentasi dan verifikasi

- [ ] Dokumentasikan jadwal, retensi, maintenance window, dan restore pada
  README atau dokumen operasional.
- [ ] Update `implementation-plan.md` pada Fase 11 setelah pekerjaan selesai.
- [ ] Jalankan `pnpm test`.
- [ ] Jalankan `pnpm typecheck`.
- [ ] Jalankan `pnpm lint`.
- [ ] Jalankan `pnpm build`.
- [ ] Jalankan smoke test manual untuk membuka PDF dan JPG dari detail
  pengajuan.
- [ ] Jalankan smoke test backup lalu restore ke environment terpisah.

## Test yang Diperlukan

### View file

- [ ] User tanpa session menerima `401`.
- [ ] Role aktif yang sah dapat membuka file milik pengajuan.
- [ ] File dari pengajuan lain menerima `404` dan tidak membocorkan metadata.
- [ ] `fileId` yang tidak dikenal menerima `404`.
- [ ] Pengajuan soft-deleted tidak dapat membuka file.
- [ ] Response memiliki MIME type, disposition inline, dan header keamanan yang
  benar.
- [ ] File yang hilang dari storage menghasilkan error yang jelas.
- [ ] Storage key yang mencoba keluar dari root ditolak.

### Backup

- [ ] Snapshot berisi database, files, dan manifest.
- [ ] Manifest mencatat checksum database dan seluruh file.
- [ ] File kosong, file PDF, dan file JPG tetap memiliki ukuran/checksum yang
  benar.
- [ ] Backup kedua tidak menimpa snapshot pertama.
- [ ] Backup gagal tidak meninggalkan snapshot final yang tidak lengkap.
- [ ] Root backup di dalam root storage ditolak.
- [ ] Database non-`file:` ditolak dengan pesan yang jelas pada scope fase ini.

### Restore

- [ ] Snapshot valid dapat dipulihkan ke database dan storage sementara.
- [ ] Checksum rusak membuat restore berhenti sebelum target diubah.
- [ ] Manifest tidak valid ditolak.
- [ ] Target existing tidak ditimpa tanpa flag eksplisit.
- [ ] Setelah restore, data pengajuan dan file dapat dibaca.
- [ ] Restore environment dapat login memakai data auth dari snapshot.
- [ ] Restore ke target yang sama dengan source ditolak.

## Acceptance Criteria

- [ ] Admin, QRCC, dan management dapat membuka lampiran dari detail pengajuan
  tanpa akses publik ke folder storage.
- [ ] Hardcopy, lampiran tambahan (`evidence`/`attachment`), dan surat
  pernyataan dapat dibuka dari detail pengajuan.
- [ ] PDF terbuka di browser dan JPG/JPEG dapat dilihat di tab baru.
- [ ] Tidak ada path filesystem atau storage key yang bocor ke frontend.
- [ ] Satu command backup menghasilkan snapshot lengkap yang dapat diverifikasi.
- [ ] Snapshot menyimpan database dan storage file yang saling cocok.
- [ ] Restore dapat dilakukan ke environment terpisah dengan target eksplisit.
- [ ] Pengajuan, item, status log, audit log, user, dan file tetap tersedia
  setelah restore.
- [ ] Backup tidak dapat diakses sebagai route HTTP publik.
- [ ] Restore tidak tersedia sebagai aksi web biasa yang dapat menimpa database
  aktif secara tidak sengaja.
- [ ] Dokumentasi menjelaskan jadwal backup, retensi, verifikasi, dan prosedur
  restore.
- [ ] Test, typecheck, lint, build, dan smoke test fase ini lulus.

## Di Luar Scope

Fitur berikut sengaja tidak dibuat pada fase ini:

- Backup incremental atau differential.
- Enkripsi backup di dalam aplikasi.
- Upload backup ke AWS S3, Google Drive, atau provider cloud tertentu.
- Backup database remote/libSQL cloud.
- Halaman web untuk mengelola histori backup.
- Download snapshot backup melalui browser.
- Restore langsung dengan satu tombol dari dashboard.
- Preview thumbnail, OCR, pemindaian antivirus, atau anotasi PDF.
- Penghapusan lampiran dan garbage collection storage.
- Versi file atau histori revisi lampiran.
- Sinkronisasi dua arah database dan storage.
