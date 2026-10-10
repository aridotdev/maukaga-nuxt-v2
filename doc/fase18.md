# Rencana Implementasi Fitur Baru

## 1. Keputusan Scope dan Penamaan

- [x] Gunakan istilah **Pemohon** untuk orang/internal pengaju.
- [x] Gunakan istilah **Pemilik Barang** sebagai nama domain untuk pihak pemilik unit/barang.
- [x] Gunakan label menu **Dealer/Toko** untuk master Pemilik Barang agar lebih mudah dipahami user operasional.
- [x] Gunakan nama teknis `pemilik_barang` untuk database dan `pemilik-barang` untuk API/route bila memungkinkan.
- [x] Pastikan Pemohon dan Pemilik Barang/Dealer-Toko adalah dua master data yang berbeda.
- [x] Pastikan data pengajuan tetap memakai snapshot, bukan relasi langsung ke tabel master.

## 2. Analisis Awal Codebase

- [x] Review struktur schema database existing di `server/database/schema`.
- [x] Review pola repository existing, terutama `server/repositories/model-produk-repository.ts`.
- [x] Review pola service existing, terutama `server/services/model-produk-service.ts`.
- [x] Review pola API existing, terutama endpoint `/api/model-produk`.
- [x] Review halaman master existing `app/pages/dashboard/settings/product-name.vue` sebagai acuan CRUD.
- [x] Review halaman `app/pages/dashboard/pengajuan/create.vue` untuk integrasi select Pemohon dan Pemilik Barang.
- [x] Review sidebar di `app/layouts/default.vue` untuk perubahan menu.
- [x] Review halaman parent `app/pages/dashboard/settings.vue` untuk meniru konsep UI menu tab/submenu.

## 3. Database Schema

### 3.1 Master Pemohon

- [x] Buat schema tabel `pemohon`.
- [x] Tambahkan field `id` sebagai primary key.
- [x] Tambahkan field `nama` wajib diisi.
- [x] Tambahkan field `bagian` wajib diisi.
- [x] Tambahkan field `cabang` wajib diisi.
- [x] Tambahkan field `email` opsional.
- [x] Tambahkan field `nomor_hp` opsional.
- [x] Tambahkan field audit sederhana `created_by` dan `updated_by` bila mengikuti pola master existing.
- [x] Tambahkan field timestamp `created_at` dan `updated_at`.
- [x] Tambahkan index untuk pencarian `nama`, `bagian`, dan `cabang` bila diperlukan.
- [x] Tambahkan unique index pada kombinasi `nama`, `bagian`, dan `cabang`.
- [x] Buat insert/select/update schema validation untuk `pemohon`.

### 3.2 Master Pemilik Barang / Dealer-Toko

- [x] Buat schema tabel `pemilik_barang`.
- [x] Tambahkan field `id` sebagai primary key.
- [x] Tambahkan field `nama` wajib diisi.
- [x] Tambahkan field audit sederhana `created_by` dan `updated_by` bila mengikuti pola master existing.
- [x] Tambahkan field timestamp `created_at` dan `updated_at`.
- [x] Tambahkan unique index pada `nama` untuk mencegah duplikasi Dealer/Toko.
- [x] Tambahkan index pada `nama` untuk pencarian.
- [x] Buat insert/select/update schema validation untuk `pemilik_barang`.

### 3.3 Registrasi Schema

- [x] Export schema `pemohon` dari `server/database/schema/index.ts`.
- [x] Export schema `pemilik_barang` dari `server/database/schema/index.ts`.
- [x] Tambahkan kedua tabel ke `databaseSchema`.
- [x] Tidak membuat relation dari `pengajuan` ke `pemohon`.
- [x] Tidak membuat relation dari `pengajuan` ke `pemilik_barang`.

## 4. Repository Layer

### 4.1 Repository Pemohon

