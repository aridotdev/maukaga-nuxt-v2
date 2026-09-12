# PRD MAUKAGA - Fullstack Nuxt Single Application

Dokumen ini adalah single source of truth MAUKAGA untuk arsitektur, produk,
workflow, data, dan operasional aplikasi. MAUKAGA dibangun sebagai satu
aplikasi fullstack Nuxt. Seluruh halaman, API, autentikasi, aturan bisnis,
database, dan storage file berada dalam satu project dan satu deployment.

Tidak ada lagi pembagian sumber data `Active` dan `Local`. Tidak ada proses
sinkronisasi, pemindahan arsip, atau jalur data terpisah. Istilah `Local` hanya
boleh dipakai jika merupakan kategori bisnis, misalnya jenis kartu garansi,
bukan sebagai nama sumber data aplikasi.

## 1. Ringkasan Produk

MAUKAGA adalah aplikasi internal untuk mengelola Pengajuan Cetak Ulang Kartu
Garansi, mulai dari import pengajuan, pemeriksaan data dan item, persetujuan,
pencetakan kartu, pengiriman, sampai penyelesaian pengajuan.

Pengajuan baru dibuat oleh admin melalui import file Excel dan dokumen
pendukung PDF/JPG. Setelah admin melakukan preview dan konfirmasi, data
disimpan ke database aplikasi dan seluruh dokumen disimpan ke storage file
aplikasi. Data yang sudah berstatus `Selesai` tetap berada di database yang
sama dan dapat dicari seperti data lainnya.

### Keputusan arsitektur

- Nuxt menjadi fullstack framework utama.
- Nitro menjadi server runtime dan API internal.
- Database aplikasi menjadi sumber kebenaran tunggal untuk seluruh data.
- Storage file aplikasi menjadi sumber kebenaran tunggal untuk seluruh dokumen.
- Better Auth menjadi autentikasi dan session admin.
- Drizzle ORM menjadi lapisan akses database.
- Semua mutasi dijalankan server-side melalui service domain dan transaksi.
- Browser tidak memanggil layanan eksternal untuk membaca atau mengubah data
  pengajuan.

### Hal yang dihapus dari runtime

- Google Apps Script.
- Google Sheets sebagai database.
- Google Drive sebagai storage dokumen.
- Aplikasi CS/static terpisah.
- Bridge HMAC ke layanan eksternal.
- Konfigurasi URL dan secret layanan Google.
- Endpoint atau UI yang membedakan sumber data `Active` dan `Local`.
- Proses local sync, archive offloading, dan finalisasi antar sistem.

## 2. Tujuan

- Menyediakan satu aplikasi operasional yang mudah dipasang, dijalankan, dan
  dibackup.
- Menjadikan database aplikasi sebagai satu-satunya sumber data pengajuan,
  item, status, konfigurasi, dan workflow.
- Memindahkan seluruh aturan bisnis pengajuan ke service server Nuxt/Nitro.
- Memungkinkan admin membuat pengajuan dari file Excel dan dokumen pendukung.
- Menyediakan pencarian cepat untuk seluruh lifecycle pengajuan, termasuk
  pengajuan `Selesai`.
- Menyimpan dokumen secara aman dan mengaitkannya langsung dengan pengajuan.
- Mempertahankan workflow dashboard admin: review, status, keputusan item,
  cetak kartu, label pengiriman, dan pengaturan.
- Memudahkan backup dan restore database beserta file sebagai satu kesatuan.

## 3. Batasan Produk

### Termasuk

- Dashboard ringkasan, grafik, daftar, dan detail pengajuan.
- Import pengajuan dari Excel.
- Upload dan pengelolaan dokumen PDF/JPG.
- Review dan koreksi data sebelum import dikonfirmasi.
- Pengelolaan item pengajuan dan keputusan per item.
- Perubahan status pengajuan dengan riwayat.
- Antrean cetak kartu garansi.
- Antrean label pengiriman.
- Master model produk.
- Konfigurasi layout cetak.
- Manajemen anggota admin dan password.
- Pembacaan, download, backup, dan restore file melalui server aplikasi.

