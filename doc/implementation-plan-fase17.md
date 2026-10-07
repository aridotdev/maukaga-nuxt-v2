# Implementation Plan Fase 17 - Generate Surat Permohonan Unit Ditolak

Dokumen ini memecah [Fase 17](doc/fase17.md) menjadi checklist implementasi
per task. Fitur ini membuat satu PDF untuk item terpilih dari satu
`id_pengajuan` dan langsung mengunduhkannya kepada admin.

Referensi format surat:

```text
/home/arsya/Downloads/Abdul Latif - FRV450 - A82240800869.pdf
```

PDF contoh hanya menjadi referensi format, susunan, dan naskah. PDF tersebut
tidak boleh dibaca sebagai template runtime, tidak boleh di-upload sebagai
dependency aplikasi, dan tidak boleh menjadi sumber data dinamis.

## Status

- [ ] Belum dimulai
- [x] Task 1 - audit codebase dan kontrak data selesai
- [x] Task 2 - schema dan sequence surat selesai
- [x] Task 2A - schema, migration, constraint, dan test schema selesai
- [x] Task 2B - allocator atomic dan periode timezone selesai
- [x] Task 3 - domain input dan resolver item selesai
- [x] Task 4 - service nomor surat selesai
- [x] Task 5 - data view model surat selesai
- [x] Task 6 - template surat server-side selesai
- [x] Task 7 - renderer PDF A4 selesai
- [x] Task 8 - service generate surat selesai
- [x] Task 9 - endpoint download PDF selesai
- [x] Task 10 - frontend detail pengajuan selesai
- [x] Task 11 - download browser dan UX error selesai
- [x] Task 12 - audit dan observability selesai
- [x] Kontrak bisnis sudah disepakati
- [ ] Implementasi selesai
- [ ] Verifikasi selesai

## Keputusan yang Sudah Dikunci

- [x] Hanya admin yang dapat membuat surat.
- [x] Aksi tersedia dari detail pengajuan yang sudah ada.
- [x] Tidak ada halaman baru atau workflow wizard.
- [x] Satu proses generate hanya untuk satu `id_pengajuan`.
- [x] Satu PDF dapat berisi satu atau beberapa item `Ditolak` dari pengajuan
  yang sama.
- [x] Item dari beberapa `id_pengajuan` tidak boleh digabung dalam satu PDF.
- [x] Semua item `Ditolak` terpilih secara default.
- [x] Admin dapat membatalkan pilihan untuk membuat surat bagi sebagian item.
- [x] Item `Disetujui` dan `Menunggu` tidak dapat dipilih.
- [x] Generate tidak mengubah keputusan item, status pengajuan, status cetak,
  status kirim, atau approval override.
- [x] Pengajuan `Selesai` tidak dapat dibuatkan surat.
- [x] PDF dibuat on demand dan tidak disimpan sebagai `pengajuan_file`.
- [x] Format kertas adalah A4.
- [x] Naskah, identitas surat, tujuan jika ada, dan tanda tangan mengikuti
  contoh PDF.
- [x] Nomor surat dibuat otomatis oleh server.
- [x] Tanggal surat dan tanggal tanda tangan menggunakan waktu saat PDF dibuat.
- [x] Timezone aplikasi untuk tanggal surat adalah `Asia/Jakarta`.
- [x] Data pemohon diambil dari pengajuan.
- [x] Data detail unit diambil dari item `Ditolak` yang dipilih.
- [x] Naskah Permohonan adalah template server-side, bukan data dari item.

## Gate Sebelum Coding

Task berikut harus selesai sebelum service dan UI utama dibuat.

### Kontrak Nomor Surat

- [x] Format nomor surat final: `SPKG/YYYYMMDD/NNNN`.
- [x] Sequence nomor surat reset harian berdasarkan tanggal `Asia/Jakarta`.
- [x] Prefix/kode surat: `SPKG`; komponen tanggal: `YYYYMMDD`.
- [x] Nomor yang sudah dialokasikan boleh memiliki gap ketika pembuatan PDF
  gagal, tetapi tidak boleh duplikat.
- [x] Generate ulang untuk item yang sama mendapat nomor surat baru.
- [x] Nomor surat dicatat pada `audit_log` untuk setiap generate berhasil.
- [x] Sequence dialokasikan secara atomic dan persistent agar aman terhadap dua
  request generate bersamaan.

### Library PDF

- [x] Audit dependency yang sudah tersedia untuk membuat PDF server-side.
- [x] Pilih library yang dapat:
  - membuat PDF tanpa browser eksternal;
  - menggunakan ukuran A4;
  - menulis teks, tabel, garis, dan area tanda tangan;
  - melakukan wrapping teks;
  - membuat halaman berikutnya bila tabel atau naskah terlalu panjang;
  - mengembalikan `Buffer` atau stream ke response Nitro.
- [x] Jika library belum tersedia, tambahkan dependency `pdfkit` dan
  dokumentasikan alasan pemilihannya.
- [x] Pastikan library tidak membutuhkan binary runtime yang tidak tersedia
  pada deployment target.
- [x] Buat keputusan font yang mendukung karakter Indonesia dan hasil PDF yang
  konsisten di development serta production.

Keputusan implementasi: gunakan `pdfkit` karena tersedia sebagai dependency
server-side ringan, tidak membutuhkan Chrome atau binary eksternal, dan dapat
menghasilkan `Buffer` A4 dengan wrapping serta page break. Renderer memakai
font standar Helvetica bawaan PDFKit agar tidak perlu menyimpan file font baru.

### Kontrak Template

- [ ] Kunci ukuran, margin, orientasi, dan posisi elemen pada halaman A4.
- [ ] Kunci judul `SURAT PERMOHONAN KARTU GARANSI`.
- [ ] Kunci kalimat pembuka dan pengantar tabel.
- [ ] Kunci label tabel:
  - `Nama Model`;
  - `Nama Produk`;
  - `Nomor Seri`;
  - `Keputusan Awal`;
  - `Alasan`.