- [x] Buat repository untuk list data Pemohon.
- [x] Buat repository untuk find Pemohon by `id`.
- [x] Buat repository untuk find Pemohon berdasarkan kombinasi `nama`, `bagian`, dan `cabang`.
- [x] Buat repository untuk insert Pemohon.
- [x] Buat repository untuk update Pemohon.
- [x] Buat repository untuk delete Pemohon.
- [x] Buat helper audit log bila pola audit log ingin disamakan dengan master lain.

### 4.2 Repository Pemilik Barang

- [x] Buat repository untuk list data Pemilik Barang.
- [x] Buat repository untuk find Pemilik Barang by `id`.
- [x] Buat repository untuk find Pemilik Barang by `nama`.
- [x] Buat repository untuk insert Pemilik Barang.
- [x] Buat repository untuk update Pemilik Barang.
- [x] Buat repository untuk delete Pemilik Barang.
- [x] Buat helper audit log bila pola audit log ingin disamakan dengan master lain.

## 5. Service Layer dan Validasi Bisnis

### 5.1 Service Pemohon

- [x] Buat input schema create Pemohon.
- [x] Buat input schema update Pemohon.
- [x] Normalisasi `nama`, `bagian`, dan `cabang` dengan trim dan collapse whitespace.
- [x] Normalisasi `email` dengan trim dan lowercase.
- [x] Normalisasi `nomorHp` sebagai optional value.
- [x] Cegah duplikasi Pemohon berdasarkan kombinasi `nama`, `bagian`, dan `cabang`.
- [x] Return DTO yang konsisten: `id`, `nama`, `bagian`, `cabang`, `email`, `nomorHp`, `createdAt`, `updatedAt`.
- [x] Tangani error duplicate dengan status `409`.
- [x] Tangani data tidak ditemukan dengan status `404`.

### 5.2 Service Pemilik Barang

- [x] Buat input schema create Pemilik Barang.
- [x] Buat input schema update Pemilik Barang.
- [x] Normalisasi `nama` dengan trim dan collapse whitespace.
- [x] Cegah duplikasi berdasarkan `nama`.
- [x] Return DTO yang konsisten: `id`, `nama`, `createdAt`, `updatedAt`.
- [x] Tangani error duplicate dengan status `409`.
- [x] Tangani data tidak ditemukan dengan status `404`.

## 6. API Endpoint

### 6.1 API Pemohon

- [x] Buat `GET /api/pemohon` untuk list Pemohon.
- [x] Buat `POST /api/pemohon` untuk tambah Pemohon.
- [x] Buat `PATCH /api/pemohon/[id]` untuk update Pemohon.
- [x] Buat `DELETE /api/pemohon/[id]` atau endpoint delete sesuai pola project untuk hapus Pemohon.
- [x] Lindungi endpoint list minimal dengan session login.
- [x] Lindungi endpoint create/update/delete dengan role yang sesuai, direkomendasikan `admin` dan `qrcc` bila mengikuti master Product Name.
- [x] Gunakan `normalizeApiError` untuk format error konsisten.

### 6.2 API Pemilik Barang / Dealer-Toko

- [x] Buat `GET /api/pemilik-barang` untuk list Dealer/Toko.
- [x] Buat `POST /api/pemilik-barang` untuk tambah Dealer/Toko.
- [x] Buat `PATCH /api/pemilik-barang/[id]` untuk update Dealer/Toko.
- [x] Buat `DELETE /api/pemilik-barang/[id]` atau endpoint delete sesuai pola project untuk hapus Dealer/Toko.
- [x] Lindungi endpoint list minimal dengan session login.
- [x] Lindungi endpoint create/update/delete dengan role yang sesuai, direkomendasikan `admin` dan `qrcc` bila mengikuti master Product Name.
- [x] Gunakan `normalizeApiError` untuk format error konsisten.

## 7. Type Frontend

- [x] Buat type response untuk Pemohon, misalnya `PemohonRow` dan `PemohonResponse`.
- [x] Buat type response untuk Pemilik Barang, misalnya `PemilikBarangRow` dan `PemilikBarangResponse`.
- [x] Simpan type di folder types existing agar konsisten dengan `types/model-produk`.
- [x] Pastikan field camelCase dipakai di frontend, misalnya `nomorHp`, `createdAt`, dan `updatedAt`.