### Tidak termasuk

- Form pengajuan publik yang berjalan sebagai aplikasi terpisah.
- Database atau storage eksternal sebagai sumber kebenaran.
- Sinkronisasi antar aplikasi.
- Pemindahan otomatis data `Selesai` ke sistem lain.
- Ketergantungan runtime pada layanan Google.

## 4. Arsitektur Sistem

```text
Browser Admin
    |
    v
Nuxt Application
    |
    +-- Vue pages, layouts, and components
    +-- Nitro API routes
    +-- Better Auth session
    +-- Domain services and repositories
    |       |
    |       +-- SQLite atau PostgreSQL
    |       +-- Storage file aplikasi
    |       +-- Import parser dan validator
    |
    +-- Drizzle ORM
```

### Komponen

| Komponen | Tanggung jawab |
| --- | --- |
| Nuxt app | Halaman login, dashboard, import, daftar, detail, cetak, pengiriman, dan settings. |
| Nitro server | API internal, autentikasi server-side, validasi request, file handling, dan orchestration workflow. |
| Domain service | Aturan bisnis pengajuan, import, status, item, cetak, pengiriman, dan konfigurasi. |
| Repository | Query dan perubahan data melalui Drizzle ORM. |
| Database aplikasi | Sumber kebenaran tunggal untuk seluruh record dan session. |
| Storage file aplikasi | Penyimpanan Excel sumber dan dokumen PDF/JPG pengajuan. |
| Better Auth | User, session, password, role, dan validasi akses admin. |
| Zod | Validasi payload API, baris Excel yang sudah dipetakan, dan konfigurasi import. |

### Prinsip teknis

- Semua endpoint dipanggil melalui origin aplikasi Nuxt.
- Endpoint tidak boleh memuat nama sumber data seperti `/api/active` atau
  `/api/local`.
- Query database tidak ditulis langsung di halaman atau endpoint jika dapat
  ditempatkan di repository/service.
- Mutasi lintas tabel dilakukan dalam transaksi database.
- Setiap perubahan status membuat record pada `status_log`.
- Setiap operasi penting admin dicatat pada audit log.
- Server tidak mempercayai nama file, path, ID, atau role dari browser tanpa
  validasi.

## 5. Pengguna dan Hak Akses

Role admin aplikasi:

- `admin`: akses penuh terhadap data, workflow, konfigurasi, dan anggota.
- `qrcc`: mengelola review pengajuan, data item, status operasional, cetak, dan
  pengiriman sesuai kebijakan aplikasi.
- `management`: membaca dashboard, daftar, detail, laporan, dan dokumen sesuai
  kebijakan akses.

Kontrak autentikasi:

- Semua halaman dashboard membutuhkan session Better Auth.
- Semua API memvalidasi session dan role di server.
- Akses file pengajuan juga melewati validasi session dan role.
- Password tidak pernah disimpan dalam bentuk plaintext.
- Bootstrap admin pertama menggunakan token bootstrap yang hanya tersedia
  server-side.

## 6. Workflow Pengajuan

### 6.1 Import pengajuan

Alur utama:

1. Admin membuka menu `Import Pengajuan`.
2. Admin memilih file Excel dan dokumen pendukung PDF/JPG.
3. Server memeriksa versi template dan membaca Excel.
4. Server memetakan baris Excel ke data pengajuan dan item.
5. Server memvalidasi field wajib, nomor serial, format tanggal, model, dan
   duplikasi.
6. Server menampilkan preview beserta error dan warning.
7. Admin memperbaiki data atau mengganti file jika diperlukan.
8. Admin mengonfirmasi import.
9. Server membuat ID pengajuan, menyimpan data, menyimpan file, dan mencatat
   audit dalam satu workflow.
