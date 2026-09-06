# Implementation Plan - Cetak Ulang Kartu Garansi

Dokumen ini menjelaskan rencana implementasi yang sederhana untuk mendukung cetak ulang kartu garansi, baik untuk 1 kartu maupun banyak kartu sekaligus, pada sumber data `Active` dan `Local`.

## Tujuan

- Memakai struktur sidebar yang sudah ada tanpa menambah menu baru.
- Menjadikan `Cetak Kartu Garansi` sebagai pusat kerja untuk print dan reprint.
- Mendukung data dari source `Active` maupun `Local` lewat halaman yang sama.
- Mendukung alur cetak tunggal dan cetak massal dalam satu halaman yang sama.
- Menjaga UX tetap ringan, cepat dipahami, dan tidak over-engineered.

## Kondisi Saat Ini

Sidebar dashboard saat ini sudah memuat:

- `Home`
- `Pengajuan`
- `Cetak Kartu Garansi`
- `Cetak Label Pengiriman`
- `Setting`
  - `Product Name`
  - `Layout Cetak`
  - `User Management`
  - `Sinkronisasi Data`

Kesimpulan awal:

- Tidak perlu menambah menu baru untuk cetak ulang.
- Aksi cetak ulang paling tepat tetap berada di `Cetak Kartu Garansi`.
- Halaman ini harus membaca source yang sedang aktif, lalu menampilkan data print dari source tersebut.

## Rekomendasi UX

### Penempatan Menu

- Biarkan sidebar tetap seperti sekarang.
- Jadikan `Cetak Kartu Garansi` sebagai halaman utama untuk:
  - cari kartu
  - pilih satu kartu
  - pilih banyak kartu
  - cetak ulang

### Struktur Halaman

1. Area pencarian dan filter di bagian atas.
2. Tabel daftar kartu di tengah.
3. Action bar kontekstual saat ada item dipilih.
4. Preview singkat sebelum print jika memang dibutuhkan.
5. Source `Active` dan `Local` tetap mengikuti konteks dashboard yang sedang dibuka.

### Flow Cetak

#### Single Print

- User cari data kartu.
- User klik aksi `Cetak` di baris kartu.
- Sistem langsung menyiapkan preview atau dialog print.
- Source data mengikuti konteks halaman saat itu, baik `Active` maupun `Local`.

#### Bulk Print

- User pilih banyak baris dengan checkbox.
- Action bar tampil dengan tombol `Cetak Terpilih`.
- Sistem menyiapkan semua kartu dalam satu batch print.
- Batch ini tetap harus bisa bekerja di source `Active` dan `Local`.

## Prinsip Desain

- Satu halaman untuk dua mode kerja.
- Aksi per baris untuk kebutuhan cepat.
- Multi-select untuk kebutuhan volume.
- Tidak membuat wizard panjang.
- Tidak memecah flow ke banyak halaman kalau tidak perlu.

## Rencana Implementasi

### Tahap 1 - Validasi Struktur

- Audit halaman `Cetak Kartu Garansi` yang sudah ada.
- Pastikan data yang dipakai sudah cukup untuk pencarian dan pemilihan kartu.
- Pastikan halaman bisa membaca source dashboard dan menyesuaikan data `Active` atau `Local`.
- Identifikasi field minimum:
  - ID pengajuan
  - nama
  - nomor seri
  - model / produk
  - status cetak

### Tahap 2 - Susun Interaksi Utama

- Tambahkan search input yang cepat dan jelas.
- Tambahkan checkbox per baris untuk multi-select.
- Tambahkan tombol aksi per baris untuk single print.
- Tambahkan action bar untuk bulk print saat ada item terpilih.
- Pastikan action tetap konsisten saat source berubah antara `Active` dan `Local`.

### Tahap 3 - Atur Alur Print

- Single print:
  - klik aksi di baris
  - preview atau dialog print
  - cetak
- Bulk print:
  - pilih beberapa baris
  - cek ringkasan jumlah item
  - cetak batch
- Validasi kembali bahwa alur di atas berjalan untuk kedua sumber data.

### Tahap 4 - Feedback Pengguna

- Tampilkan jumlah item terpilih.
- Tampilkan status print berhasil atau gagal.
- Reset pilihan setelah proses selesai bila perlu.

## Batasan

- Tidak membuat menu baru di sidebar.
- Tidak membuat halaman wizard khusus untuk cetak ulang.
- Tidak memecah single print dan bulk print ke flow terpisah yang berbeda jauh.

## Acceptance Criteria

- User bisa menemukan fitur cetak ulang dari menu `Cetak Kartu Garansi`.
- User bisa mencetak 1 kartu dengan cepat.
- User bisa memilih banyak kartu dan mencetak sekaligus.
- User bisa menjalankan flow yang sama untuk data `Active` dan `Local`.
- UI tetap sederhana dan tidak membingungkan.
- Tidak ada perubahan sidebar yang tidak perlu.

## Prioritas Implementasi

1. Rapikan halaman `Cetak Kartu Garansi`.
2. Pastikan single print tetap mudah.
3. Tambahkan bulk selection dan bulk action.
4. Tambahkan feedback hasil print.
