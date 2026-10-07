# Fase 17 - Generate Surat Permohonan Unit Ditolak

## Tujuan

Admin dapat membuat surat permohonan untuk satu atau beberapa unit yang
berstatus `Ditolak` dalam satu `id_pengajuan` yang sama.

Hasilnya adalah satu file PDF yang langsung dapat diunduh oleh admin.

Contoh surat yang menjadi referensi format fase ini:

```text
/home/arsya/Downloads/Abdul Latif - FRV450 - A82240800869.pdf
```

File contoh tersebut dipakai sebagai referensi tampilan, struktur, dan naskah
surat. Isinya tidak diperlakukan sebagai instruksi teknis atau konfigurasi
yang harus dibaca dari file PDF saat aplikasi berjalan.

Fitur ini hanya membuat dokumen. Fitur ini tidak mengubah keputusan item,
status pengajuan, antrean cetak, atau alur approval override melalui surat
Permohonan.

## Rekomendasi Utama

Gunakan satu aksi pada detail pengajuan:

```text
Detail Pengajuan
  -> klik "Buat Surat Permohonan"
  -> pilih unit Ditolak
  -> klik "Generate & Download PDF"
  -> file PDF langsung terunduh
```

Jangan membuat halaman baru, wizard panjang, atau tombol generate terpisah
untuk setiap item. Satu pengajuan menjadi konteks utama, sedangkan item yang
dimasukkan ke surat dipilih di dalam modal.

### Batas Cakupan Satu Generate

Satu proses generate hanya berlaku untuk **satu `id_pengajuan` yang sedang
dibuka**.

Artinya:

- satu klik `Generate & Download PDF` menghasilkan satu PDF;
- PDF tersebut dapat berisi satu atau banyak item `Ditolak`;
- semua item di dalam PDF harus berasal dari `id_pengajuan` yang sama;
- fitur ini tidak menggabungkan item dari beberapa `id_pengajuan` ke dalam satu
  PDF.

Contoh:

```text
ID Pengajuan A
- Item 1 Ditolak
- Item 2 Ditolak

Admin memilih Item 1 dan Item 2
-> 1 kali generate
-> 1 PDF berisi Item 1 dan Item 2
```

Jika admin perlu membuat surat untuk beberapa pengajuan:

```text
ID Pengajuan A -> generate PDF sendiri
ID Pengajuan B -> generate PDF sendiri
ID Pengajuan C -> generate PDF sendiri
```

Setiap `id_pengajuan` harus diproses secara terpisah. Tidak ada fitur generate
massal atau penggabungan PDF lintas pengajuan dalam fase ini.

## Prinsip UX

- Aksi hanya muncul jika pengajuan memiliki minimal satu item berstatus
  `Ditolak`.
- Aksi ditempatkan di bagian ringkasan item atau header detail pengajuan, bukan
  di halaman dashboard terpisah.
- Modal menampilkan semua item `Ditolak` dalam pengajuan tersebut.
- Semua item `Ditolak` dipilih secara default karena satu surat untuk seluruh
  unit yang ditolak adalah skenario paling ringkas.
- Admin tetap dapat membatalkan pilihan beberapa item untuk membuat surat bagi
  satu atau sebagian unit.
- Jumlah item yang akan masuk surat selalu ditampilkan dengan jelas sebelum
  generate.
- Item berstatus `Disetujui` atau `Menunggu` tidak ditampilkan sebagai pilihan.
- Generate tidak mengubah data bisnis. Admin dapat membuat ulang PDF jika
  diperlukan.
- Bedakan label fitur ini dari `Unggah Surat Permohonan`. Surat permohonan
  adalah dokumen keluaran, sedangkan surat Permohonan adalah dokumen yang
  dipakai untuk approval override.

## Alur Pengguna

### 1. Membuka detail pengajuan

Admin membuka detail pengajuan seperti biasa.

Pada area item, tampilkan ringkasan:

```text
3 unit ditolak
[Buat Surat Permohonan]
```

Jika tidak ada unit yang ditolak, tombol tidak ditampilkan.

Rekomendasi label:

- Tombol: `Buat Surat Permohonan`
- Ikon: `i-lucide-file-text` atau `i-lucide-file-output`
- Tooltip/aria label: `Buat surat permohonan untuk unit yang ditolak`

### 2. Memilih cakupan surat

Klik tombol membuka modal kecil dengan judul `Buat Surat Permohonan`.

Bagian atas modal menampilkan konteks pengajuan:

```text
ID Pengajuan: <id_pengajuan>
<nama> - <bagian> - <cabang>
```