10. Pengajuan baru dibuat dengan status `Baru`.
11. `status_log` mencatat actor dan sumber pembuatan sebagai import admin.

Aturan import:

- Excel adalah sumber data utama.
- Nomor serial selalu dibaca sebagai teks agar angka nol di depan tidak hilang.
- Template Excel harus mempunyai versi yang tervalidasi.
- Field wajib harus lengkap sebelum import dapat dikonfirmasi.
- Setiap file import memiliki fingerprint untuk mencegah pemrosesan ulang yang
  tidak disengaja.
- Nomor serial dan kombinasi kunci bisnis tidak boleh menghasilkan duplikasi
  yang tidak diizinkan.
- PDF/JPG adalah dokumen pendukung dan tidak menjadi sumber kebenaran utama.
- OCR boleh ditambahkan sebagai bantuan, tetapi hasilnya wajib direview admin.

### 6.2 Review dan pemrosesan

Setelah import dikonfirmasi, admin dapat:

- membuka detail pengajuan dan item,
- memperbaiki data utama sesuai permission,
- menyetujui atau menolak satu item,
- menyetujui atau menolak beberapa item,
- memperbarui status pengajuan,
- menambahkan catatan dan melihat riwayat,
- membuka atau mengunduh dokumen,
- memasukkan kartu ke antrean cetak,
- mengatur jenis kartu garansi,
- membuat atau mencetak label pengiriman,
- menandai item sudah dicetak atau dikirim.

### 6.3 Generator ID

Format default:

```text
KG-YYYYMMDD-0001
```

Aturan:

- ID dibuat server-side.
- Nomor urut per hari disimpan di database.
- Pembuatan ID aman terhadap race condition.
- ID tidak bergantung pada nama file upload.
- ID tersedia pada preview dan menjadi identifier permanen setelah import
  dikonfirmasi.

## 7. Lifecycle Status

Seluruh status disimpan dan dikelola pada database aplikasi yang sama.

| Status | Makna |
| --- | --- |
| `Baru` | Pengajuan sudah dibuat dan menunggu pemeriksaan atau proses berikutnya. |
| `Disetujui` | Pengajuan atau item telah disetujui untuk diproses. |
| `Ditolak` | Pengajuan atau item ditolak dan memiliki catatan alasan. |
| `Diprint` | Kartu garansi sudah dicetak. |
| `Dikirim` | Kartu garansi sudah dikirim. |
| `Selesai` | Seluruh proses pengajuan telah selesai. |

Ketentuan:

- Transisi status divalidasi server-side.
- Perubahan status mencatat actor, waktu, status lama, status baru, dan
  catatan.
- Catatan wajib diisi untuk status atau keputusan yang memerlukannya.
- Status item dan status pengajuan mengikuti aturan bisnis yang sama di seluruh
  endpoint.
- Status lama seperti `Menunggu Upload` atau `Diterima` tidak dipakai untuk
  pengajuan baru.
- Data `Selesai` tidak dipindahkan, dihapus, atau dipisahkan dari database
  aplikasi.

## 8. Model Data

Database minimal mencakup:

- `pengajuan`: identitas, data pelanggan, cabang, tanggal, status, dan metadata
  import.
- `pengajuan_items`: item, model, nomor serial, keputusan, status cetak, dan
  status kirim.
- `status_log`: seluruh riwayat perubahan status.
- `pengajuan_files`: Excel sumber dan dokumen pendukung pengajuan.
- `model_produk`: master model, produk, tipe kartu, dan status verifikasi.
- `print_batch`: batch pencetakan dan item yang termasuk di dalamnya.
- `print_layouts`: konfigurasi layout cetak.
- `email_recipients`: daftar penerima notifikasi jika fitur email digunakan.
- `email_log`: riwayat pengiriman notifikasi jika fitur email digunakan.
- `config`: konfigurasi aplikasi yang perlu disimpan di database.
- `audit_log`: operasi penting admin dan perubahan data.
- `import_batches`: metadata import, fingerprint, template version, dan hasil
  validasi.
