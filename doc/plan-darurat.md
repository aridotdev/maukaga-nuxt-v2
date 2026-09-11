# Plan Darurat: Cetak Kartu Garansi dari File HTML Statis

## Tujuan

Menyediakan satu file HTML mandiri yang dapat dibuka dengan double-click dari PC kantor, tanpa:

- Nuxt dev server atau localhost
- database lokal
- Google Apps Script
- login atau autentikasi
- dependency dari CDN atau internet

File hanya dipakai untuk memasukkan data kartu, menyimpan draft sementara di browser, lalu
mencetaknya.

## Alur Penggunaan

1. Buka file `print-kartu-darurat.html` langsung dari File Explorer.
2. Isi minimal satu baris data:
   - Model
   - Nama Produk
   - Nomor Seri
   - Jenis Kartu: `Local` atau `Import`
3. Tambahkan atau hapus baris bila jumlah kartu lebih dari satu.
4. Tekan tombol `Cetak`.
5. Browser menampilkan dialog konfirmasi JavaScript.
6. Jika dikonfirmasi, browser menjalankan `window.print()`.
7. Print preview hanya menampilkan halaman kartu, dengan satu item per halaman A4.
8. Setelah dialog print ditutup, halaman kembali ke tampilan form.
9. Data form tersimpan otomatis sebagai draft sementara di browser.
10. Tekan `Buat Pengajuan Baru` jika ingin menghapus draft lama dan mulai dari awal.

Data tidak dikirim ke server dan tidak masuk database. Data disimpan di `localStorage` browser pada
PC tersebut, sehingga dapat dipulihkan setelah file ditutup atau browser dibuka kembali.

## Bentuk File

Buat satu file root:

```text
print-kartu-darurat.html
```

File berisi seluruh hal berikut secara inline:

- HTML form
- CSS tampilan form
- CSS print A4
- JavaScript untuk menambah dan menghapus item
- JavaScript validasi
- JavaScript untuk membuat halaman print
- Konfigurasi layout Local dan Import

Tidak ada `import`, `fetch`, atau pemanggilan API. `localStorage` digunakan hanya untuk draft
sementara.

## Struktur Form

Tampilan utama cukup berupa tabel sederhana:

| Model | Nama Produk | Nomor Seri | Jenis Kartu | Aksi |
| --- | --- | --- | --- | --- |
| input text | input text | input text | select Local/Import | hapus |

Kontrol yang diperlukan:

- `Tambah Item`
- `Cetak`
- `Buat Pengajuan Baru`

### Penyimpanan Draft Sementara

Gunakan satu key khusus dengan versi schema:

```js
const STORAGE_KEY = 'maukaga-print-kartu-darurat-v1'
```

Struktur data yang disimpan:

```js
{
  version: 1,
  items: [
    {
      model: '...',
      namaProduk: '...',
      nomorSeri: '...',
      jenisKartu: 'local'
    }
  ],
  savedAt: '2026-09-10T10:00:00.000Z'
}
```

Perilaku penyimpanan:

- Simpan otomatis ketika input, pilihan jenis kartu, tambah baris, atau hapus baris berubah.
- Pulihkan data dari `localStorage` ketika file dibuka.
- Jika data tidak ada, rusak, atau versinya tidak didukung, tampilkan satu baris kosong.
- Tampilkan indikator sederhana seperti `Draft tersimpan` dan waktu penyimpanan terakhir.
- Jangan membuat salinan data lain khusus untuk print; data form tetap menjadi satu-satunya sumber.

Perilaku tombol `Buat Pengajuan Baru`:

1. Jika form masih kosong, siapkan satu baris kosong.
2. Jika ada data, tampilkan konfirmasi:
   `Hapus data draft saat ini dan buat pengajuan baru?`
3. Jika dikonfirmasi, hapus key dari `localStorage`, hapus seluruh baris, lalu buat satu baris
   kosong.
4. Jika dibatalkan, pertahankan data yang sedang diisi.

Menekan `Cetak` tidak menghapus draft. Draft tetap tersedia untuk mencetak ulang. Pengajuan baru
hanya dimulai melalui tombol `Buat Pengajuan Baru`.

Catatan pengoperasian: dukungan `localStorage` untuk halaman yang dibuka melalui `file://` dapat
bergantung pada browser. Targetkan Chrome atau Edge yang dipakai kantor, dan selalu buka file yang
sama dari lokasi yang sama agar draft dapat ditemukan kembali. Uji perilaku ini pada PC kantor
sebelum digunakan sebagai prosedur tetap.