## 8. Halaman Master Data

### 8.1 Parent Master Data

- [x] Buat parent route `/dashboard/master-data`.
- [x] Buat halaman `app/pages/dashboard/master-data.vue`.
- [x] Buat toolbar submenu dengan konsep UI seperti halaman `Settings`.
- [x] Tambahkan submenu **Product Name**.
- [x] Tambahkan submenu **Pemohon**.
- [x] Tambahkan submenu **Dealer/Toko**.

### 8.2 Pindah Halaman Product Name

- [x] Pindahkan halaman Product Name dari `/dashboard/settings/product-name` ke `/dashboard/master-data/product-name`.
- [x] Pastikan logic CRUD Product Name tetap sama.
- [x] Update semua link sidebar dan submenu yang mengarah ke Product Name.
- [x] Pertimbangkan redirect dari route lama `/dashboard/settings/product-name` ke route baru bila ingin menjaga kompatibilitas bookmark.

### 8.3 Halaman Master Pemohon

- [x] Buat halaman `/dashboard/master-data/pemohon`.
- [x] Tampilkan tabel data Pemohon gunakan UTable.
- [x] Tambahkan fitur global filter.
- [x] Tambahkan tombol tambah Pemohon.
- [x] Tambahkan form tambah Pemohon.
- [x] Tambahkan aksi edit Pemohon.
- [x] Tambahkan form edit Pemohon.
- [x] Tambahkan aksi hapus Pemohon.
- [x] Tambahkan dialog konfirmasi hapus.
- [x] Tambahkan state loading, empty, dan error.
- [x] Tambahkan toast sukses/gagal untuk create, update, dan delete.
- [x] Pastikan validasi field sesuai service: nama, bagian, dan cabang wajib; email dan nomor HP opsional.

### 8.4 Halaman Master Dealer/Toko

- [x] Buat halaman `/dashboard/master-data/dealer-toko` atau `/dashboard/master-data/pemilik-barang`.
- [x] Gunakan label UI **Dealer/Toko**.
- [x] Tampilkan tabel data Dealer/Toko.
- [x] Tambahkan pencarian berdasarkan nama.
- [x] Tambahkan tombol tambah Dealer/Toko.
- [x] Tambahkan form tambah Dealer/Toko.
- [x] Tambahkan aksi edit Dealer/Toko.
- [x] Tambahkan form edit Dealer/Toko.
- [x] Tambahkan aksi hapus Dealer/Toko.
- [x] Tambahkan dialog konfirmasi hapus.
- [x] Tambahkan state loading, empty, dan error.
- [x] Tambahkan toast sukses/gagal untuk create, update, dan delete.
- [x] Pastikan validasi field nama wajib diisi dan tidak duplikat.

## 9. Integrasi Halaman Pengajuan Create

### 9.1 Integrasi Pemohon

- [x] Fetch data Pemohon di `app/pages/dashboard/pengajuan/create.vue`.
- [x] Ubah input **Nama Pemohon** menjadi select dari master Pemohon.
- [x] Gunakan komponen `<USelectMenu />` atau komponen select existing yang paling konsisten dengan Product Name.
- [x] Saat Pemohon dipilih, isi snapshot `state.nama`, `state.bagian`, dan `state.cabang`.
- [x] Tampilkan field Bagian dan Cabang sebagai hasil dari Pemohon terpilih.
- [x] Bagian dan Cabang read-only agar snapshot konsisten dengan master.
- [x] Pastikan submit pengajuan tetap mengirim `nama`, `bagian`, dan `cabang`, bukan `pemohonId`.
- [x] Jangan tambahkan fitur tambah Pemohon di halaman create.
- [x] Tambahkan empty state jika belum ada data Pemohon, dengan arahan agar data dibuat dari menu Master Data.

### 9.2 Integrasi Pemilik Barang / Dealer-Toko

