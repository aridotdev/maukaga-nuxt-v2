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

- [ ] Belum dimulai

## 1. Pisahkan Kolom Bagian dan Cabang

### 1.1 Tetapkan kontrak data

- [ ] Ganti field domain `bagianCabang` menjadi dua field:
  - `bagian`
  - `cabang`
- [ ] Gunakan nama database yang konsisten, misalnya `bagian` dan `cabang`.
- [ ] Jadikan kedua field wajib pada form create dan edit.
- [ ] Ubah DTO pengajuan, filter, queue cetak/pengiriman, dan tipe frontend
  agar memakai dua field baru.
- [ ] Pertahankan arti filter `branch` sebagai filter berdasarkan `cabang`.

### 1.2 Migrasi data lama

- [ ] Audit nilai lama pada `pengajuan.bagian_cabang` sebelum migration.
- [ ] Jangan memisahkan nilai lama berdasarkan tebakan string seperti kata
  `Cabang`, karena dapat menghasilkan data bagian/cabang yang salah.
- [ ] Gunakan aturan migrasi yang disepakati bisnis:
  - jika data lama memang hanya berisi cabang, salin ke `cabang` dan kosongkan
    `bagian`; atau
  - siapkan mapping eksplisit untuk data yang sudah diketahui bagian dan
    cabangnya.
- [ ] Simpan daftar record yang tidak dapat dipastikan mapping-nya untuk
  ditinjau admin.
- [ ] Setelah data lama aman, hapus `bagian_cabang` atau tandai sebagai field
  legacy sesuai strategi deployment. Jangan menghapusnya sebelum seluruh
  consumer sudah pindah.

### 1.3 Backend dan service

- [ ] Update schema Drizzle `pengajuan`, insert schema, dan update schema.
- [ ] Update `createPengajuanInputSchema` dan
  `updatePengajuanInputSchema`.
- [ ] Update service create/update dan mapping DTO.
- [ ] Update repository/query yang menggunakan `bagianCabang`.
- [ ] Update pencarian dan filter daftar pengajuan:
  - `bagian` dan `cabang` dapat dicari;
  - filter cabang hanya memakai field `cabang`.
- [ ] Update queue shipping dan grouping label agar menggunakan kombinasi
  `nama + bagian + cabang`.
- [ ] Update teks output print/label supaya bagian dan cabang tampil terpisah.

### 1.4 Frontend

- [ ] Pada `app/pages/dashboard/pengajuan/create.vue`, ganti satu input
  `Bagian / cabang` menjadi dua input:
  - `Bagian`
  - `Cabang`
- [ ] Pada dialog edit di halaman daftar pengajuan, lakukan perubahan yang sama.
- [ ] Tampilkan kolom `Bagian` dan `Cabang` secara terpisah pada tabel.
- [ ] Tampilkan keduanya secara terpisah pada detail pengajuan.
- [ ] Tambahkan filter cabang berdasarkan field `cabang`; tambahkan filter
  bagian hanya bila dibutuhkan untuk operasional.
- [ ] Perbarui teks kosong, placeholder, validasi, dan ringkasan yang masih
  menyebut `Bagian / cabang`.

### 1.5 Acceptance criteria

- [ ] Pengajuan baru menyimpan `bagian` dan `cabang` secara terpisah.
- [ ] Pengajuan lama tetap dapat dibaca setelah migration.
- [ ] Edit pengajuan tidak lagi menulis ke `bagian_cabang`.
- [ ] Daftar, detail, filter, queue shipping, dan hasil print menampilkan data
  yang benar.
- [ ] Tidak ada consumer runtime yang masih bergantung pada
  `bagianCabang` setelah masa transisi selesai.

## 2. Tambah Model dari Form Create/Update

### 2.1 Gunakan master model yang sudah ada

- [ ] Tetap gunakan tabel `model_produk` sebagai sumber kebenaran.
- [ ] Gunakan endpoint dan service yang sudah tersedia:
  - `GET /api/model-produk?status=verified`
  - `POST /api/model-produk`
- [ ] Jangan membuat tabel, status, atau endpoint duplikat.
- [ ] Model baru wajib memiliki:
  - nama model;
  - nama produk.
- [ ] Terapkan normalisasi dan validasi duplikasi yang sama dengan halaman
  pengaturan model produk.
- [ ] Pertahankan permission yang berlaku saat ini: admin dan QRCC dapat
  menambahkan model.

### 2.2 Perubahan pada combo model

- [ ] Tambahkan aksi `Tambah model baru` pada combo model di
  `app/pages/dashboard/pengajuan/create.vue`.
- [ ] Aksi tersebut membuka modal kecil tanpa meninggalkan form pengajuan.
- [ ] Modal minimal berisi:
  - input nama model;
  - input/nama produk;
  - tombol simpan dan batal.
- [ ] Nilai `origin` mengikuti default yang sudah dipakai service saat ini,
  kecuali bisnis memerlukan pilihan origin pada form.
- [ ] Jangan mengubah combo menjadi input bebas; item pengajuan tetap hanya
  boleh memilih model yang berhasil tersimpan di master.

### 2.3 Flow setelah model dibuat

- [ ] Submit modal ke `POST /api/model-produk`.
- [ ] Tampilkan error duplicate atau validasi tanpa menutup modal.
- [ ] Setelah berhasil:
  - refresh daftar model verified;
  - tambahkan model baru ke combo;
  - otomatis pilih model baru pada item yang sedang diedit;
  - isi nama produk dari response master;
  - tutup modal dan tampilkan toast sukses.
- [ ] Jika refresh gagal setelah create berhasil, tampilkan error yang jelas dan
  lakukan fetch ulang sebelum user melanjutkan submit pengajuan.
- [ ] Cegah submit ganda saat proses create model berjalan.

### 2.4 Dukungan pada data update

- [ ] Inventarisasi semua form yang memiliki combo model.
- [ ] Terapkan aksi `Tambah model baru` pada form item yang dapat mengubah model.
- [ ] Saat ini halaman daftar pengajuan hanya mengedit data utama dan belum
  memiliki editor model item. Jangan membuat workflow edit item baru hanya
  untuk fase ini.
- [ ] Jika editor model item ditambahkan kemudian, gunakan flow modal dan
  refresh master yang sama agar perilakunya konsisten.

### 2.5 Acceptance criteria

- [ ] Admin/QRCC dapat menambahkan model dari form pengajuan.
- [ ] Model baru langsung muncul dan dapat dipilih tanpa reload penuh halaman.
- [ ] Produk otomatis mengikuti model yang dipilih.
- [ ] Model duplikat ditolak dengan pesan yang jelas.
- [ ] Model yang belum berhasil dibuat tidak dapat dikirim sebagai item
  pengajuan.
- [ ] Model baru tetap dapat dipakai oleh validasi create pengajuan dan antrean
  cetak karena tersimpan sebagai master `verified`.

## 3. Urutan Implementasi

- [ ] Sepakati aturan mapping data lama `bagian_cabang`.
- [ ] Tambahkan migration dan update schema backend.
- [ ] Update service, DTO, filter, queue, dan util print.
- [ ] Update form create, dialog edit, tabel, dan detail.
- [ ] Tambahkan modal create model pada combo model.
- [ ] Tambahkan test service dan migration.
- [ ] Jalankan verifikasi:
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
