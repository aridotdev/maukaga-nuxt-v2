# Fase 14 - Pemisahan Bagian/Cabang dan Penambahan Model Inline

## Tujuan

Merapikan identitas lokasi pengajuan dengan memisahkan `Bagian` dan `Cabang`,
serta memudahkan admin/QRCC menambahkan model produk langsung dari form
pengajuan tanpa keluar ke halaman pengaturan.

Prinsip implementasi:

- Perubahan dilakukan bertahap dan tetap memakai service, endpoint, serta
  validasi yang sudah ada.
- Tidak membuat status atau workflow baru.
- Model yang baru ditambahkan langsung berstatus `verified`, mengikuti perilaku
  endpoint master model produk saat ini.
- Tidak membolehkan model bebas yang belum tercatat di master dipakai untuk
  membuat pengajuan.

## Status

- [x] Selesai pada 1 Oktober 2026. Schema unified sudah memakai `bagian` dan
  `cabang`; migrasi dari `bagian_cabang` tidak diperlukan karena overhaul
  dimulai dari database baru.

## 1. Pisahkan Kolom Bagian dan Cabang

### 1.1 Tetapkan kontrak data

- [x] Ganti field domain `bagianCabang` menjadi dua field:
  - `bagian`
  - `cabang`
- [x] Gunakan nama database yang konsisten, misalnya `bagian` dan `cabang`.
- [x] Jadikan kedua field wajib pada form create dan edit.
- [x] Ubah DTO pengajuan, filter, queue cetak/pengiriman, dan tipe frontend
  agar memakai dua field baru.
- [x] Pertahankan arti filter `branch` sebagai filter berdasarkan `cabang`.

### 1.2 Migrasi data lama

- [x] Audit schema/runtime tidak menemukan `pengajuan.bagian_cabang`; tidak ada
  data lama yang perlu dipisahkan pada database unified baru.
- [x] Tidak ada pemisahan nilai lama berdasarkan tebakan string seperti kata
  `Cabang`, karena dapat menghasilkan data bagian/cabang yang salah.
- [x] Aturan migrasi data lama tidak diterapkan karena database overhaul dimulai
  kosong; bila database lama akan dimigrasikan, mapping bisnis eksplisit tetap
  wajib disepakati terlebih dahulu:
  - jika data lama memang hanya berisi cabang, salin ke `cabang` dan kosongkan
    `bagian`; atau
  - siapkan mapping eksplisit untuk data yang sudah diketahui bagian dan
    cabangnya.
- [x] Tidak ada record legacy yang perlu dicatat pada database awal; kebutuhan
  mapping eksplisit tetap menjadi prasyarat bila migrasi legacy dilakukan.
  ditinjau admin.
- [x] `bagian_cabang` tidak ada pada schema unified; seluruh consumer runtime
  sudah memakai field terpisah.
  legacy sesuai strategi deployment. Jangan menghapusnya sebelum seluruh
  consumer sudah pindah.

### 1.3 Backend dan service

- [x] Update schema Drizzle `pengajuan`, insert schema, dan update schema.
- [x] Update `createPengajuanInputSchema` dan
  `updatePengajuanInputSchema`.
- [x] Update service create/update dan mapping DTO.
- [x] Update repository/query yang menggunakan `bagianCabang`.
- [x] Update pencarian dan filter daftar pengajuan:
  - `bagian` dan `cabang` dapat dicari;
  - filter cabang hanya memakai field `cabang`.
- [x] Update queue shipping dan grouping label agar menggunakan kombinasi
  `nama + bagian + cabang`.
- [x] Update teks output print/label supaya bagian dan cabang tampil terpisah.

### 1.4 Frontend

- [x] Pada `app/pages/dashboard/pengajuan/create.vue`, ganti satu input
  `Bagian / cabang` menjadi dua input:
  - `Bagian`
  - `Cabang`
- [x] Pada dialog edit di halaman daftar pengajuan, lakukan perubahan yang sama.
- [x] Tampilkan kolom `Bagian` dan `Cabang` secara terpisah pada tabel.
- [x] Tampilkan keduanya secara terpisah pada detail pengajuan.
- [x] Tambahkan filter cabang berdasarkan field `cabang`; tambahkan filter
  bagian hanya bila dibutuhkan untuk operasional.
- [x] Perbarui teks kosong, placeholder, validasi, dan ringkasan yang masih
  menyebut `Bagian / cabang`.

### 1.5 Acceptance criteria

- [x] Pengajuan baru menyimpan `bagian` dan `cabang` secara terpisah.
- [x] Pengajuan lama tidak menjadi bagian scope karena database unified dimulai
  kosong; schema dan runtime baru tidak bergantung pada `bagian_cabang`.