- [ ] Kunci naskah empat poin Permohonan sesuai PDF contoh.
- [ ] Kunci kalimat penutup.
- [ ] Kunci format tempat dan tanggal.
- [ ] Kunci label tanda tangan `Pemohon` dan `Department Head`.
- [ ] Kunci apakah tujuan surat/kop surat memiliki elemen tambahan di luar
  contoh PDF.
- [ ] Tentukan varian naskah untuk satu unit dan beberapa unit bila bentuk
  tunggal/jamak memerlukan perubahan kalimat.
- [ ] Simpan seluruh naskah sebagai konstanta atau template server-side yang
  dapat direview dalam source code.
- [ ] Jangan menjadikan nama file PDF contoh sebagai input runtime.

## Task 1 - Audit Codebase dan Kontrak Data

- [x] Baca ulang `doc/fase17.md` dan tandai semua acceptance criteria sebagai
  sumber kebenaran implementasi.
- [x] Audit detail pengajuan pada
  `app/pages/dashboard/pengajuan/index.vue`.
- [x] Identifikasi state detail pengajuan, state modal, state upload surat
  Permohonan, toast, dan pola error yang sudah digunakan.
- [x] Identifikasi tipe frontend untuk pengajuan dan item yang dapat dipakai
  ulang.
- [x] Audit `server/services/pengajuan-service.ts` untuk helper pencarian
  pengajuan dan item.
- [x] Audit repository pengajuan untuk query detail berdasarkan
  `idPengajuan`.
- [x] Audit helper session dan role admin yang dipakai endpoint existing.
- [x] Audit helper timezone aplikasi dan gunakan `Asia/Jakarta` sebagai fallback
  yang konsisten.
- [x] Audit audit log agar action generate surat memakai pola action yang sudah
  ada.
- [x] Catat file yang akan disentuh sebelum implementasi.

### Hasil Audit Task 1

#### Frontend

- Detail pengajuan berada di satu halaman:
  `app/pages/dashboard/pengajuan/index.vue`.
- Data halaman diambil melalui `useFetch('/api/pengajuan')`. Detail dibuka
  dengan mencari record dari data list melalui `findPengajuan(row.idPengajuan)`;
  tidak perlu membuat halaman detail atau composable baru untuk fase ini.
- Detail memakai `USlideover` pada sekitar baris 1206 dan modal-modal
  `UModal` untuk mutasi existing.
- State yang dapat dijadikan pola:
  - `selectedPengajuan`;
  - `detailOpen`;
  - state boolean modal;
  - state loading;
  - state error;
  - `useToast()`.
- Upload `signed_statement` saat ini memakai hidden file input dan handler
  `$fetch` langsung. Generate PDF dapat memakai `$fetch` langsung dengan
  pola yang sama; composable baru tidak diperlukan.
- Tipe `PengajuanRecord` dan `PengajuanItem` saat ini didefinisikan lokal di
  halaman dan sudah memiliki semua data surat:
  `nama`, `bagian`, `cabang`, `pemilik`, `items`, `produk`, `model`,
  `nomorSeri`, `keputusanItem`, dan `catatanKeputusan`.
- Aksi baru harus memakai `isAdmin`, bukan `canMutatePengajuan`, karena
  generate surat ditetapkan admin-only.
- Tombol tidak perlu muncul untuk status `Selesai`. Daftar item kandidat cukup
  memakai filter `keputusanItem === 'Ditolak'`.

#### Backend dan Data

- `getPengajuan()` di `server/services/pengajuan-service.ts` sudah memakai
  `findPengajuanRecord()` dan mengembalikan DTO lengkap.
- `findPengajuanRecord()` di
  `server/repositories/pengajuan-repository.ts` membatasi lookup berdasarkan
  `idPengajuan`, mengecualikan soft-delete, lalu melakukan hydrate item, file,
  relasi file-item, dan status log.
- Query existing sudah cukup untuk resolver awal. Tidak perlu repository query
  baru hanya untuk mengambil item surat.
- Item terurut berdasarkan `noItem` saat hydration/listing, sehingga service
  dapat melakukan filter item ditolak lalu mempertahankan urutan tersebut.
- Data item yang tersedia di DTO tidak memiliki field `pemilik` per item;
  `pemilik` memang berada pada record pengajuan dan akan dipakai sebagai nilai
  konteks surat.

#### Session, Role, Timezone, dan Audit

- Endpoint server memakai `requireApiSession()` dari
  `server/utils/auth-guard.ts`.
- Akses admin-only mengikuti pola:
  `requireApiSession(event, ['admin'])`.
- Actor server tersedia sebagai `user.id`; role tersedia sebagai `user.role`.
- `getApplicationTimeZone()` di
  `server/services/pengajuan-id-service.ts` sudah menyediakan fallback
  `Asia/Jakarta` dan menghormati `process.env.TZ`.
- Audit memakai `insertAuditLogRecord()` dari
  `server/repositories/pengajuan-repository.ts` dengan action/entity/metadata
  JSON. Generate surat dapat mengikuti pola ini tanpa tabel histori PDF.

#### File Ownership yang Direkomendasikan

Implementasi minimal kemungkinan hanya membutuhkan:

- `app/pages/dashboard/pengajuan/index.vue`
  untuk tombol, modal, selection, download, loading, dan error state;
- `server/api/pengajuan/[idPengajuan]/rejected-unit-letter.get.ts`
  untuk session, parsing query, response PDF, dan header download;
- `server/services/rejected-unit-letter-service.ts`
  untuk validasi item, penyusunan data surat, nomor surat, audit, dan generate
  PDF.

File yang mungkin berubah pada task berikutnya:

- `server/database/schema/` dan migration untuk sequence nomor surat;
- `server/services/pengajuan-id-service.ts` hanya jika helper timezone perlu
  diekspor atau dipakai ulang dengan perubahan kecil;
- `package.json` dan `pnpm-lock.yaml` jika library PDF belum tersedia;
- test baru di `tests/`.

Tidak perlu menambahkan:

- halaman baru;
- composable baru;
- repository baru;
- endpoint detail baru;
- tabel `pengajuan_files` atau jenis file baru untuk PDF keluaran.

## Task 2 - Schema dan Sequence Nomor Surat

### 2.1 Model sequence

- [x] Tidak memakai ulang `daily_sequence`; sequence surat memakai tabel
  terpisah `letter_sequence` agar sequence ID pengajuan tidak berubah.
- [x] Gunakan `letter_kind` sebagai pembeda jenis surat.
- [x] Gunakan `sequence_period` sebagai tanggal harian berformat `YYYY-MM-DD`.
- [x] Primary key gabungan `letter_kind + sequence_period` mencegah dua
  counter untuk jenis/periode yang sama.
- [x] Pastikan operasi increment memakai update atomic di dalam transaksi.
- [x] Pastikan dua request bersamaan tidak mendapatkan nomor yang sama melalui
  composite primary key dan `ON CONFLICT DO UPDATE` di database.
- [x] Pastikan tanggal sequence menggunakan `Asia/Jakarta`, bukan timezone
  host secara tidak sengaja.

Allocator generic dan formatter nomor sudah tersedia di
`server/services/letter-sequence-service.ts`. Integrasinya ke proses generate
PDF tetap berada pada Task 4.

### 2.2 Metadata generate

- [x] Putuskan bahwa audit log saja cukup untuk menyimpan hubungan nomor
  surat, actor, pengajuan, item, dan waktu generate.
- [x] Simpan nomor surat pada metadata `audit_log` dan
  jangan menyimpan blob PDF.
- [x] Tidak membuat tabel metadata generate terpisah pada fase ini.
- [x] Jangan menambahkan `signed_statement` atau jenis file baru untuk PDF
  keluaran ini.

### 2.3 Migration dan schema code

- [x] Tambahkan schema Drizzle
  `server/database/schema/letter-sequence.ts`.
- [x] Export schema pada `server/database/schema/index.ts`.
- [x] Buat migration database
  `server/database/migrations/20261005160612_minor_xorn/`.
- [x] Pastikan migration hanya membuat `letter_sequence` dan index-nya;
  migration tidak mengulang perubahan `pengajuan_file_items` yang sudah ada.
- [x] Tambahkan primary key gabungan yang mencegah nomor sequence duplikat.
- [x] Tambahkan index jenis surat untuk lookup sequence.
- [x] Tambahkan test schema untuk tabel, jenis surat berbeda, dan duplikasi
  kombinasi jenis/periode.
- [x] Tambahkan formatter nomor surat `SPKG/YYYYMMDD/NNNN` dan test validasinya.

### Hasil Task 2

- Schema baru: `server/database/schema/letter-sequence.ts`.
- Tabel baru: `letter_sequence`.
- Kolom:
  - `letter_kind`;
  - `sequence_period` (tanggal `YYYY-MM-DD`);
  - `current_value`;
  - `updated_at`.
- Constraint: primary key gabungan `letter_kind + sequence_period`.
- Format nomor siap tampil: `SPKG/YYYYMMDD/NNNN`.
- PDF dan histori PDF tidak disimpan pada schema ini.
- Task 4 masih perlu menghubungkan allocator dan formatter ini ke proses
  generate PDF.

## Task 3 - Domain Input dan Resolver Item

- [x] Buat schema input terstruktur:

  ```ts
  {
    itemNos: number[]
  }
  ```

- [x] Pastikan `itemNos` minimal berisi satu nomor item.
- [x] Normalisasi nomor item menjadi integer positif.
- [x] Tolak nomor item duplikat.
- [x] Ambil pengajuan berdasarkan `idPengajuan` dari route.
- [x] Tolak pengajuan yang tidak ditemukan.
- [x] Tolak pengajuan yang sudah soft-delete.
- [x] Tolak pengajuan berstatus `Selesai`.
- [x] Ambil item hanya dari pengajuan pada route.
- [x] Tolak item yang tidak ditemukan pada pengajuan tersebut.
- [x] Tolak item berstatus `Disetujui`.
- [x] Tolak item berstatus `Menunggu`.
- [x] Tolak item yang tidak lagi berstatus `Ditolak`.
- [x] Urutkan item berdasarkan `noItem`, bukan urutan payload client.
- [x] Kembalikan error yang tidak membocorkan data pengajuan lain.
- [x] Pisahkan helper resolver item dari renderer PDF agar dapat diuji tanpa
  dependency PDF.

### Hasil Task 3

- Schema input dan resolver tersedia di
  `server/services/rejected-unit-letter-service.ts`.
- Resolver memakai query pengajuan existing yang mengecualikan record
  soft-delete dan membatasi item pada `idPengajuan` yang diminta.
- Item hasil resolver selalu terurut berdasarkan `noItem`.
- Error item invalid dibuat generik dan tidak mengungkap keberadaan item pada
  pengajuan lain.
- Renderer PDF belum terlibat; integrasinya dikerjakan pada task berikutnya.

## Task 4 - Service Nomor Surat

- [x] Buat service server-side untuk mengalokasikan nomor surat.
- [x] Service menerima waktu generate dari server atau clock injection untuk
  test.
- [x] Service mengubah waktu menjadi tanggal `Asia/Jakarta`.
- [x] Service menggunakan sequence atomic dan persistent.
- [x] Service mengembalikan nomor surat final yang siap ditampilkan pada PDF.
- [x] Service tidak membaca nomor surat dari payload browser.
- [x] Service tidak menggunakan timestamp client sebagai nomor unik.
- [x] Test nomor pertama pada tanggal/periodenya.
- [x] Test nomor berikutnya pada tanggal/periode yang sama.
- [x] Test reset sesuai aturan periode yang sudah dikunci.
- [x] Atomic upsert diuji untuk alokasi berulang; retry transaksi diuji tanpa
  menghasilkan nomor duplikat. Pengujian paralel langsung tidak dipakai karena
  driver SQLite/libsql lokal mengembalikan `SQLITE_BUSY` pada commit paralel;
  jaminan concurrency tetap berada pada constraint dan upsert atomic database.