- [x] Fetch data Pemilik Barang di `app/pages/dashboard/pengajuan/create.vue`.
- [x] Ubah field **Pemilik** menjadi `<USelectMenu />` dari master Dealer/Toko.
- [x] Saat Dealer/Toko dipilih, isi snapshot `state.pemilik`.
- [x] Pastikan submit pengajuan tetap mengirim `pemilik`, bukan `pemilikBarangId`.
- [x] Jangan tambahkan fitur tambah Dealer/Toko di halaman create.
- [x] Tambahkan empty state jika belum ada data Dealer/Toko, dengan arahan agar data dibuat dari menu Master Data.

### 9.3 Konsistensi Validasi Create Pengajuan

- [x] Pastikan schema frontend tetap mewajibkan `nama`, `bagian`, `cabang`, dan `pemilik`.
- [x] Pastikan service backend pengajuan tetap menerima snapshot string.
- [x] Pastikan tidak ada perubahan struktur tabel `pengajuan` untuk kebutuhan relasi master.
- [x] Pastikan alur Product Name/model produk existing tetap berjalan.

## 10. Perubahan Sidebar dan Navigasi

- [x] Tambahkan menu utama **Cetak** di sidebar.
- [x] Pindahkan link **Kartu Garansi** ke submenu **Cetak**.
- [x] Pindahkan link **Label Pengiriman** ke submenu **Cetak**.
- [x] Tambahkan menu utama **Master Data** di sidebar.
- [x] Tambahkan submenu **Product Name** ke **Master Data**.
- [x] Tambahkan submenu **Pemohon** ke **Master Data**.
- [x] Tambahkan submenu **Dealer/Toko** ke **Master Data**.
- [x] Pindahkan Product Name dari **Setting** ke **Master Data**.
- [x] Pastikan **Setting** hanya berisi menu yang memang konfigurasi aplikasi, seperti Layout Cetak dan User Management.
- [x] Gunakan konsep UI sidebar yang sama dengan menu **Setting** existing.
- [x] Pastikan mobile sidebar tertutup setelah user memilih submenu.

## 11. Hak Akses dan Security

- [x] Pastikan semua endpoint master hanya bisa diakses user yang sudah login.
- [x] Pastikan create/update/delete master hanya bisa dilakukan role yang sesuai.
- [x] Samakan aturan role dengan Product Name bila tidak ada aturan khusus baru.
- [x] Jangan expose data sensitif yang tidak dibutuhkan di response.
- [x] Validasi semua input di backend, tidak hanya frontend.
- [x] Pastikan error duplicate dan validation error aman ditampilkan ke user.

## 12. UX dan Detail UI

- [x] Gunakan pola layout dan komponen yang konsisten dengan dashboard existing.
- [x] Gunakan label **Pemohon** untuk master Pemohon.
- [x] Gunakan label **Dealer/Toko** untuk menu master Pemilik Barang.
- [x] Gunakan label **Pemilik** atau **Pemilik Barang** di form pengajuan sesuai label existing.
- [x] Tambahkan placeholder pencarian yang jelas.
- [x] Tambahkan empty state yang menjelaskan data harus dibuat dari Master Data.
- [x] Tambahkan toast feedback untuk semua aksi mutasi data.
- [x] Pastikan halaman nyaman digunakan di desktop dan mobile.
- [x] Pastikan select menu tetap mudah dicari ketika data master banyak.

## 13. Migrasi dan Data Awal

- [ ] Tentukan apakah perlu membuat data awal dari data pengajuan existing.
- [ ] Jika diperlukan, buat script opsional untuk mengambil distinct `nama`, `bagian`, `cabang` dari pengajuan existing menjadi master Pemohon.
- [ ] Jika diperlukan, buat script opsional untuk mengambil distinct `pemilik` dari pengajuan existing menjadi master Pemilik Barang.
- [ ] Pastikan proses migrasi data awal tidak membuat duplikasi.
- [ ] Pastikan script data awal tidak otomatis berjalan tanpa konfirmasi.

## 14. Testing Manual

### 14.1 Master Pemohon