Aturan validasi:

- Minimal satu item.
- Semua kolom wajib diisi.
- Jenis kartu wajib dipilih.
- Model dan nomor seri yang sama tidak boleh muncul dua kali dalam satu batch.
- Baris kosong tidak ikut dicetak dan sebaiknya dianggap invalid agar kesalahan terlihat jelas.

## Layout Print

CSS print diambil dari pola `app/components/print/KartuGaransi.vue`:

- Ukuran halaman: `210mm x 297mm`
- Orientasi: A4 portrait
- Margin halaman: `0`
- Satu item menjadi satu halaman
- Produk, model, dan nomor seri ditempatkan menggunakan posisi absolut dalam satuan milimeter
- Form dan tombol disembunyikan ketika mode print aktif

Setiap baris menentukan kelas halaman:

```text
jenisKartu = Local  -> halaman dengan kelas .local
jenisKartu = Import -> halaman dengan kelas .import
```

Posisi dasar yang perlu dipertahankan:

- Nama produk: area sekitar `top: 218.3mm`
- Model: area sekitar `top: 236.3mm`
- Nomor seri: area sekitar `top: 236.3mm`

Nilai ini harus diuji kembali menggunakan printer dan blanko kartu yang dipakai di kantor.

## Konfigurasi Layout

File statis tidak dapat membaca layout aktif dari endpoint `/api/admin/print-layouts` atau database.
Agar mudah dikalibrasi, letakkan seluruh pengaturan di satu blok JavaScript paling atas dengan
penanda yang jelas. Logika form dan logika print tidak boleh menyimpan angka posisi lain di tempat
terpisah.

```js
// =========================================
// UBAH CONFIG PRINT HANYA DI BLOK INI
// Semua posisi menggunakan satuan milimeter
// =========================================
const PRINT_CONFIG = {
  local: {
    label: 'Local',
    baseX: 5,
    baseY: -5,
    detailBaseY: -2,
    offsetX: 0,
    offsetY: 0,
    product: {
      top: 218.3,
      left: 0,
      width: 124.6,
      height: 6.4,
      fontSize: 14
    },
    model: {
      top: 236.3,
      left: 0,
      width: 61.1,
      height: 5.3,
      fontSize: 10
    },
    serial: {
      top: 236.3,
      left: 73.3,
      width: 51.3,
      height: 5.3,
      fontSize: 10
    },
    gapProductModel: 0,
    gapModelSerial: 0
  },
  import: {
    label: 'Import',
    baseX: 0,
    baseY: 3,
    detailBaseY: 0,
    offsetX: 0,
    offsetY: 0,
    product: {
      top: 218.3,
      left: 0,
      width: 124.6,
      height: 6.4,
      fontSize: 14
    },
    model: {
      top: 236.3,
      left: 0,
      width: 61.1,
      height: 5.3,
      fontSize: 10
    },
    serial: {
      top: 236.3,
      left: 73.3,
      width: 51.3,
      height: 5.3,
      fontSize: 10
    },
    gapProductModel: 0,
    gapModelSerial: 0
  }
}
```

Render print harus membaca object ini secara dinamis, misalnya dengan membuat style inline dari
`PRINT_CONFIG[jenisKartu]`. Dengan begitu, nilai posisi tidak perlu diduplikasi dalam banyak
selector CSS.

### Cara Kalibrasi Layout

Operator cukup mengubah angka pada `PRINT_CONFIG`, membuka ulang file, lalu memeriksa print
preview. Tidak perlu mengubah HTML form atau fungsi penyimpanan.

| Properti | Fungsi |
| --- | --- |
| `baseX` | Menggeser semua teks ke kiri atau kanan |
| `baseY` | Menggeser semua teks ke atas atau bawah |
| `detailBaseY` | Koreksi vertikal khusus field produk, model, dan nomor seri |
| `offsetX` | Fine tuning horizontal layout |
| `offsetY` | Fine tuning vertikal layout |
| `product.top` | Posisi vertikal nama produk |
| `model.top` | Posisi vertikal model |
| `serial.top` | Posisi vertikal nomor seri |
| `*.left` | Posisi horizontal field |
| `*.width` | Lebar area teks |
| `*.fontSize` | Ukuran teks dalam point |
| `gapProductModel` | Jarak tambahan produk ke model |
| `gapModelSerial` | Jarak tambahan model ke nomor seri |

Urutan kalibrasi:

1. Jika semua teks bergeser bersama-sama, ubah `baseX` atau `baseY`.
2. Jika hanya satu field bergeser, ubah nilai `top` atau `left` field tersebut.
3. Jika teks terpotong, tambah `width` atau kecilkan `fontSize`.
4. Ubah sedikit demi sedikit, misalnya `0.5` atau `1` mm setiap percobaan.
5. Kalibrasi `local` dan `import` secara terpisah.

Untuk versi pertama, isi `PRINT_CONFIG` dengan geometri dari `app/components/print/KartuGaransi.vue`.
Jika layout custom lama masih dipakai, salin nilai custom tersebut satu kali ke blok ini. File
statis tidak dapat mengikuti perubahan layout database secara otomatis.

Pilihan tambahan jika kalibrasi sering dilakukan: sediakan mode `Tampilkan Garis Bantu` yang hanya
aktif di layar dan tidak ikut tercetak. Mode ini dapat menampilkan batas area field, tetapi tetap
opsional agar versi pertama tetap minimal.

## Mekanisme Cetak

JavaScript akan melakukan langkah berikut:

1. Validasi seluruh baris.
2. Menampilkan `window.confirm()` dengan jumlah kartu yang akan dicetak.
3. Jika pengguna memilih OK:
   - salin data form ke area print;
   - tambahkan class mode print ke `body`;
   - tunggu render selesai;
   - panggil `window.print()`.
4. Gunakan event `afterprint` untuk membersihkan area print dan menghapus class mode print.

Tidak perlu membuka jendela baru. Dialog print native browser sudah cukup dan lebih sedikit kodenya. Dengan cara ini file tetap dapat dijalankan langsung melalui `file://`.

## Hal yang Tidak Dibawa dari Aplikasi Lama

Versi darurat tidak mencakup:

- pembuatan ID pengajuan
- penyimpanan draft ke server atau database
- final submit
- upload PDF atau foto
- status pengajuan
- pencarian data
- antrean cetak
- penandaan `Printed`
- layout editor
- sinkronisasi data
- audit log
- autentikasi admin

Fokusnya hanya mengurangi pengetikan ulang saat mencetak kartu.

## Tahapan Implementasi

1. Salin geometri dan aturan print dari `KartuGaransi.vue`.
2. Buat `print-kartu-darurat.html` dengan HTML, CSS, dan JavaScript inline.
3. Tambahkan `STORAGE_KEY`, fungsi save, load, dan clear `localStorage`.
4. Pulihkan draft saat file dibuka, atau buat satu baris kosong jika belum ada draft.
5. Buat satu baris form default saat tidak ada data.
6. Tambahkan fungsi tambah/hapus baris.
7. Tambahkan validasi field dan duplikasi model + nomor seri.
8. Tambahkan pilihan `Local` dan `Import` pada setiap baris.
9. Tambahkan tombol `Buat Pengajuan Baru` dengan konfirmasi dan penghapusan draft.
10. Render data ke halaman print berdasarkan jenis kartu.
11. Tambahkan dialog konfirmasi sebelum `window.print()`.
12. Uji print preview pada browser kantor.
13. Kalibrasi `PRINT_CONFIG.local` dan `PRINT_CONFIG.import` jika hasil cetak bergeser.

## Pengujian Minimum

Uji manual berikut wajib dilakukan:

- Satu kartu Local.
- Satu kartu Import.
- Campuran Local dan Import dalam satu batch.
- Beberapa kartu dalam satu batch.
- Validasi ketika kolom kosong.
- Validasi ketika jenis kartu belum dipilih.
- Pembatalan dialog konfirmasi.
- Draft tetap ada setelah file ditutup dan dibuka kembali.
- Tombol `Buat Pengajuan Baru` menghapus draft setelah dikonfirmasi.
- Pembatalan `Buat Pengajuan Baru` tidak menghapus data.
- Print preview dengan margin `None`, skala `100%`, dan ukuran kertas A4.
- Menutup dialog print lalu memastikan form tetap dapat digunakan.
- Membuka file tanpa koneksi internet.

## Kesimpulan

Ini adalah perubahan kecil dan cocok untuk kondisi darurat. Dengan mempertahankan geometri print yang sudah ada dan mengganti database menjadi draft sementara di `localStorage`, kebutuhan dapat dipenuhi dengan satu file HTML mandiri tanpa mengubah aplikasi utama.

Bagian yang paling berisiko bukan kode form, melainkan dukungan `localStorage` pada halaman `file://`
di browser kantor serta kalibrasi posisi teks terhadap printer dan blanko kartu yang digunakan.