- [x] Dokumentasikan perilaku gap nomor ketika proses PDF gagal.

### Hasil Task 4

- Service publik `allocateRejectedUnitLetterNumber()` tersedia di
  `server/services/letter-sequence-service.ts`.
- Caller cukup mengirim waktu server atau waktu ter-injeksi untuk test; `letterKind`
  dan format nomor tidak berasal dari payload browser.
- Nomor dialokasikan melalui `letter_sequence` dengan upsert atomic dan retry
  terbatas untuk konflik transaksi yang dapat dipulihkan.
- Hasil service sudah siap ditampilkan: `SPKG/YYYYMMDD/NNNN`.
- Jika nomor sudah dialokasikan lalu proses PDF gagal, nomor tidak dikembalikan
  ke sequence dan gap diperbolehkan. Nomor berikutnya tetap unik.

## Task 5 - Data View Model Surat

- [x] Buat tipe internal view model surat yang memisahkan data dan template,
  minimal mencakup:
  - nomor surat;
  - tanggal surat;
  - ID pengajuan;
  - nama pemohon;
  - bagian;
  - cabang;
  - pemilik;
  - daftar item;
  - actor generate jika diperlukan untuk audit.
- [x] Map nama pemohon dari field pengajuan yang sudah berlaku.
- [x] Map bagian dan cabang dari pengajuan.
- [x] Map pemilik dari pengajuan.
- [x] Map produk, model, nomor seri, keputusan awal, dan alasan dari item.
- [x] Pastikan alasan memakai catatan keputusan yang benar.
- [x] Sediakan fallback tampilan untuk nilai optional tanpa menghasilkan
  `undefined`, `null`, atau string kosong yang membingungkan.
- [x] Format tanggal surat sesuai contoh dan timezone `Asia/Jakarta`.
- [x] Pastikan view model hanya memuat item yang sudah lolos resolver.

### Hasil Task 5

- Tipe dan mapper `RejectedUnitLetterViewModel` tersedia di
  `server/services/rejected-unit-letter-service.ts`.
- Mapper menerima nomor surat dari service server-side, waktu generate, dan
  hasil resolver item.
- Format tanggal untuk identitas surat adalah `DD/MM/YYYY`; format tanggal
  tanda tangan adalah `DD-MM-YYYY`.
- `tanggalForm` tidak digunakan sebagai tanggal surat.
- Nilai optional yang kosong ditampilkan sebagai `-`.
- Mapper tidak mengambil atau membuat item tambahan di luar hasil resolver.

## Task 6 - Template Surat Server-Side

- [x] Buat modul template khusus surat permohonan.
- [x] Pisahkan teks template dari logika layout PDF.
- [x] Masukkan judul dan kalimat pembuka sesuai PDF contoh.
- [x] Masukkan label tabel sesuai kontrak template.
- [x] Masukkan empat poin Permohonan resmi.
- [x] Masukkan kalimat penutup resmi.
- [x] Masukkan label `Mengetahui`, `Pemohon`, dan `Department Head`.
- [x] Masukkan placeholder nomor surat dari service nomor surat.
- [x] Masukkan tanggal generate pada identitas surat dan tanda tangan.
- [x] Masukkan data pengajuan dan item hanya melalui view model.
- [x] Jangan membentuk kalimat template dari alasan penolakan.
- [x] Tentukan teks yang dipakai saat PDF berisi beberapa item.
- [x] Uji template dengan karakter panjang, tanda baca, slash, angka, dan
  karakter Indonesia.

### Hasil Task 6

- Modul template tersedia di
  `server/templates/rejected-unit-letter-template.ts`.
- Naskah resmi disimpan sebagai konstanta server-side.
- Template memiliki varian tunggal dan jamak tanpa menggandakan surat penuh.
- Nomor surat, tanggal, data pemohon, dan baris item berasal dari view model.
- Modul template tidak memiliki dependency PDF dan tidak mengatur layout.

## Task 7 - Renderer PDF A4

- [x] Buat renderer server-side yang menerima view model surat.
- [x] Set ukuran halaman A4 (`210 x 297 mm` atau padanan point library).
- [x] Set orientasi portrait sesuai PDF contoh.
- [x] Set margin dan lebar konten berdasarkan hasil review visual contoh.
- [x] Render judul surat dengan alignment dan penekanan yang konsisten.
- [x] Render nomor surat sesuai posisi yang sudah dikunci.
- [x] Render blok identitas pemohon:
  - tanggal surat;
  - nama;
  - bagian;
  - cabang;
  - label `Toko/Dealer` untuk nilai pemilik.
- [x] Render tabel detail unit:
  - nama model;
  - nama produk;
  - nomor seri;
  - keputusan awal;
  - alasan.
- [x] Untuk satu item, hasilkan tampilan yang setara dengan contoh.
- [x] Untuk beberapa item, tampilkan data pengajuan satu kali dan data unit
  dalam beberapa baris atau blok yang tetap terbaca.
- [x] Pastikan tabel memiliki wrapping dan tidak memotong alasan panjang.
- [x] Render heading Permohonan dan empat poin template.
- [x] Render kalimat penutup.
- [x] Render lokasi/tanggal generate.
- [x] Render area tanda tangan pemohon dan Department Head.
- [x] Pastikan tabel/Permohonan dapat berpindah ke halaman berikutnya bila
  konten melebihi satu halaman.
- [x] Pastikan header atau elemen penting tidak bertumpuk ketika item banyak.
- [x] Pastikan PDF yang dihasilkan valid dan dapat dibuka oleh browser/PDF
  viewer standar.
- [x] Renderer mengembalikan `Buffer` atau stream tanpa menyimpan PDF sebagai
  `pengajuan_file`.
- [x] Renderer tidak memakai temporary file, sehingga tidak ada file sementara
  yang perlu dibersihkan ketika response atau proses gagal.

### Hasil Task 7

- Renderer tersedia di
  `server/renderers/rejected-unit-letter-pdf-renderer.ts`.
