# Implementation Plan - Admin Lokal Satu Sumber

Dokumen ini berisi rencana perubahan MAUKAGA menjadi aplikasi admin lokal dengan satu sumber data. Aplikasi CS/public dihilangkan. Data lama dianggap sudah dipisahkan dan dibackup, sehingga implementasi ini diperlakukan sebagai aplikasi baru untuk pengajuan baru berikutnya.

## 1. Tujuan

- Admin tetap menggunakan dashboard MAUKAGA dengan alur kerja yang familiar.
- Seluruh data pengajuan baru tersimpan di satu database lokal.
- Seluruh file pengajuan baru tersimpan di satu storage lokal.
- Pengajuan baru dibuat dari file Excel dan dokumen PDF/JPG yang diinput oleh admin.
- Seluruh operasi berjalan melalui Nuxt/Nitro di localhost atau server internal perusahaan.
- Production tidak membutuhkan Google Apps Script, Google Sheets, Google Drive, Cloudflare, atau aplikasi CS/static.

## 2. Target Arsitektur

```text
Browser Admin
    |
    v
Nuxt/Nitro Admin App
    |
    +-- SQLite atau PostgreSQL lokal
    +-- storage file lokal
    +-- service pengajuan lokal
    +-- auth Better Auth lokal
```

Satu sumber lokal mencakup:

- pengajuan,
- item pengajuan,
- riwayat status,
- model produk,
- batch cetak,
- batch pengiriman,
- layout cetak,
- konfigurasi,
- akun dan session admin,
- file Excel sumber,
- dokumen PDF/JPG pendukung.

Komponen yang dipertahankan:

- UI dashboard admin.
- Better Auth lokal.
- Drizzle ORM dan fondasi schema database.
- Halaman daftar dan detail pengajuan.
- Workflow update data, status, keputusan item, cetak kartu, label pengiriman, dan pengaturan admin.

Komponen yang dihapus dari runtime akhir:

- repository dan service yang memanggil Google Apps Script.
- bridge HMAC Nitro ke Google Apps Script.
- aplikasi CS/static.
- Google Sheets sebagai database.
- Google Drive sebagai penyimpanan file.
- dependency konfigurasi runtime untuk layanan Google.

## 3. Prinsip Implementasi

- Database lokal menjadi sumber kebenaran tunggal untuk semua status pengajuan.
- Data dengan status `Selesai` tetap berada di database yang sama.
- Tidak ada proses pemindahan data antar sistem.
- Endpoint admin yang sudah dipakai frontend dipertahankan selama transisi agar perubahan UI minimal.
- Service lokal mengembalikan payload yang kompatibel dengan payload yang dipakai frontend saat ini.
- Semua operasi mutasi dilakukan dalam transaksi database jika menyentuh lebih dari satu tabel.
- Semua perubahan status dicatat ke `status_log`.
- Semua file disimpan dengan nama deterministik dan path yang aman.
- Excel menjadi sumber data utama untuk pembuatan pengajuan.
- PDF/JPG menjadi dokumen pendukung, bukan sumber utama data.

## 4. Fase Implementasi

### Fase 1 - Audit Workflow dan Kontrak Data Lama

Inventarisasi fitur dashboard yang masih perlu dipertahankan:

- ringkasan dashboard,
- grafik dashboard,
- daftar pengajuan,
- detail pengajuan,
- update data utama pengajuan,
- update status,
- keputusan satu item,
- keputusan banyak item,
- hapus pengajuan,
- review model produk,
- master model produk,
- queue cetak kartu,
- queue label pengiriman,
- penyimpanan jenis kartu garansi,
- penandaan item sudah dicetak,
- penandaan item sudah dikirim,
- pembacaan file pengajuan.

Output fase ini:

- daftar kontrak request/response yang dipakai frontend,
- pemetaan setiap kontrak ke tabel dan service lokal,
- daftar field yang belum tersedia di database lokal,
- daftar aturan bisnis yang perlu dipindahkan dari implementasi lama,
- daftar halaman yang masih memiliki asumsi layanan eksternal.

Catatan: implementasi Google Apps Script lama boleh dibaca sebagai referensi aturan bisnis, tetapi tidak menjadi dependency runtime.