- Tabel Better Auth: `user`, `account`, `session`, dan `verification`.

Aturan database:

- Foreign key dan unique constraint digunakan untuk menjaga integritas relasi.
- Indeks disiapkan untuk ID pengajuan, nomor serial, model, status, tanggal,
  dan cabang.
- Metadata file mencakup nama aman, tipe MIME, ukuran, checksum, lokasi,
  waktu dibuat, dan actor pengunggah.
- Semua timestamp disimpan dalam format yang konsisten dan ditampilkan sesuai
  timezone aplikasi.
- Jika schema lama masih memakai nama `archive_files`, `sync_log`, atau
  `sync_meta`, nama tersebut harus dimigrasikan ke model aplikasi tunggal dan
  tidak boleh lagi memiliki makna pemisahan sumber data.

## 9. Storage File

Struktur default:

```text
storage/pengajuan/
  {ID Pengajuan}/
    sumber/
      data.xlsx
    hardcopy.pdf
    bukti_01.jpg
    bukti_02.jpg
```

Aturan:

- Root storage dikonfigurasi melalui environment server.
- File tidak menggunakan path yang diberikan langsung oleh user.
- ID pengajuan dinormalisasi sebelum dipakai sebagai nama directory.
- Nama file aplikasi bersifat deterministik.
- File sementara dibersihkan jika import gagal.
- File hanya dapat diakses melalui route Nitro yang memvalidasi session, kecuali
  deployment secara eksplisit menetapkan kebijakan public file yang aman.
- Penghapusan record mengikuti kebijakan audit dan retensi perusahaan.
- Backup database dan storage file harus dibuat dan dipulihkan sebagai satu
  kesatuan.

## 10. API dan Ownership

Semua API berada di Nitro dan tidak membedakan sumber data.

### Auth dan admin

- `/api/auth/*`
- `/api/admin/bootstrap`
- `/api/admin/password`
- `/api/admin/members`
- `/api/admin/config`
- `/api/admin/print-layouts`

### Dashboard dan pengajuan

- `/api/dashboard`
- `/api/dashboard/chart`
- `/api/pengajuan`
- `/api/pengajuan/[idPengajuan]`
- `/api/pengajuan/[idPengajuan]/update`
- `/api/pengajuan/[idPengajuan]/status`
- `/api/pengajuan/[idPengajuan]/item-decision`
- `/api/pengajuan/[idPengajuan]/items-decision`
- `/api/pengajuan/[idPengajuan]/delete`
- `/api/pengajuan/bulk-status`

### Import, file, dan master data

- `/api/import/pengajuan/preview`
- `/api/import/pengajuan/confirm`
- `/api/pengajuan/[idPengajuan]/files/[fileId]`
- `/api/model-produk`
- `/api/model-produk/review`

### Cetak dan pengiriman

- `/api/warranty-print-queue`
- `/api/warranty-print-queue/types`
- `/api/warranty-print-queue/print`
- `/api/shipping-label-queue`
- `/api/shipping-label-queue/ship`

Nama route dapat disesuaikan dengan konvensi project, tetapi kontraknya harus
tetap unified dan tidak membawa konsep `active`, `local`, `archive`, atau
`sync` sebagai pembeda sumber data.

## 11. Runtime Configuration