- Dependency yang dipilih: `pdfkit`, tanpa browser eksternal atau binary
  runtime tambahan.
- Ukuran output: A4 portrait dengan margin 48pt dan font Helvetica bawaan PDF.
- Tabel menggunakan wrapping, header berulang, dan page break otomatis.
- Renderer mengembalikan `Buffer` langsung dan tidak menyimpan PDF ke database
  atau filesystem.

## Task 8 - Service Generate Surat

- [x] Buat service `generateRejectedUnitLetter` atau nama setara yang
  mengikuti konvensi service saat ini.
- [x] Validasi actor role admin pada boundary service atau endpoint.
- [x] Validasi input menggunakan schema Zod.
- [x] Ambil dan validasi pengajuan/item dalam satu alur server-side.
- [x] Ambil waktu generate dari server.
- [x] Alokasikan nomor surat melalui service sequence.
- [x] Bentuk view model surat.
- [x] Render PDF dengan renderer A4.
- [x] Catat audit generate setelah nomor dan PDF berhasil dibuat jika audit
  diaktifkan.
- [x] Metadata audit minimal berisi:
  - `idPengajuan`;
  - `itemNos`;
  - `nomorSurat`;
  - jumlah item;
  - actor;
  - waktu generate.
- [x] Pastikan kegagalan validasi tidak mengalokasikan nomor surat.
- [x] Putuskan dan uji perilaku jika nomor sudah dialokasikan tetapi renderer
  gagal. Rekomendasi: nomor boleh terpakai/gap, tetapi tidak boleh digunakan
  ulang.
- [x] Pastikan generate tidak memanggil update status, update keputusan item,
  enqueue cetak, atau upload file.
- [x] Pastikan retry request tidak menghasilkan PDF yang sama dengan nomor
  surat duplikat.

### Hasil Task 8

- Service `generateRejectedUnitLetter()` tersedia di
  `server/services/rejected-unit-letter-service.ts`.
- Boundary service hanya menerima actor dengan role `admin`; payload divalidasi
  ulang menggunakan `rejectedUnitLetterInputSchema` melalui resolver existing.
- Alur service menggunakan waktu server, allocator sequence, view model, dan
  renderer PDF A4 yang sudah tersedia.
- Audit action yang digunakan:
  `pengajuan.rejected-unit-letter-generate`.
- Audit hanya dicatat setelah PDF berhasil dibuat. Metadata mencatat ID
  pengajuan, nomor item terurut, nomor surat, jumlah item, actor, dan waktu
  generate.
- Validasi gagal sebelum allocator tidak membuat sequence. Jika renderer gagal
  setelah allocator berhasil, nomor tetap terpakai sebagai gap dan audit sukses
  tidak dibuat.
- Service hanya menghasilkan PDF dan audit; tidak mengubah status, keputusan,
  status cetak/kirim, approval override, atau file pengajuan.
- Test service mencakup generate sukses, admin-only boundary, validasi tanpa
  alokasi sequence, audit metadata, dan gap nomor saat renderer gagal.

## Task 9 - Endpoint Download PDF

- [x] Tambahkan endpoint:

  ```text
  GET /api/pengajuan/[idPengajuan]/rejected-unit-letter
  ```

- [x] Parse query `itemNos=1,2` secara terstruktur.
- [x] Tolak query kosong, invalid, atau duplikat.
- [x] Panggil session guard existing.
- [x] Batasi endpoint hanya untuk role `admin`.
- [x] Tolak pengajuan soft-delete.
- [x] Tolak pengajuan `Selesai`.
- [x] Tolak item yang tidak lagi `Ditolak`.
- [x] Panggil service generate surat.
- [x] Set `Content-Type: application/pdf`.
- [x] Set `Content-Disposition: attachment` dengan filename aman.
- [x] Pastikan filename tidak memakai path atau karakter berbahaya.
- [x] Gunakan tanggal generate server pada filename jika diperlukan.
- [x] Set cache privat atau `no-store` karena surat dapat berisi data pribadi.
- [x] Jangan mengembalikan storage key atau path filesystem.
- [x] Jangan menerima HTML/template dari browser.
- [x] Pastikan error API konsisten dengan endpoint existing.
- [x] GET cukup untuk workflow download dan tidak memerlukan endpoint `POST`
  JSON sebagai alternatif tanpa mengubah workflow pengguna.

### Hasil Task 9

- Endpoint tersedia pada
  `server/api/pengajuan/[idPengajuan]/rejected-unit-letter.get.ts`.
- Query wajib memakai format `itemNos=1,2`; setiap nomor harus integer positif
  dan tidak boleh duplikat.
- Endpoint memanggil `requireApiSession(event, ['admin'])`, lalu meneruskan
  validasi pengajuan/item ke `generateRejectedUnitLetter()`. Karena resolver
  service existing, pengajuan soft-delete, `Selesai`, item lintas pengajuan,
  dan item yang bukan `Ditolak` tetap ditolak server-side.
- Response dikirim sebagai PDF `Buffer` memakai helper H3 `send()` dengan
  header `Content-Type`, `Content-Length`, `Content-Disposition: attachment`,
  `Cache-Control: private, no-store`, dan `X-Content-Type-Options: nosniff`.
- Filename dibentuk dari ID pengajuan hasil server dan tanggal surat, kemudian
  disanitasi agar tidak mengandung path atau karakter kontrol.
- Endpoint tidak menerima HTML/template dan tidak mengembalikan storage key
  atau path filesystem.
- Test endpoint mencakup parsing query, query invalid/duplikat, dan filename
  attachment yang aman.

## Task 10 - Frontend Detail Pengajuan

- [x] Tambahkan tipe/state untuk modal surat permohonan pada
  `app/pages/dashboard/pengajuan/index.vue` atau komponen yang sesuai.
- [x] Hitung item `Ditolak` dari data detail pengajuan.
- [x] Tampilkan tombol hanya jika:
  - actor adalah admin;
  - pengajuan bukan `Selesai`;
  - minimal ada satu item `Ditolak`.