### Fase 2 - Finalisasi Schema Database Lokal

Schema lokal saat ini sudah memiliki fondasi:

- `pengajuan`
- `pengajuan_items`
- `status_log`
- tabel file pengajuan
- `model_produk`
- `print_batch`
- `print_layouts`
- `email_recipients`
- `email_log`
- `config`
- tabel Better Auth

Yang perlu diverifikasi atau ditambahkan:

- metadata semua file pengajuan,
- tipe file dan nomor urut lampiran,
- ukuran, MIME type, checksum, dan lokasi file,
- sumber pembuatan pengajuan,
- metadata import file,
- batch import,
- audit log untuk operasi admin penting,
- indeks pencarian nomor seri, model, status, tanggal, dan cabang,
- constraint untuk mencegah duplikasi ID pengajuan dan item,
- tabel atau kolom untuk menyimpan fingerprint import agar file yang sama tidak diproses dua kali tanpa sengaja.

Gunakan satu tabel file pengajuan, misalnya `pengajuan_files`, dengan relasi ke `pengajuan`. Jika tabel file yang sekarang masih memakai nama teknis lama, lakukan rename melalui migration dan gunakan istilah baru pada seluruh service serta UI.

### Fase 3 - Bangun Repository dan Service Lokal

Buat lapisan lokal yang menjadi sumber seluruh workflow:

```text
server/repositories/pengajuan-local-repository.ts
server/services/pengajuan-local-service.ts
```

Repository dan service ini bertanggung jawab atas:

- membaca ringkasan dashboard,
- membaca grafik dan daftar pengajuan,
- membaca detail pengajuan,
- membuat pengajuan dari hasil import file,
- memperbarui data utama pengajuan,
- memperbarui status pengajuan,
- memperbarui keputusan satu atau banyak item,
- menghapus pengajuan,
- membaca queue cetak kartu,
- membaca queue label pengiriman,
- menyimpan jenis kartu garansi,
- menandai item sudah dicetak,
- menandai item sudah dikirim,
- membaca dan mengelola model produk,
- membaca dan menyajikan file pengajuan.

Gunakan service untuk aturan bisnis dan repository untuk operasi database. Hindari menaruh query langsung di endpoint Nitro.

### Fase 4 - Alihkan Endpoint Admin ke Service Lokal

Endpoint admin yang menjadi pintu masuk dashboard diarahkan ke service lokal.

Strategi:

- pertahankan kontrak endpoint selama masa perubahan,
- ganti implementasi server-side menjadi pemanggilan service lokal,
- pertahankan bentuk response agar composable dan halaman dashboard tetap kompatibel,
- pindahkan validasi payload ke schema Zod yang digunakan Nitro,
- hapus pemeriksaan token bridge dan konfigurasi layanan eksternal.

Setiap endpoint mutasi harus:

1. memvalidasi session dan role admin,
2. memvalidasi body dengan Zod,
3. mengambil data saat ini,
4. menerapkan aturan bisnis,
5. memperbarui tabel terkait dalam transaksi,
6. menulis riwayat perubahan,
7. mengembalikan detail terbaru.

### Fase 5 - Implementasi Storage File Lokal

Gunakan satu root directory untuk seluruh file pengajuan:

```text
public/pengajuan_file/
  {ID Pengajuan}/
    sumber/
      data.xlsx
    hardcopy.pdf
    bukti_01.jpg
    bukti_02.jpg
```

Jika file tidak boleh disajikan langsung melalui directory publik, gunakan route Nitro untuk mengunduh file setelah session admin divalidasi. Pilihan ini lebih tepat untuk dokumen yang mengandung data pelanggan.

Aturan storage:

- file selalu ditulis di bawah directory yang dikonfigurasi,
- ID pengajuan dinormalisasi sebelum menjadi nama directory,
- nama file tidak boleh berasal langsung dari path user,
- file diberi nama deterministik,
- MIME type, ukuran, checksum, dan waktu penyimpanan dicatat ke database,
- file sementara dibersihkan jika transaksi import gagal,
- penghapusan pengajuan mengikuti kebijakan audit perusahaan,
- backup database dan file dibuat sebagai satu kesatuan.