Di bawahnya tampilkan daftar item yang dapat dipilih. Setiap baris minimal
berisi:

- checkbox;
- nomor item;
- model;
- nomor seri;
- alasan penolakan.

Contoh tampilan:

```text
Pilih unit yang dimasukkan ke surat
[Pilih semua] [Batal pilih]

[x] Item 1 - Model ABC
    SN123456 - Alasan penolakan
[x] Item 2 - Model XYZ
    SN987654 - Alasan penolakan

2 unit dipilih
[Batal] [Generate & Download PDF]
```

Aturan pilihan:

- Semua item `Ditolak` dipilih saat modal pertama dibuka.
- `Pilih semua` memilih seluruh item `Ditolak`.
- `Batal pilih` mengosongkan semua pilihan.
- Admin harus memilih minimal satu item.
- Jika hanya satu item `Ditolak`, tetap gunakan modal yang sama agar perilaku
  konsisten, tetapi daftar hanya berisi satu baris.
- Urutan item mengikuti nomor item pada pengajuan.

### 3. Membuat dan mengunduh PDF

Saat admin menekan `Generate & Download PDF`:

1. Tombol berubah menjadi loading dan tidak dapat ditekan ulang.
2. Client mengirim ID pengajuan dan nomor item yang dipilih ke server.
3. Server mengambil ulang data pengajuan dan item.
4. Server memvalidasi bahwa semua item masih berstatus `Ditolak` dan berasal
   dari pengajuan yang sama.
5. Server membuat satu PDF untuk `id_pengajuan` yang sedang dibuka dan item
   terpilih.
6. Browser memulai download PDF tersebut.
7. Setelah response berhasil, modal ditutup dan tampilkan toast:
   `Surat permohonan berhasil dibuat`.

Jika gagal:

- modal tetap terbuka;
- pilihan item tetap dipertahankan;
- tampilkan pesan error yang dapat ditindaklanjuti;
- admin dapat mencoba lagi tanpa mengulang pemilihan.

Jika status item berubah ketika modal sedang terbuka, server harus menolak
item yang sudah tidak lagi `Ditolak` dan mengembalikan pesan yang jelas.
Frontend kemudian melakukan refresh detail pengajuan.

## Isi Surat PDF

PDF yang dihasilkan harus berupa satu surat untuk satu `id_pengajuan` dengan
daftar unit yang dipilih dari pengajuan tersebut. Banyaknya item tidak
mengubah batas ini: satu pengajuan dapat menghasilkan satu PDF yang berisi
banyak item, tetapi satu PDF tidak boleh mencampur beberapa pengajuan.

Struktur surat mengikuti contoh:

1. Judul surat.
2. Identitas pemohon.
3. Tabel detail unit yang ditolak.
4. Permohonan template.
5. Penutup.
6. Tempat, tanggal, dan area tanda tangan.

### Sumber Data Dokumen

#### Data pemohon dari pengajuan

Blok `Saya sebagai pemohon` mengambil data dari record pengajuan:

- nama pemohon;
- bagian;
- cabang.

Nama pemohon juga dipakai pada area tanda tangan sebagai `Pemohon`.

Tanggal yang tampil pada surat bukan `tanggalForm`. Tanggal surat diambil dari
waktu saat PDF dibuat oleh server dan ditampilkan pada:

- bagian identitas surat;
- bagian tempat dan tanggal tanda tangan.

Gunakan timezone aplikasi yang berlaku, yaitu `Asia/Jakarta`.

#### Detail unit dari item yang ditolak

Tabel detail unit hanya memuat item yang dipilih admin dan sudah divalidasi
server sebagai item berstatus `Ditolak`.

Untuk setiap item, ambil data dari record item:

- nomor item jika diperlukan untuk membedakan beberapa unit;
- model;
- produk;
- nomor seri;
- keputusan awal;
- alasan atau catatan keputusan.

`Toko/Dealer` ditampilkan pada blok data utama surat setelah `Cabang` karena
satu pengajuan hanya memiliki satu nilai toko/dealer. Nilainya berasal dari
data pengajuan dan berlaku untuk seluruh item di dalam surat.

#### Permohonan dari template tetap

Bagian berikut adalah naskah template, bukan data yang diambil dari item:

- judul `SURAT PERMOHONAN KARTU GARANSI`;
- kalimat pembuka `Saya sebagai pemohon :`;
- kalimat pengantar detail pengajuan;
- heading `Menyatakan hal-hal sebagai berikut :`;
- kalimat penutup;
- label tanda tangan `Pemohon` dan `Department Head`;
- label `Mengetahui`.