| Env key | Dipakai oleh | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | Drizzle dan server | URL SQLite atau PostgreSQL. |
| `NUXT_DATABASE_URL` | Nuxt runtime | Alias server untuk URL database. |
| `NUXT_APP_URL` | Nitro dan Better Auth | URL aplikasi server-side. |
| `NUXT_PUBLIC_APP_URL` | Client | URL publik aplikasi jika diperlukan. |
| `BETTER_AUTH_URL` | Better Auth | Base URL autentikasi. |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Better Auth | Daftar origin yang dipercaya. |
| `BETTER_AUTH_SECRET` | Better Auth | Secret produksi untuk session dan signing. |
| `ADMIN_BOOTSTRAP_TOKEN` | Bootstrap admin | Token pembuatan admin pertama. |
| `NUXT_PENGAJUAN_FILE_DIRECTORY` | Nitro server | Root storage file pengajuan. |
| `NUXT_PUBLIC_PENGAJUAN_FILE_BASE_PATH` | Client | Base path hanya jika deployment mengizinkan file publik. |
| `NUXT_BACKUP_DIRECTORY` | Backup service | Lokasi backup database dan file. |
| `NUXT_PUBLIC_APP_NAME` | UI | Nama aplikasi, default `Mau KaGa`. |
| `NUXT_PUBLIC_MAX_UPLOAD_MB` | Import dan upload | Batas ukuran file. |
| `NUXT_PUBLIC_MAX_ITEMS` | Import dan form | Batas jumlah item pengajuan. |
| `NUXT_PUBLIC_APP_VERSION` | Build info | Override versi publik. |
| `NUXT_PUBLIC_APP_REVISION` | Build info | Commit atau revision build. |
| `NUXT_PUBLIC_APP_BRANCH` | Build info | Nama branch build. |
| `NUXT_PUBLIC_APP_BUILD_DATE` | Build info | Timestamp build. |
| `NUXT_PUBLIC_APP_DEPLOY_URL` | Build info | URL deployment publik. |

Environment berikut tidak boleh menjadi dependency runtime:

- URL atau secret Google Apps Script.
- ID Google Spreadsheet.
- ID Google Drive.
- Secret bridge eksternal.
- Konfigurasi aplikasi CS/static terpisah.

## 12. Rendering, Deployment, dan Operasional

- Nuxt dijalankan sebagai aplikasi SSR/SPA sesuai kebutuhan halaman.
- Nitro menjadi server runtime yang dapat dideploy sebagai Node server atau
  target deployment yang mendukung storage persisten.
- Dashboard yang membutuhkan session dan data sensitif tetap divalidasi
  server-side.
- SQLite cocok untuk satu server dengan beban terbatas.
- PostgreSQL dipilih jika jumlah user, transaksi, atau kebutuhan high
  availability meningkat.
- Storage file harus persisten dan berada pada volume yang ikut dibackup.
- Production tidak boleh memakai filesystem ephemeral tanpa storage persisten.

Command utama:

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
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

Prosedur operasional minimum:

- migration dijalankan sebelum aplikasi menggunakan schema baru,
- backup terjadwal mencakup database dan storage file,
- restore diuji pada environment terpisah,
- log error dan audit disimpan sesuai kebijakan retensi,
- restart server tidak boleh menghilangkan data atau file,
- deployment baru memiliki prosedur rollback migration yang terdokumentasi.

## 13. Testing dan Acceptance Criteria

### Test otomatis

Test harus mencakup:

- repository dan service pengajuan tunggal,
- dashboard, daftar, dan detail,
- generator ID dan race condition,
- parsing serta validasi template Excel,
- preview dan konfirmasi import,
- deduplikasi import,
- penyimpanan dan pembacaan file,
- update data utama,
- transisi status dan `status_log`,
- keputusan satu dan banyak item,
- antrean cetak dan pengiriman,
- permission berdasarkan role,
- backup dan restore database beserta file,
- auth dan manajemen anggota.

### Acceptance arsitektur

Implementasi dianggap sesuai jika:

- aplikasi dapat dijalankan hanya dengan Nuxt/Nitro, database, dan storage
  aplikasi,
- tidak ada request runtime dari browser atau server ke Google Apps Script,
  Google Sheets, atau Google Drive,
- tidak ada runtime config, repository, service, bridge, atau endpoint yang
  dibutuhkan untuk layanan Google,