### Fase 6 - Implementasi Import Pengajuan dari File

Karena hanya admin yang menggunakan aplikasi, pengajuan baru dibuat melalui menu import:

```text
Dashboard Admin -> Import Pengajuan
```

Alur:

1. Admin memilih file Excel dan dokumen PDF/JPG.
2. Sistem membaca Excel.
3. Sistem memetakan isi Excel ke `pengajuan` dan `pengajuan_items`.
4. Sistem mengaitkan dokumen pendukung dengan pengajuan.
5. Sistem menampilkan preview dan peringatan validasi.
6. Admin mengoreksi data jika diperlukan.
7. Admin mengonfirmasi pembuatan pengajuan.
8. Sistem menyimpan data dan file dalam satu operasi import.
9. Pengajuan dibuat dengan status `Baru`.
10. `status_log` mencatat bahwa pengajuan dibuat melalui import file.

Aturan import:

- Excel menjadi sumber data utama.
- Nomor serial wajib dibaca sebagai teks.
- Template Excel harus punya versi.
- Field wajib divalidasi sebelum pengajuan dibuat.
- File PDF/JPG disimpan sebagai dokumen pendukung.
- OCR dari PDF/JPG bersifat opsional dan hanya menjadi bantuan pembacaan, bukan kebenaran utama.
- Admin wajib melakukan review sebelum data disimpan permanen.

### Fase 7 - Generator ID Lokal

Karena aplikasi berjalan sebagai sistem baru, pengajuan baru membutuhkan generator ID lokal.

Contoh format:

```text
MKG-YYYYMMDD-0001
```

Aturan:

- ID dibuat server-side.
- Nomor urut per hari disimpan di database.
- Proses pembuatan ID harus aman dari race condition.
- ID tidak boleh bergantung pada nama file upload.
- ID tampil di preview import sebelum admin konfirmasi.
- ID dicetak atau disimpan sebagai referensi dokumen jika dibutuhkan.

### Fase 8 - Lifecycle Lokal

Semua status dikelola di database lokal yang sama.

Status yang dipakai:

- `Baru`
- `Disetujui`
- `Ditolak`
- `Diprint`
- `Dikirim`
- `Selesai`

Catatan:

- Status draft dari aplikasi CS lama tidak diperlukan jika pengajuan langsung dibuat oleh admin.
- Jika dibutuhkan tahap review import, gunakan status internal seperti `Menunggu Review Import` hanya sebelum record final dibuat.
- Setelah record pengajuan dibuat, gunakan lifecycle utama di atas.

Perubahan status harus:

- memvalidasi transisi yang diperbolehkan,
- mencatat actor admin,
- mencatat catatan admin jika wajib,
- memperbarui item terkait jika aturan bisnis membutuhkannya,
- menulis `status_log`.

### Fase 9 - Update Config dan Environment

Hapus kebutuhan runtime berikut:

- URL Google Apps Script,
- URL Google Apps Script publik,
- secret bridge Google Apps Script,
- konfigurasi Google Sheets,
- konfigurasi Google Drive,
- konfigurasi deploy aplikasi CS/static.

Gunakan konfigurasi lokal:

- `DATABASE_URL`
- `NUXT_DATABASE_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `ADMIN_BOOTSTRAP_TOKEN`
- `NUXT_PUBLIC_APP_NAME`
- `NUXT_PENGAJUAN_FILE_DIRECTORY`
- `NUXT_PUBLIC_PENGAJUAN_FILE_BASE_PATH`
- konfigurasi backup database dan storage.

### Fase 10 - Testing

Tambahkan test untuk:

- repository dan service lokal,
- endpoint dashboard, daftar, dan detail,
- generator ID lokal,
- pembuatan pengajuan dari import,
- validasi template Excel,
- pencegahan duplikasi import,
- update data utama,
- perubahan status dan `status_log`,
- keputusan satu dan banyak item,
- queue cetak kartu,
- queue label pengiriman,
- penyimpanan dan pembacaan file lokal,
- permission admin berdasarkan role,
- backup dan restore database beserta file.

Command acceptance:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Smoke test manual:

- login sebagai admin,
- import satu pengajuan beserta file,
- buka daftar dan detail pengajuan,
- ubah data utama,
- setujui atau tolak item,
- cetak kartu,
- cetak label,
- tandai item sudah dikirim,
- ubah status menjadi `Selesai`,
- cari kembali pengajuan tersebut,
- buka seluruh file,
- restart server,
- pastikan data dan file tetap tersedia.

## 5. Area Kode Terdampak

Kemungkinan besar berubah:

- repository dan service yang saat ini memanggil layanan eksternal,
- seluruh endpoint Nitro untuk dashboard dan pengajuan,
- schema database file dan migration,
- utility penyimpanan file,
- utility sinkronisasi lama,
- composable API admin jika bentuk endpoint berubah,
- composable pemilihan sumber data,
- halaman daftar, detail, dan cetak jika masih memiliki asumsi URL eksternal,
- konfigurasi runtime dan dokumentasi setup,
- script build atau sinkronisasi aplikasi CS/static.

Kemungkinan besar dapat dipertahankan:

- layout dashboard,
- Better Auth,
- sebagian besar komponen dashboard,
- schema utama pengajuan dan item,
- komponen print layout,
- halaman pengaturan admin,
- test auth dan administrasi yang tidak bergantung pada layanan eksternal.

## 6. Risiko Utama

- Aturan bisnis lama mungkin belum seluruhnya tercermin di service lokal.
- Queue cetak dan pengiriman dapat memiliki aturan turunan status yang harus dipindahkan dengan cermat.
- Import ulang file dapat menghasilkan duplikasi jika tidak memakai fingerprint atau kunci deduplikasi.
- SQLite cocok untuk satu server dengan beban terbatas; PostgreSQL lebih tepat jika jumlah admin dan transaksi meningkat.
- Dokumen pelanggan perlu perlindungan akses, backup, dan kebijakan retensi.
- Perubahan schema harus memiliki migration dan prosedur rollback.
- Template Excel yang berubah tanpa versi dapat membuat importer mudah rusak.

## 7. Urutan Kerja Rekomendasi

1. Dokumentasikan workflow dan aturan bisnis yang harus dipertahankan.
2. Finalisasi schema database tunggal.
3. Implementasikan generator ID lokal.
4. Implementasikan repository dan service lokal.
5. Implementasikan pembacaan dashboard, daftar, dan detail.
6. Implementasikan mutasi data, status, dan keputusan item.
7. Implementasikan queue cetak dan pengiriman.
8. Implementasikan storage file lokal.
9. Implementasikan import Excel dan lampiran.
10. Alihkan endpoint admin ke service lokal.
11. Hapus aplikasi CS/static dari build dan dokumentasi.
12. Hapus dependency layanan eksternal dari runtime production.
13. Jalankan testing dan smoke test penuh.

## 8. Estimasi Ukuran Perubahan

Perubahan ini besar pada sisi backend dan alur input data, tetapi bukan rewrite total.

Bagian terbesar:

- mengganti sumber data dengan database lokal,
- memindahkan aturan bisnis ke Nitro,
- mengganti storage file menjadi lokal,
- membuat importer Excel dan lampiran,
- memastikan seluruh mutasi memiliki perilaku yang konsisten.

Bagian yang dapat digunakan kembali:

- UI dashboard utama,
- auth admin lokal,
- fondasi schema database,
- layout cetak,
- komponen dan workflow administrasi yang tidak bergantung pada layanan eksternal.

Pendekatan yang disarankan adalah implementasi bertahap dengan kompatibilitas endpoint, bukan mengganti seluruh aplikasi sekaligus.

## 9. Definisi Selesai

Implementasi dianggap selesai jika:

- admin dapat menjalankan dashboard tanpa konfigurasi layanan eksternal,
- seluruh data pengajuan baru dibaca dari satu database lokal,
- seluruh mutasi ditulis ke database lokal,
- seluruh file dibaca dari storage lokal,
- pengajuan baru dapat dibuat melalui import file,
- aplikasi CS/static tidak lagi menjadi bagian production,
- tidak ada browser atau server production yang memanggil layanan eksternal,
- backup database dan file dapat dipulihkan,
- `pnpm typecheck`, `pnpm lint`, dan `pnpm test` lulus,
- smoke test workflow admin penuh berhasil.