- [x] Gunakan label `Buat Surat Permohonan`.
- [x] Gunakan ikon file yang konsisten dengan Nuxt UI/Lucide.
- [x] Letakkan tombol pada area ringkasan item atau header detail.
- [x] Buat modal dengan judul `Buat Surat Permohonan`.
- [x] Tampilkan ID pengajuan, nama, bagian, dan cabang pada modal.
- [x] Tampilkan hanya item `Ditolak`.
- [x] Tampilkan nomor item, model, nomor seri, dan alasan penolakan.
- [x] Pilih semua item secara default ketika modal dibuka.
- [x] Tambahkan aksi `Pilih semua`.
- [x] Tambahkan aksi `Batal pilih`.
- [x] Tampilkan jumlah item yang dipilih.
- [x] Nonaktifkan submit jika tidak ada item dipilih.
- [x] Gunakan label tombol `Generate & Download PDF`.
- [x] Disable tombol saat request berlangsung.
- [x] Tampilkan loading state selama download.
- [x] Pertahankan pilihan item ketika request gagal.
- [x] Tampilkan error yang dapat ditindaklanjuti di dalam modal.
- [x] Setelah berhasil, tutup modal dan tampilkan toast sukses.
- [x] Jika server melaporkan item berubah status, refresh detail pengajuan dan
  minta admin memilih ulang bila diperlukan.
- [x] Jangan menambahkan item surat permohonan ke daftar dokumen pengajuan.
- [x] Jangan mencampur aksi ini dengan `Unggah Surat Permohonan`.
- [x] Pastikan layout modal tetap terbaca pada viewport sempit.

### Hasil Task 10

- UI dibuat di `app/pages/dashboard/pengajuan/index.vue` tanpa halaman atau
  composable baru.
- Tombol `Buat Surat Permohonan` hanya tampil pada detail pengajuan untuk admin,
  pengajuan non-`Selesai`, dan ketika ada item `Ditolak`.
- Modal menampilkan ringkasan pengajuan, daftar item `Ditolak`, checkbox per
  item, aksi `Pilih semua` dan `Batal pilih`, jumlah selection, error inline,
  serta tombol `Generate & Download PDF`.
- Semua item `Ditolak` dipilih default saat modal dibuka. Error biasa
  mempertahankan selection; konflik status dari server melakukan refresh data
  dan meminta admin memilih ulang.
- Download memakai `$fetch.raw()` agar tetap bisa membaca error API dan header
  `Content-Disposition`; file PDF diunduh via object URL lalu URL dibersihkan.
- Sukses menutup modal dan menampilkan toast. PDF tidak ditambahkan ke daftar
  dokumen pengajuan dan tidak dicampur dengan aksi `Unggah Surat Permohonan`.

## Task 11 - Download Browser dan UX Error

- [x] Pilih mekanisme download yang tetap dapat membaca error API:
  - fetch blob lalu buat object URL; atau
  - request terautentikasi lalu trigger anchor download.
- [x] Ambil filename dari `Content-Disposition` bila tersedia.
- [x] Sediakan fallback filename aman bila header tidak dapat dibaca.
- [x] Revoke object URL setelah download dipicu.
- [x] Jangan membuka tab kosong jika validasi endpoint gagal.
- [x] Cegah double click atau request paralel dari modal yang sama.
- [x] Pastikan modal tidak kehilangan selection karena error jaringan.
- [x] Tampilkan pesan khusus untuk:
  - tidak ada item dipilih;
  - item sudah berubah status;
  - pengajuan `Selesai`;
  - session tidak valid;
  - kegagalan generate PDF.

### Hasil Task 11

- Download memakai `$fetch.raw()` pada aksi klik agar response error API tetap
  bisa dibaca sebelum browser download dipicu.
- PDF diunduh dari `Blob` menggunakan object URL dan anchor sementara; object
  URL selalu di-revoke pada `finally`.
- Filename diambil dari `Content-Disposition` jika ada, dengan sanitasi nama file
  dan fallback `surat-permohonan-<id-pengajuan>.pdf`.
- Validasi endpoint yang gagal tidak membuka tab baru karena download hanya
  dipicu setelah response berupa `Blob` valid.
- Tombol submit dilindungi dari double click dengan guard state dan disabled
  eksplisit saat request berjalan.
- Error jaringan/generate mempertahankan pilihan item; konflik status melakukan
  refresh data dan meminta admin memilih ulang item `Ditolak`.
- Pesan error khusus tersedia untuk item kosong, item berubah status, pengajuan
  `Selesai`, session invalid, akses role, dan kegagalan generate PDF.

## Task 12 - Audit dan Observability

- [x] Tentukan action audit final, misalnya
  `pengajuan.rejected-unit-letter-generate`.
- [x] Catat actor dari session server.
- [x] Catat ID pengajuan dan nomor item terpilih.
- [x] Catat nomor surat.
- [x] Catat jumlah item.
- [x] Catat waktu generate dari server.
- [x] Jangan menyimpan isi PDF, data pribadi berlebihan, atau path temporary
  file di audit metadata.
- [x] Pastikan generate yang gagal tidak dicatat sebagai generate sukses.
- [x] Pastikan audit tidak mengubah status bisnis.
- [x] Dokumentasikan apakah nomor surat yang gagal tetap gap.

### Hasil Task 12

- Action audit final memakai
  `pengajuan.rejected-unit-letter-generate`.
- Endpoint mengambil actor dari session server lewat `requireApiSession()`, lalu
  service mencatat `actorId` pada kolom audit dan metadata minimal.
- Metadata audit hanya berisi `idPengajuan`, `itemNos`, `nomorSurat`,
  `itemCount`, `actorId`, dan `generatedAt`.
- Isi PDF, data pribadi detail, storage key, dan path temporary tidak disimpan di
  audit metadata.
- Audit ditulis setelah PDF berhasil dirender, sehingga render/generate yang
  gagal tidak dicatat sebagai generate sukses.
- Proses audit hanya insert ke `audit_log` dan tidak mengubah status pengajuan
  atau status item.