- [x] Bisa membuka halaman Master Data > Pemohon.
- [x] Bisa menambah Pemohon baru.
- [x] Tidak bisa menambah Pemohon dengan data wajib kosong.
- [x] Tidak bisa menambah Pemohon duplikat berdasarkan aturan unik.
- [x] Bisa mengedit Pemohon.
- [x] Bisa menghapus Pemohon.
- [x] Tabel, search, loading, empty, dan error state berjalan baik.

### 14.2 Master Dealer/Toko

- [x] Bisa membuka halaman Master Data > Dealer/Toko.
- [x] Bisa menambah Dealer/Toko baru.
- [x] Tidak bisa menambah Dealer/Toko dengan nama kosong.
- [x] Tidak bisa menambah Dealer/Toko dengan nama duplikat.
- [x] Bisa mengedit Dealer/Toko.
- [x] Bisa menghapus Dealer/Toko.
- [x] Tabel, search, loading, empty, dan error state berjalan baik.

### 14.3 Pengajuan Create

- [x] Bisa memilih Pemohon dari master.
- [x] Pemilihan Pemohon mengisi nama, bagian, dan cabang sebagai snapshot.
- [x] Bisa memilih Pemilik Barang/Dealer-Toko dari master.
- [x] Pemilihan Dealer/Toko mengisi field `pemilik` sebagai snapshot.
- [x] Pengajuan baru berhasil dibuat dengan data snapshot yang benar.
- [x] Tidak ada tombol tambah Pemohon di halaman create.
- [x] Tidak ada tombol tambah Dealer/Toko di halaman create.
- [x] Alur tambah item dan pilih Product Name/model tetap berjalan.

### 14.4 Sidebar

- [x] Menu Cetak tampil dan berisi Kartu Garansi serta Label Pengiriman.
- [x] Menu Master Data tampil dan berisi Product Name, Pemohon, serta Dealer/Toko.
- [x] Menu Setting tidak lagi menampilkan Product Name.
- [x] Semua link sidebar mengarah ke halaman yang benar.
- [x] Navigasi sidebar bekerja baik di desktop dan mobile.

## 15. Testing Teknis

- [x] Jalankan typecheck bila tersedia.
- [x] Jalankan lint bila tersedia.
- [ ] Jalankan unit test existing bila tersedia.
- [ ] Jalankan build Nuxt untuk memastikan tidak ada error compile.
- [ ] Verifikasi tidak ada route lama yang masih direferensikan tanpa redirect.
- [ ] Verifikasi tidak ada perubahan tidak sengaja pada alur pengajuan existing.

## 16. Urutan Implementasi yang Direkomendasikan

- [ ] Tahap 1: Tambah database schema Pemohon dan Pemilik Barang.
- [ ] Tahap 2: Tambah repository dan service untuk kedua master.
- [ ] Tahap 3: Tambah API CRUD untuk kedua master.
- [ ] Tahap 4: Tambah type frontend untuk response kedua master.
- [ ] Tahap 5: Buat parent route Master Data.
- [ ] Tahap 6: Pindahkan Product Name dari Setting ke Master Data.
- [ ] Tahap 7: Buat halaman CRUD Pemohon.
- [ ] Tahap 8: Buat halaman CRUD Dealer/Toko.
- [ ] Tahap 9: Integrasikan Pemohon dan Dealer/Toko ke `pengajuan/create.vue`.
- [ ] Tahap 10: Ubah struktur sidebar menu Cetak, Master Data, dan Setting.
- [ ] Tahap 11: Jalankan testing manual dan teknis.
- [ ] Tahap 12: Rapikan detail UX, error message, dan redirect bila dibutuhkan.

## 17. Catatan Non-Scope

- [ ] Tidak membuat relasi database dari pengajuan ke Pemohon.
- [ ] Tidak membuat relasi database dari pengajuan ke Pemilik Barang.
- [ ] Tidak menambahkan fitur tambah Pemohon dari halaman pengajuan create.
- [ ] Tidak menambahkan fitur tambah Dealer/Toko dari halaman pengajuan create.
- [ ] Tidak mengubah data historis pengajuan kecuali ada keputusan migrasi terpisah.