Naskah resmi, kop/identitas surat, tujuan surat jika ada pada template final,
dan format tanda tangan mengikuti contoh PDF yang diberikan. Jangan membuat
naskah alternatif atau mengambil isi surat dari data pengajuan.

Isi Permohonan template:

```text
Menyatakan hal-hal sebagai berikut :

1. Telah mengetahui bahwa unit barang yang tercantum dalam data di atas ini
   sudah pernah dilakukan proses perbaikan / servis oleh pihak Customer
   Service (CS)
2. Menyatakan bahwa unit tersebut belum pernah dijual ke end user dan masih
   milik toko/dealer
3. Bahwa saya bertanggung jawab penuh atas pengajuan penerbitan kartu garansi
   baru ini beserta segala konsekuensi administratif maupun teknis yang timbul
   di kemudian hari terkait unit tersebut
4. Mohon untuk dapat diterbitkan kembali Kartu garansi sesuai data diatas
```

Kalimat penutup pada contoh adalah:

```text
Demikian surat ini saya buat dengan sebenarnya untuk dipergunakan sebagaimana
mestinya.
```

Implementasi tidak boleh mengambil naskah Permohonan dari PDF contoh. Naskah
disimpan sebagai template server-side atau konstanta versi aplikasi agar
perubahan template dapat dilakukan secara sengaja dan dapat ditinjau.

Untuk PDF yang memuat beberapa item, gunakan versi kalimat yang tetap
bermakna secara jamak, misalnya `unit-unit tersebut`, atau siapkan varian
template tunggal dan jamak. Jangan menggandakan surat penuh untuk setiap item
di dalam satu PDF.

### Data pengajuan

Gunakan data yang sudah tersedia pada pengajuan:

- ID pengajuan;
- nama;
- pemilik;
- bagian;
- cabang;
- alasan pengajuan;
- catatan tambahan jika ada.

`tanggalForm` tidak digunakan sebagai tanggal surat. Tanggal surat berasal dari
waktu generate PDF.

### Data unit

Untuk setiap unit yang dipilih, tampilkan minimal:

- nomor item;
- produk;
- model;
- nomor seri;
- alasan atau catatan penolakan.

### Format output

- Format kertas: A4 (`210 x 297 mm`).
- Output: PDF.
- Satu PDF dapat berisi satu atau beberapa unit dari satu pengajuan.
- Jika daftar unit panjang, tabel boleh berlanjut ke halaman berikutnya.
- Header surat dan format isi dibuat konsisten untuk semua pengajuan.
- Untuk satu unit, tata letak mengikuti contoh surat satu unit.
- Untuk beberapa unit, identitas pemohon dan Permohonan tetap ditampilkan satu
  kali, sedangkan tabel detail berisi beberapa baris unit.
- Nomor surat ditampilkan pada PDF dan dibuat otomatis oleh server.
- Nama file disarankan:

```text
Satu unit:
<nama-pemohon> - <model> - <nomor-seri>.pdf

Beberapa unit:
<nama-pemohon> - <id-pengajuan> - surat-permohonan.pdf
```

Fase pertama tidak perlu menyediakan editor template di halaman admin.
Gunakan satu template server-side yang tetap agar alur generate tetap singkat.

### Nomor Surat

Nomor surat harus:

- dibuat server-side pada saat proses generate;
- tidak dapat diisi atau diubah oleh client;
- unik untuk setiap surat yang berhasil dibuat;
- ditampilkan pada PDF;
- dapat dicatat pada audit event generate jika audit diaktifkan.

Format nomor surat yang dipakai pada fase ini:

```text
SPKG/YYYYMMDD/NNNN
```

Contoh:

```text
SPKG/20261005/0001
```

Aturannya:

- `SPKG` berarti Surat Permohonan Kartu Garansi;
- `YYYYMMDD` adalah tanggal saat PDF dibuat dalam timezone `Asia/Jakarta`;
- `NNNN` adalah sequence harian dengan padding empat digit;
- sequence dimulai dari `0001` setiap tanggal baru;
- generate ulang untuk item yang sama mendapat nomor baru;
- nomor yang sudah dialokasikan boleh memiliki gap jika pembuatan PDF gagal;
- gap tidak boleh menyebabkan nomor berikutnya duplikat.

Jika nomor surat memakai sequence berurutan, alokasi nomor harus disimpan
secara persisten agar tidak terjadi duplikasi ketika ada dua admin generate
secara bersamaan. Penyimpanan nomor surat ini terpisah dari penyimpanan file
PDF; PDF tetap boleh dibuat on demand tanpa disimpan sebagai `pengajuan_file`.