- Nomor surat dialokasikan sebelum render PDF. Jika render gagal setelah nomor
  teralokasi, nomor tersebut tetap menjadi gap dan retry memakai nomor berikutnya
  agar nomor surat tidak dipakai ulang.

## Task 13 - Test Domain dan Sequence

- [ ] Test hanya admin yang dapat generate.
- [ ] Test role `qrcc` ditolak.
- [ ] Test role `management` ditolak.
- [ ] Test anonymous/session invalid ditolak.
- [ ] Test pengajuan tidak ditemukan.
- [ ] Test pengajuan soft-delete.
- [ ] Test pengajuan `Selesai`.
- [ ] Test `itemNos` kosong.
- [ ] Test `itemNos` invalid.
- [ ] Test item duplikat.
- [ ] Test item dari pengajuan lain.
- [ ] Test item `Disetujui`.
- [ ] Test item `Menunggu`.
- [ ] Test item yang sudah berubah dari `Ditolak`.
- [ ] Test resolver mengurutkan item berdasarkan `noItem`.
- [ ] Test nomor surat dibuat server-side.
- [ ] Test nomor surat tidak menerima nilai dari client.
- [ ] Test sequence bertambah sesuai aturan periode.
- [ ] Test concurrent allocation tidak menghasilkan duplikat.
- [ ] Test retry transaksi tidak menghasilkan nomor duplikat.

## Task 14 - Test Template dan PDF

- [ ] Test view model mengambil nama, bagian, cabang, dan pemilik dari
  pengajuan.
- [ ] Test view model mengambil model, produk, nomor seri, keputusan, dan
  alasan dari item.
- [ ] Test `tanggalForm` tidak dipakai sebagai tanggal surat.
- [ ] Test tanggal surat berasal dari clock server yang diinjeksi.
- [ ] Test timezone `Asia/Jakarta`.
- [ ] Test nomor surat tampil pada output.
- [ ] Test ukuran halaman A4.
- [ ] Test satu item menghasilkan satu surat dengan satu blok detail.
- [ ] Test beberapa item menghasilkan satu PDF dengan beberapa detail dan satu
  blok identitas/persetujuan.
- [ ] Test item dari beberapa pengajuan tidak dapat masuk satu view model.
- [ ] Test naskah Permohonan template tampil sesuai kontrak.
- [ ] Test nama pemohon tampil pada area tanda tangan.
- [ ] Test alasan penolakan tampil pada detail unit.
- [ ] Test alasan panjang melakukan wrapping tanpa overlap.
- [ ] Test tabel panjang dapat membuat halaman lanjutan.
- [ ] Test karakter Indonesia dan tanda baca tidak merusak PDF.
- [ ] Test output memiliki MIME/content yang valid untuk PDF.

## Task 15 - Test Endpoint dan Frontend

- [ ] Test endpoint mengembalikan `application/pdf`.
- [ ] Test endpoint mengembalikan `Content-Disposition: attachment`.
- [ ] Test filename aman dan sesuai konteks pengajuan.
- [ ] Test endpoint tidak mengekspos storage key/path.
- [ ] Test endpoint menolak request lintas pengajuan.
- [ ] Test endpoint menolak pengajuan `Selesai`.
- [ ] Test audit generate sukses berisi nomor surat dan item target.
- [ ] Test kegagalan tidak membuat audit sukses.
- [ ] Test tombol tidak muncul jika tidak ada item `Ditolak`.
- [ ] Test tombol tidak muncul untuk non-admin.
- [ ] Test tombol tidak muncul untuk pengajuan `Selesai`.
- [ ] Test semua item `Ditolak` terpilih saat modal dibuka.
- [ ] Test `Pilih semua`, `Batal pilih`, dan selection sebagian.
- [ ] Test submit disabled ketika selection kosong.
- [ ] Test loading mencegah submit ganda.
- [ ] Test error mempertahankan selection.
- [ ] Test sukses menutup modal dan menampilkan toast.

## Task 16 - Migration dan Verifikasi Lokal

- [ ] Jalankan `pnpm db:generate`.
- [ ] Review migration yang dihasilkan secara manual.
- [ ] Pastikan migration hanya mencakup kebutuhan Fase 17.
- [ ] Jalankan migration pada database development/test.
- [ ] Verifikasi sequence nomor surat setelah migration.
- [ ] Verifikasi sequence ID pengajuan existing tetap berjalan.
- [ ] Buat data pengajuan dengan satu item `Ditolak`.
- [ ] Generate PDF satu item dan buka hasilnya di PDF viewer.
- [ ] Buat data pengajuan dengan beberapa item `Ditolak`.
- [ ] Generate semua item dan verifikasi satu PDF multi-item.
- [ ] Generate sebagian item dan verifikasi hanya item terpilih yang masuk.
- [ ] Coba generate dari pengajuan `Selesai`.
- [ ] Coba request dengan item dari pengajuan lain.
- [ ] Coba dua generate bersamaan untuk menguji sequence.
- [ ] Pastikan tidak ada file baru pada `pengajuan_files` setelah generate.
- [ ] Pastikan keputusan/status item tidak berubah setelah generate.

## Task 17 - Verifikasi Visual PDF

- [ ] Render PDF satu item menjadi image untuk review visual.
- [ ] Bandingkan judul, margin, tabel, Permohonan, penutup, dan tanda tangan
  dengan PDF contoh.
- [ ] Pastikan ukuran halaman A4, bukan Letter.
- [ ] Pastikan nama pemohon, tanggal, bagian, dan cabang berada pada blok yang
  benar.
- [ ] Pastikan `Toko/Dealer` berada setelah `Cabang` pada blok data utama,
  sedangkan model, produk,
  nomor seri, keputusan, dan alasan berada pada tabel yang benar.
- [ ] Pastikan nomor surat terlihat dan tidak bertabrakan dengan elemen lain.
- [ ] Render PDF beberapa item menjadi image untuk review visual.
- [ ] Pastikan tabel multi-item tidak memotong data atau keluar dari margin.
- [ ] Pastikan Permohonan dan area tanda tangan tetap terbaca setelah tabel
  bertambah.
