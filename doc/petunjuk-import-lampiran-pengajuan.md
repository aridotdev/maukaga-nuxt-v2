# Petunjuk Pemindahan Lampiran Pengajuan Lama

Dokumen ini menjelaskan persiapan dan prosedur pemindahan file lampiran lama
ke storage aplikasi MAUKAGA Nuxt v2 setelah data pengajuan dan item berhasil
diimpor ke SQLite.

## Konsep Penyimpanan

File lampiran tidak disimpan sebagai binary di SQLite. Database hanya menyimpan
metadata file pada tabel `pengajuan_files`, sedangkan file fisiknya disimpan di
folder storage aplikasi.

Struktur penyimpanan yang digunakan aplikasi:

```text
storage/pengajuan/<id-pengajuan>/<nama-file-internal>
```

Contoh:

```text
storage/pengajuan/
  KG-20260603-0001/
    hardcopy-1-<uuid>.pdf
    evidence-1-<uuid>.jpg
  KG-20260603-0002/
    hardcopy-1-<uuid>.pdf
```

Folder storage dapat diubah melalui environment variable berikut:

```text
NUXT_PENGAJUAN_FILE_DIRECTORY
```

Jika variable tersebut tidak diisi, aplikasi menggunakan:

```text
storage/pengajuan
```

## Persiapan Folder Lampiran Lama

Format folder yang paling aman adalah satu folder untuk setiap `id_pengajuan`.
Nama folder harus sama persis dengan ID pada file CSV pengajuan.

Contoh:

```text
.data/lampiran-lama/
  KG-20260603-0001/
    formulir.pdf
    foto-unit-1.jpg
  KG-20260603-0002/
    formulir.pdf
  KG-20260603-0003/
    formulir.pdf
    bukti-1.jpg
```

Hindari menggunakan nama pemohon, nama cabang, atau nomor seri sebagai nama
folder utama karena nilai tersebut dapat berubah atau tidak unik. Gunakan
`id_pengajuan` sebagai kunci pencocokan.

## Jenis Lampiran

Aplikasi mengenal empat jenis lampiran:

| Nilai `kind` | Kegunaan |
|---|---|
| `hardcopy` | Formulir atau dokumen utama pengajuan |
| `evidence` | Foto, bukti unit, atau dokumen pendukung |
| `attachment` | Lampiran umum yang tidak termasuk dua kategori di atas |
| `signed_statement` | Surat pernyataan bertanda tangan untuk proses override |

Untuk data lama, gunakan aturan berikut jika kategori lampiran sudah jelas:

- formulir atau dokumen utama: `hardcopy`;
- foto atau bukti pendukung: `evidence`;
- lampiran lain: `attachment`;
- jangan gunakan `signed_statement` kecuali file tersebut memang surat
  pernyataan yang digunakan untuk override.

Jika kategori file tidak dapat ditentukan secara otomatis, lebih aman memakai
manifest daripada menebak berdasarkan nama file.

## Manifest Lampiran

Manifest adalah CSV pemetaan tambahan antara file lama, jenis lampiran, dan
item pengajuan. Gunakan delimiter titik koma (`;`).

Header manifest:

```text
id_pengajuan;nama_file;kind;no_item
```

Contoh:

```csv
id_pengajuan;nama_file;kind;no_item
KG-20260603-0001;formulir.pdf;hardcopy;
KG-20260603-0001;foto-unit-1.jpg;evidence;1
KG-20260603-0003;bukti-1.jpg;evidence;1
```

Kolom `no_item` boleh kosong jika file hanya terkait dengan pengajuan secara
umum. Jika diisi, file harus dikaitkan dengan item berdasarkan kombinasi:

```text
id_pengajuan + no_item
```

Manifest sangat disarankan jika satu folder berisi beberapa jenis file atau
satu pengajuan memiliki lebih dari satu item.

## Format File yang Didukung

Endpoint file aplikasi saat ini melayani:

```text
application/pdf
image/jpeg
```

Dengan demikian, format yang aman untuk dipindahkan adalah:

- `.pdf`;
- `.jpg`;
- `.jpeg`.

File `.png`, `.webp`, `.doc`, `.docx`, atau format lain jangan diubah ekstensi
secara palsu. File tersebut harus dikonversi dengan benar terlebih dahulu atau
dilaporkan sebagai file yang belum didukung.

## Prosedur Pemindahan

Pemindahan lampiran dilakukan setelah import pengajuan dan item selesai serta
sudah diverifikasi.

### 1. Backup

Buat backup database SQLite dan salinan folder lampiran lama. Jangan menghapus
file sumber setelah proses pertama.

### 2. Verifikasi Data Pengajuan

Pastikan setiap `id_pengajuan` yang memiliki folder lampiran sudah ada pada
tabel `pengajuan`.

Folder yang tidak memiliki pasangan di database disebut orphan dan harus
diperiksa secara manual.

### 3. Preview

Jalankan mode preview dari script lampiran setelah script tersebut tersedia:

```bash
pnpm db:import-pengajuan-files -- ".data/lampiran-lama"
```