- [x] Edit pengajuan tidak lagi menulis ke `bagian_cabang`.
- [x] Daftar, detail, filter, queue shipping, dan hasil print menampilkan data
  yang benar.
- [x] Tidak ada consumer runtime yang masih bergantung pada
  `bagianCabang` setelah masa transisi selesai.

## 2. Tambah Model dari Form Create/Update

### 2.1 Gunakan master model yang sudah ada

- [x] Tetap gunakan tabel `model_produk` sebagai sumber kebenaran.
- [x] Gunakan endpoint dan service yang sudah tersedia:
  - `GET /api/model-produk?status=verified`
  - `POST /api/model-produk`
- [x] Jangan membuat tabel, status, atau endpoint duplikat.
- [x] Model baru wajib memiliki:
  - nama model;
  - nama produk.
- [x] Terapkan normalisasi dan validasi duplikasi yang sama dengan halaman
  pengaturan model produk.
- [x] Pertahankan permission yang berlaku saat ini: admin dan QRCC dapat
  menambahkan model.

### 2.2 Perubahan pada combo model

- [x] Tambahkan aksi `Tambah model baru` pada combo model di
  `app/pages/dashboard/pengajuan/create.vue`.
- [x] Aksi tersebut membuka modal kecil tanpa meninggalkan form pengajuan.
- [x] Modal minimal berisi:
  - input nama model;
  - input/nama produk;
  - tombol simpan dan batal.
- [x] Nilai `origin` mengikuti default yang sudah dipakai service saat ini,
  kecuali bisnis memerlukan pilihan origin pada form.
- [x] Jangan mengubah combo menjadi input bebas; item pengajuan tetap hanya
  boleh memilih model yang berhasil tersimpan di master.

### 2.3 Flow setelah model dibuat

- [x] Submit modal ke `POST /api/model-produk`.
- [x] Tampilkan error duplicate atau validasi tanpa menutup modal.
- [x] Setelah berhasil:
  - refresh daftar model verified;
  - tambahkan model baru ke combo;
  - otomatis pilih model baru pada item yang sedang diedit;
  - isi nama produk dari response master;
  - tutup modal dan tampilkan toast sukses.
- [x] Jika refresh gagal setelah create berhasil, tampilkan error yang jelas dan
  lakukan fetch ulang sebelum user melanjutkan submit pengajuan.
- [x] Cegah submit ganda saat proses create model berjalan.

### 2.4 Dukungan pada data update

- [x] Inventarisasi semua form yang memiliki combo model.
- [x] Terapkan aksi `Tambah model baru` pada form item yang dapat mengubah model.
- [x] Saat ini halaman daftar pengajuan hanya mengedit data utama dan belum
  memiliki editor model item. Jangan membuat workflow edit item baru hanya
  untuk fase ini.
- [x] Jika editor model item ditambahkan kemudian, gunakan flow modal dan
  refresh master yang sama agar perilakunya konsisten.

### 2.5 Acceptance criteria

- [x] Admin/QRCC dapat menambahkan model dari form pengajuan.
- [x] Model baru langsung muncul dan dapat dipilih tanpa reload penuh halaman.
- [x] Produk otomatis mengikuti model yang dipilih.
- [x] Model duplikat ditolak dengan pesan yang jelas.
- [x] Model yang belum berhasil dibuat tidak dapat dikirim sebagai item
  pengajuan.
- [x] Model baru tetap dapat dipakai oleh validasi create pengajuan dan antrean
  cetak karena tersimpan sebagai master `verified`.

## 3. Urutan Implementasi

- [x] Pastikan mapping data lama `bagian_cabang` tidak diperlukan untuk
  database unified baru; mapping eksplisit tetap wajib bila legacy migration
  dibuka kembali.
- [x] Tambahkan migration dan update schema backend.
- [x] Update service, DTO, filter, queue, dan util print.
- [x] Update form create, dialog edit, tabel, dan detail.
- [x] Tambahkan modal create model pada combo model.
- [x] Tambahkan test service dan migration yang relevan.
- [x] Jalankan verifikasi:
  - `pnpm db:generate`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`

## 4. Risiko dan Batasan

- Nilai lama `Bagian / cabang` mungkin tidak dapat dipisahkan otomatis. Mapping
  harus disepakati sebelum migration production.
- Menambah model langsung sebagai `verified` berarti model dapat segera masuk
  validasi dan antrean cetak. Jika nanti diperlukan approval master model,
  perubahan tersebut sebaiknya dibuat sebagai fase terpisah.
- Fase ini tidak mencakup import Excel, perubahan status pengajuan, perubahan
  keputusan item, atau perubahan workflow cetak/pengiriman selain penyesuaian
  data lokasi.