## Keputusan Domain

- Hanya admin yang dapat membuat surat.
- Satu surat hanya boleh mencakup item dari satu `id_pengajuan`.
- Hanya item dengan `keputusanItem = Ditolak` yang dapat dipilih.
- Item `Disetujui` dan `Menunggu` tidak boleh masuk ke PDF.
- Semua item yang dipilih harus berasal dari satu `id_pengajuan` yang sama.
- Tidak boleh ada item duplikat dalam satu permintaan.
- Minimal satu item harus dipilih.
- Pengajuan yang tidak ditemukan atau sudah soft-delete ditolak.
- Validasi dilakukan ulang di server saat generate, bukan hanya di frontend.
- Generate surat tidak mengubah:
  - `keputusanItem`;
  - `status` pengajuan;
  - `statusCetak`;
  - `statusKirim`;
  - `approvalOverrideReason`.
- Jika admin generate ulang, server membuat PDF baru dari data terbaru.
- Generate tidak menjadi approval dan tidak membuat item masuk antrean cetak.
- Isi Permohonan tidak berubah berdasarkan alasan penolakan; alasan hanya
  ditampilkan pada tabel detail unit.

### Pengajuan berstatus `Selesai`

Pengajuan berstatus `Selesai` tidak termasuk dalam fase ini. Jika pengajuan
berstatus `Selesai`, tombol `Buat Surat Permohonan` tidak ditampilkan dan
endpoint menolak permintaan generate meskipun masih terdapat item `Ditolak`.

## Penyimpanan dan Histori

### Rekomendasi fase ini: generate on demand

Jangan menyimpan PDF hasil generate ke `pengajuan_files` pada fase ini.

Alasannya:

- PDF adalah output yang dapat dibuat ulang dari data pengajuan;
- tidak menambah record file dan relasi item yang harus dirawat;
- tidak mencampur dokumen keluaran dengan hardcopy, lampiran, atau surat
  Permohonan yang diunggah;
- tidak memerlukan halaman histori baru;
- alurnya lebih sederhana dan risiko file yatim lebih kecil.

Admin dapat mengunduh ulang dengan mengulangi aksi generate.

### Audit

Jika kebutuhan audit operasi generate diperlukan, catat satu event ringan pada
`audit_log` dengan minimal:

- actor admin;
- ID pengajuan;
- nomor item yang dipilih;
- nomor surat yang dibuat;
- jumlah item;
- waktu generate.

Audit tidak perlu menyimpan salinan PDF atau isi surat.

## API yang Direkomendasikan

Gunakan endpoint khusus yang mengembalikan response PDF:

```text
GET /api/pengajuan/:idPengajuan/rejected-unit-letter?itemNos=1,2
```

Aturan endpoint:

- wajib memvalidasi session;
- hanya role `admin` yang boleh mengakses;
- `itemNos` wajib berisi minimal satu nomor item;
- nomor item dinormalisasi dan tidak boleh duplikat;
- setiap nomor item harus milik `idPengajuan` pada URL;
- setiap item harus masih berstatus `Ditolak`;
- pengajuan berstatus `Selesai` ditolak;
- response menggunakan `Content-Type: application/pdf`;
- response menggunakan `Content-Disposition: attachment`;
- nama file dibuat server-side dari ID pengajuan dan tanggal generate;
- server tidak menerima HTML atau isi surat dari client;
- template dan data surat dirakit server-side.

GET cocok digunakan karena operasi ini tidak mengubah data dan browser dapat
memproses response sebagai file download. Jika implementasi library PDF
membutuhkan payload body yang lebih besar, endpoint dapat menggunakan `POST`
dengan body JSON yang sama secara terstruktur tanpa mengubah alur UI.

Payload alternatif jika memakai `POST`:

```json
{
  "itemNos": [1, 2]
}
```

## Perubahan UI yang Dibutuhkan

Perubahan cukup dilakukan pada panel detail pengajuan yang sudah ada:

- tambah tombol `Buat Surat Permohonan` pada area ringkasan item;
- tambah modal pemilihan item;
- tambah state loading, error, dan toast sukses;
- tambah helper download PDF;
- refresh detail jika server melaporkan item sudah berubah;
- jangan membuat halaman atau menu navigasi baru.

Pada daftar dokumen, PDF hasil generate tidak perlu ditampilkan karena tidak
disimpan sebagai lampiran.

## Keamanan dan Validasi