- seluruh data pengajuan dibaca dari satu database aplikasi,
- seluruh mutasi ditulis ke database aplikasi,
- seluruh dokumen dibaca dari storage file aplikasi,
- tidak ada switcher atau query parameter sumber data `Active`/`Local`,
- data `Selesai` tetap dapat dicari dan dibuka,
- admin dapat import Excel beserta dokumen pendukung,
- seluruh perubahan status memiliki riwayat dan actor,
- akses dashboard dan file terlindungi oleh Better Auth,
- backup dan restore database beserta file berhasil,
- `pnpm typecheck`, `pnpm lint`, dan `pnpm test` lulus,
- smoke test workflow admin penuh berhasil.

### Smoke test manual

1. Login sebagai `admin`.
2. Import satu file Excel dan dokumen PDF/JPG.
3. Periksa preview dan konfirmasi import.
4. Buka daftar dan detail pengajuan.
5. Ubah data utama dan keputusan item.
6. Setujui atau tolak pengajuan sesuai aturan.
7. Cetak kartu dan label pengiriman.
8. Tandai item sudah dicetak dan dikirim.
9. Ubah status menjadi `Selesai`.
10. Cari kembali pengajuan dan buka seluruh dokumen.
11. Restart server.
12. Pastikan data, riwayat, dan file tetap tersedia.

## 14. Rencana Migrasi Implementasi

Urutan perubahan yang disarankan:

1. Audit workflow lama dan tetapkan aturan bisnis yang harus dipertahankan.
2. Finalisasi schema database aplikasi tunggal.
3. Implementasikan generator ID dan import Excel.
4. Implementasikan repository serta service pengajuan tunggal.
5. Alihkan dashboard, daftar, dan detail ke API unified.
6. Alihkan seluruh mutasi status, item, cetak, dan pengiriman ke service
   unified.
7. Implementasikan storage file dan route akses file.
8. Pindahkan konfigurasi serta auth ke runtime Nuxt murni.
9. Hapus UI source switcher dan semua query `source=active/local`.
10. Hapus repository, service, schema, utility, dan test yang hanya terkait
    integrasi Google atau sinkronisasi arsip.
11. Hapus halaman/aplikasi CS/static terpisah dari production.
12. Tambahkan backup, restore, test, dan smoke test end-to-end.

Kode Google Apps Script lama boleh dibaca sebagai referensi aturan bisnis saat
memindahkan perilaku, tetapi tidak boleh menjadi dependency build maupun
runtime. Data lama dianggap sudah dibackup sesuai prosedur perusahaan sebelum
cutover ke aplikasi tunggal.

## 15. Status dan Definisi Selesai

Target arsitektur dokumen ini menggantikan PRD hybrid sebelumnya. Implementasi
belum dianggap selesai hanya karena dashboard Nuxt dapat dibuka; seluruh
dependency sumber data lama harus sudah dihapus.

Definisi selesai:

- satu aplikasi Nuxt/Nitro menjadi satu-satunya aplikasi production,
- satu database menjadi sumber kebenaran seluruh lifecycle pengajuan,
- satu storage menjadi sumber kebenaran seluruh dokumen,
- import Excel dan lampiran berjalan dari dashboard,
- semua endpoint memakai service aplikasi tunggal,
- seluruh workflow admin berjalan tanpa layanan eksternal,
- UI dan API tidak lagi memiliki konsep sumber data `Active` atau `Local`,
- auth, audit, backup, restore, dan akses file telah diuji,
- seluruh command acceptance lulus.

## 16. Prinsip Kebersihan Dokumen

PRD ini hanya mendokumentasikan target dan kontrak aplikasi fullstack Nuxt
single-application. Arsitektur hybrid, detail integrasi layanan lama, dan
riwayat migrasi tidak menjadi kontrak runtime. Jika audit historis diperlukan,
gunakan git history atau dokumen migrasi terpisah.