Jika menggunakan manifest:

```bash
pnpm db:import-pengajuan-files -- ".data/lampiran-lama" ".data/lampiran.csv"
```

Mode preview tidak boleh menyalin file dan tidak boleh mengubah database.

Periksa hasil berikut:

- jumlah folder pengajuan;
- jumlah file valid;
- file yang tidak didukung;
- folder orphan;
- file yang tidak ditemukan di manifest;
- item yang tidak ditemukan;
- file duplikat berdasarkan SHA-256;
- file yang sudah tercatat di database.

### 4. Apply

Setelah preview benar dan backup tersedia, jalankan:

```bash
pnpm db:import-pengajuan-files -- ".data/lampiran-lama" --apply
```

Atau dengan manifest:

```bash
pnpm db:import-pengajuan-files -- ".data/lampiran-lama" ".data/lampiran.csv" --apply
```

Proses apply harus menyalin file terlebih dahulu, kemudian menyimpan metadata
ke database. Jika penyimpanan metadata gagal, file hasil salinan harus
dibersihkan agar tidak meninggalkan file yatim di storage.

## Metadata yang Disimpan

Setiap file yang berhasil dipindahkan memiliki metadata berikut:

| Metadata | Keterangan |
|---|---|
| `id` | UUID baru untuk record file |
| `pengajuan_id` | ID internal SQLite pengajuan |
| `item_id` | ID internal item atau `NULL` |
| `kind` | Jenis lampiran |
| `sequence` | Urutan file dalam jenis dan target yang sama |
| `original_name` | Nama file asli |
| `storage_key` | Lokasi relatif file di storage |
| `mime_type` | MIME type file |
| `size_bytes` | Ukuran file dalam byte |
| `sha256` | Hash isi file |
| `uploaded_by` | `NULL` untuk data historis |

Nama file fisik tidak harus sama dengan nama lama. Nama asli disimpan pada
`original_name`, sementara `storage_key` menggunakan nama internal yang aman
dan unik.

## Aturan Keamanan dan Integritas

- Gunakan operasi copy, bukan move, pada percobaan pertama.
- Jangan menghapus folder sumber secara otomatis.
- Jangan menimpa `storage_key` yang sudah ada.
- Laporkan file dengan hash yang sama sebagai duplikat.
- Pastikan path file tetap berada di dalam folder storage aplikasi.
- Jangan membuat record database jika file fisiknya gagal disalin.
- Jangan membuat file fisik jika transaksi metadata gagal dan file tersebut
  tidak dapat dibersihkan.
- Jangan mengubah ekstensi file tanpa melakukan konversi format yang benar.
- Jangan menjalankan import saat aplikasi sedang menulis banyak file baru ke
  database yang sama.

## Pemeriksaan Setelah Apply

Setelah proses selesai:

1. Buka beberapa detail pengajuan secara acak.
2. Pastikan daftar lampiran tampil.
3. Buka atau download file PDF dan JPG.
4. Pastikan file yang terkait item menampilkan nomor item yang benar.
5. Cocokkan jumlah file di laporan import dengan jumlah record pada database.
6. Periksa folder `storage/pengajuan` untuk memastikan tidak ada file yatim.
7. Simpan laporan hasil import bersama backup.

## Penanganan Masalah Umum

### Folder Tidak Ditemukan di Database

Jangan langsung membuat pengajuan baru. Periksa kembali penulisan folder dan
`id_pengajuan` pada CSV. Jika data memang belum diimpor, selesaikan import
pengajuan terlebih dahulu.

### Item Tidak Ditemukan

Periksa nilai `no_item` di manifest. Nomor item harus sama dengan `no_item` pada
file item CSV dan tidak boleh menggunakan ID internal SQLite.

### File Tidak Didukung

Konversi file ke PDF atau JPEG menggunakan alat yang benar, lalu masukkan file
hasil konversi sebagai file baru. Simpan file sumber lama sebagai arsip.

### File Duplikat

Bandingkan nama, lokasi sumber, dan hash SHA-256. Jika isinya sama, biasanya
cukup satu record file. Jika nama atau konteksnya berbeda, dokumentasikan
keputusan sebelum menyimpan keduanya.

## Urutan Migrasi Lengkap

Urutan yang direkomendasikan:

1. Backup database dan data lampiran lama.
2. Jalankan preview import pengajuan dan item.
3. Jalankan apply import pengajuan dan item.
4. Verifikasi data pengajuan, item, dan master model.
5. Siapkan folder lampiran berdasarkan `id_pengajuan`.
6. Siapkan manifest jika kategorisasi tidak dapat ditebak.
7. Jalankan preview import lampiran.
8. Perbaiki semua masalah sampai tidak ada error kritis.
9. Jalankan apply import lampiran.
10. Verifikasi akses file dari aplikasi.
11. Simpan laporan migrasi dan backup sumber.

Dokumen ini menjelaskan prosedur dan format data lampiran. Script import
lampiran perlu tersedia sebelum perintah `db:import-pengajuan-files` dapat
dijalankan.