- Actor dan role diambil dari session server.
- Jangan percaya role, ID actor, atau status item dari payload client.
- Jangan mengambil item hanya berdasarkan `noItem`; selalu batasi dengan
  `idPengajuan`.
- Pastikan item yang dipilih berasal dari satu pengajuan yang sama.
- Escape seluruh nilai data saat dimasukkan ke template PDF.
- Jangan menaruh file hasil generate di `public/`.
- Jika PDF dibuat melalui file sementara, hapus file setelah response selesai
  atau ketika proses gagal.
- Jangan membocorkan data item dari pengajuan lain melalui pesan error.

## Di Luar Scope

Fase ini tidak mencakup:

- upload surat permohonan dari cabang;
- approval atau perubahan status item;
- pengiriman email atau notifikasi;
- OCR atau tanda tangan digital;
- editor template surat;
- konfigurasi kop surat melalui UI;
- nomor surat manual;
- histori daftar semua PDF yang pernah dibuat;
- satu surat yang mencakup beberapa `id_pengajuan`;
- penggabungan PDF dari beberapa pengajuan.
- generate massal dari daftar beberapa `id_pengajuan`.

## Acceptance Criteria

- [ ] Admin melihat tombol generate hanya jika ada item `Ditolak`.
- [ ] Admin dapat memilih satu item `Ditolak`.
- [ ] Admin dapat memilih beberapa item `Ditolak` dalam pengajuan yang sama.
- [ ] Semua item `Ditolak` terpilih secara default.
- [ ] Item `Disetujui` dan `Menunggu` tidak dapat dipilih.
- [ ] Admin tidak dapat generate tanpa memilih item.
- [ ] Satu klik generate pada detail satu pengajuan menghasilkan satu PDF untuk
  item terpilih dari `id_pengajuan` tersebut.
- [ ] Satu PDF dapat memuat banyak item selama semua item berasal dari
  `id_pengajuan` yang sama.
- [ ] Item dari beberapa `id_pengajuan` tidak dapat digabung dalam satu PDF.
- [ ] Generate untuk beberapa `id_pengajuan` harus dilakukan secara terpisah.
- [ ] PDF memuat identitas pengajuan dan seluruh item yang dipilih.
- [ ] PDF memuat nomor surat yang dibuat oleh server.
- [ ] Tanggal surat dan tanggal tanda tangan memakai waktu generate PDF, bukan
  `tanggalForm`.
- [ ] PDF menggunakan ukuran kertas A4.
- [ ] PDF dapat langsung diunduh dengan nama file yang jelas.
- [ ] Generate tidak mengubah status atau keputusan item.
- [ ] Tombol dan endpoint tidak tersedia untuk pengajuan berstatus `Selesai`.
- [ ] Item dari pengajuan lain ditolak oleh server.
- [ ] Item yang berubah status setelah modal dibuka divalidasi ulang.
- [ ] Error tidak menghilangkan pilihan item sebelum refresh diperlukan.
- [ ] Generate ulang dapat dilakukan tanpa membuat record file baru.
- [ ] Role selain admin tidak dapat menggunakan endpoint.
- [ ] Data pengajuan tidak bocor melalui endpoint atau pesan error.

## Status Keputusan Bisnis

Keputusan bisnis utama untuk fase ini sudah ditetapkan:

- naskah resmi, identitas surat, tujuan surat jika ada, dan tanda tangan
  mengikuti PDF contoh;
- ukuran kertas adalah A4;
- nomor surat dibuat otomatis oleh sistem;
- tanggal surat menggunakan waktu saat PDF dibuat;
- pengajuan berstatus `Selesai` tidak dapat dibuatkan surat.

Pola nomor surat dan aturan sequence sudah dikunci sebagai
`SPKG/YYYYMMDD/NNNN` dengan sequence harian berbasis `Asia/Jakarta`. Detail ini
tidak mengubah alur UX atau cakupan fitur.

## Urutan Implementasi

1. Kunci template final berdasarkan PDF contoh dalam ukuran A4.
2. Kunci pola dan aturan sequence nomor surat.
3. Kunci sumber waktu generate dan timezone `Asia/Jakarta`.
4. Buat resolver item `Ditolak` berdasarkan `idPengajuan` dan `itemNos`.
5. Buat service generate PDF server-side tanpa menyimpan hasil sebagai file
   pengajuan.
6. Tambahkan endpoint download yang terproteksi.
7. Tambahkan tombol dan modal pemilihan item pada detail pengajuan.
8. Tambahkan validasi server, audit ringan bila diperlukan, dan error state.
9. Tambahkan test service, endpoint, permission, nomor surat, dan isi output
   PDF.