- [ ] Pastikan halaman tambahan memiliki alur baca yang wajar.
- [ ] Pastikan tidak ada overflow, overlap, atau teks di luar halaman.

## Task 18 - Quality Gate

- [ ] Jalankan `pnpm typecheck`.
- [ ] Jalankan `pnpm lint`.
- [ ] Jalankan `pnpm test`.
- [ ] Jalankan `pnpm build`.
- [ ] Review route baru dan permission server.
- [ ] Review migration dan rollback/deployment note.
- [ ] Review filename dan header cache/content disposition.
- [ ] Review bahwa PDF tidak tersimpan di `public/`.
- [ ] Review bahwa PDF tidak masuk ke `pengajuan_files`.
- [ ] Review bahwa tidak ada status lifecycle baru.
- [ ] Review bahwa tidak ada perubahan workflow approval override.
- [ ] Review bahwa tidak ada perubahan workflow cetak/pengiriman.
- [ ] Review bahwa generate lintas `id_pengajuan` tidak didukung.
- [ ] Review diff agar tidak ada perubahan unrelated.

## Acceptance Checklist

Checklist ini harus seluruhnya tercentang sebelum fase dianggap selesai.

### Scope dan UX

- [ ] Admin melihat `Buat Surat Permohonan` hanya jika ada item `Ditolak`.
- [ ] Tombol tidak muncul untuk non-admin.
- [ ] Tombol tidak muncul untuk pengajuan `Selesai`.
- [ ] Modal dibuka dari detail pengajuan existing.
- [ ] Semua item `Ditolak` dipilih secara default.
- [ ] Admin dapat memilih satu item.
- [ ] Admin dapat memilih sebagian item.
- [ ] Admin dapat memilih seluruh item.
- [ ] Item `Disetujui` dan `Menunggu` tidak tampil sebagai pilihan.
- [ ] Generate tanpa item dipilih dicegah.
- [ ] Loading mencegah submit ganda.
- [ ] Error tidak menghilangkan selection.
- [ ] Sukses mengunduh PDF dan menutup modal.

### Data dan Dokumen

- [ ] Satu generate hanya menghasilkan PDF untuk satu `id_pengajuan`.
- [ ] Satu PDF dapat memuat banyak item dari pengajuan yang sama.
- [ ] Beberapa `id_pengajuan` tidak dapat digabung.
- [ ] Data pemohon berasal dari pengajuan.
- [ ] Detail unit berasal dari item `Ditolak`.
- [ ] Alasan penolakan tampil pada detail unit.
- [ ] Naskah Permohonan berasal dari template server-side.
- [ ] Nomor surat dibuat server-side dan unik.
- [ ] Tanggal surat memakai waktu generate.
- [ ] PDF memakai timezone `Asia/Jakarta`.
- [ ] PDF memakai ukuran A4.
- [ ] PDF dapat dibuka pada PDF viewer standar.
- [ ] PDF multi-item tetap terbaca dan tidak overlap.

### Domain, Security, dan Persistence

- [ ] Server memvalidasi ulang semua item.
- [ ] Item lintas pengajuan ditolak.
- [ ] Pengajuan soft-delete ditolak.
- [ ] Pengajuan `Selesai` ditolak.
- [ ] Generate tidak mengubah keputusan/status bisnis.
- [ ] Generate tidak membuat `pengajuan_file`.
- [ ] PDF tidak disimpan pada `public/`.
- [ ] Nomor surat tidak berasal dari client.
- [ ] Sequence aman terhadap concurrent request.
- [ ] Session dan role divalidasi server-side.
- [ ] Audit generate sukses menyimpan metadata minimum yang disepakati.
- [ ] Error tidak membocorkan data pengajuan lain.

## Urutan Eksekusi Ringkas

1. Selesaikan kontrak nomor surat, library PDF, dan template.
2. Audit codebase dan finalisasi file ownership.
3. Implementasikan schema/migration sequence bila diperlukan.
4. Implementasikan resolver item dan view model surat.
5. Implementasikan service nomor surat.
6. Implementasikan template dan renderer PDF A4.
7. Implementasikan service generate dan audit.
8. Implementasikan endpoint download.
9. Implementasikan modal dan alur download pada detail pengajuan.
10. Tambahkan test domain, sequence, PDF, endpoint, dan UI.
11. Jalankan migration, verifikasi visual, dan quality gate.

## File yang Kemungkinan Berubah

Daftar ini adalah hipotesis awal dan harus dikonfirmasi pada Task 1:

- `implementation-plan-fase17.md`
- `doc/fase17.md` jika ada perubahan keputusan saat implementasi
- `server/database/schema/daily-sequence.ts` atau schema sequence baru
- `server/database/schema/index.ts`
- `server/database/migrations/<timestamp>_*`
- `server/services/pengajuan-service.ts` atau service surat baru
- `server/services/<letter-number-service>.ts`
- `server/services/<pdf-renderer-service>.ts`
- `server/api/pengajuan/[idPengajuan]/rejected-unit-letter.get.ts`
- `app/pages/dashboard/pengajuan/index.vue`
- `app/types/<pengajuan-types>.ts` bila tipe frontend dipisah
- `tests/<letter-number-service>.test.ts`
- `tests/<rejected-unit-letter-service>.test.ts`
- `tests/<rejected-unit-letter-endpoint>.test.ts`

## Out of Scope

- Upload surat permohonan dari cabang.
- Approval atau pemulihan item.
- Perubahan status pengajuan.
- Pengiriman email atau notifikasi.
- OCR atau tanda tangan digital.
- Editor template di UI.
- Konfigurasi kop surat di UI.
- Input nomor surat oleh admin.
- Penyimpanan blob PDF sebagai `pengajuan_file`.
- Histori/daftar download PDF pada dashboard.
- Generate massal untuk beberapa `id_pengajuan`.
- Penggabungan PDF lintas pengajuan.
- Perubahan workflow `signed_statement`.
- Perubahan antrean cetak atau pengiriman.
