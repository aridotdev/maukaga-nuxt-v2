# Fase 15 - Approval Override Surat dengan Cakupan Item

## Tujuan

Menyempurnakan approval override melalui surat Permohonan bertanda tangan agar
satu surat dapat berlaku untuk:

- seluruh item yang saat ini berstatus `Ditolak`; atau
- sebagian item `Ditolak` yang dipilih secara eksplisit.

Item yang sudah `Disetujui` tidak boleh berubah. Item `Ditolak` yang tidak
termasuk dalam cakupan surat tetap `Ditolak`.

Fase ini melanjutkan [Fase 13](fase13.md). Fase 13 sudah menyediakan tipe file
`signed_statement` dan upload setelah pengajuan ditolak, tetapi model saat ini
belum menyimpan relasi satu surat ke banyak item secara eksplisit.

## Status

- [x] Core workflow selesai diimplementasikan

Implementasi fase ini memakai pendekatan sederhana: `pengajuan_files` tetap
menyimpan satu PDF, lalu tabel `pengajuan_file_items` menyimpan relasi PDF ke
satu atau beberapa item. Tabel event approval terpisah dan idempotency key
belum ditambahkan karena belum diperlukan untuk workflow admin saat ini.

## Skenario Bisnis

### Semua item ditolak

Kondisi awal:

```text
Item 1: Ditolak
Item 2: Ditolak
Item 3: Ditolak
```

Cabang mengajukan satu surat untuk seluruh item yang ditolak. Setelah admin
menyetujui:

```text
Item 1: Disetujui
Item 2: Disetujui
Item 3: Disetujui
```

Semua item masuk antrean cetak.

### Sebagian item ditolak

Kondisi awal:

```text
Item 1: Disetujui
Item 2: Ditolak
Item 3: Ditolak
Item 4: Ditolak
```

Cabang mengajukan satu surat hanya untuk Item 2 dan Item 4. Setelah admin
menyetujui:

```text
Item 1: Disetujui
Item 2: Disetujui
Item 3: Ditolak
Item 4: Disetujui
```

Item 1, 2, dan 4 dapat diproses sesuai antrean cetak. Item 3 tetap ditolak.

### Item yang sudah disetujui

Item yang sudah `Disetujui` tidak boleh dipilih sebagai target surat dan tidak
boleh dibuatkan approval override kedua hanya karena file surat yang sama.

## Batasan Scope

- Tidak menambahkan status lifecycle pengajuan baru.
- Hasil approval tetap memakai status item `Disetujui`.
- Tidak membuat halaman approval baru.
- Tidak membuat storage root baru.
- Tidak mengubah workflow cetak, pengiriman, atau `Selesai` selain akibat
  natural dari item yang berubah menjadi `Disetujui`.
- Import Excel, OCR, validasi tanda tangan digital, dan notifikasi cabang tidak
  termasuk fase ini.

### Batasan aktor

Fase ini memakai permission aplikasi saat ini:

- admin memilih item, mengunggah surat, dan mengesahkan approval override dalam
  satu transaksi server-side;
- QRCC dan management tidak dapat mengunggah atau mengesahkan surat override;
- user cabang tidak ditambahkan sebagai role login baru dalam fase ini.

Jika bisnis membutuhkan user cabang mengunggah surat secara mandiri lalu admin
menyetujui dalam langkah terpisah, itu memerlukan keputusan tambahan mengenai
role, status request, notifikasi, dan endpoint. Jangan menganggap upload oleh
admin saat ini sebagai implementasi workflow cabang mandiri.

## Keputusan Domain

- [x] Satu file `signed_statement` dapat memiliki cakupan lebih dari satu item.
- [x] Cakupan surat disimpan sebagai daftar item eksplisit, bukan hanya flag
  `all`.
- [x] Opsi `Semua item ditolak` diselesaikan menjadi daftar item konkret saat
  approval diproses.
- [x] Hanya item dengan `keputusanItem = Ditolak` yang dapat dipilih.
- [x] Item yang berubah setelah form dibuka harus divalidasi ulang di dalam
  transaksi.
- [x] Item yang sudah `Disetujui`, `Menunggu`, atau tidak berasal dari
  pengajuan yang sama ditolak.
- [x] Item ditolak yang tidak dipilih tetap `Ditolak`.
- [x] Item target berubah menjadi `Disetujui` hanya setelah file, cakupan, dan
  seluruh perubahan database berhasil.
- [x] Satu upload menghasilkan satu record file dan beberapa relasi item.
- [x] Setiap item target dicatat sebagai pemulihan terpisah pada `status_log`.
- [x] Status pengajuan dihitung ulang dari seluruh item setelah semua target
  berhasil dipulihkan.
- [x] Jika masih ada item ditolak yang tidak dicakup surat, status pengajuan
  tetap mengikuti aturan agregasi yang berlaku dan item tersebut tetap ditolak.
- [x] Jika pengajuan sebelumnya `Diprint` atau `Dikirim`, pemulihan item yang
  belum dicetak/dikirim boleh menurunkan status agregat sesuai aturan existing.
- [x] Pengajuan `Selesai` tidak dapat menerima approval override baru tanpa
  keputusan bisnis eksplisit.
- [x] Relasi approval yang sudah tersimpan tidak boleh hilang hanya karena
  file metadata atau relasi operasional dibersihkan.

## Schema dan Storage

### Model relasi yang diimplementasikan

Satu PDF disimpan sekali pada `pengajuan_files`. Cakupan item disimpan pada
tabel join sederhana berikut:

```text
pengajuan_file_items
- file_id
- item_id
- created_at
```

Checklist implementasi:

- [x] Satu file dapat direlasikan ke beberapa item.
- [x] `scope` `all_rejected` diselesaikan menjadi daftar item konkret saat
  transaksi berjalan.
- [x] Relasi memiliki foreign key dan unique constraint `file_id + item_id`.
- [x] `pengajuan_files.item_id` dipertahankan untuk kompatibilitas data lama
  dan kasus satu item.
- [x] `approval_override_reason` pada pengajuan/item tetap dipertahankan
  sebagai snapshot DTO lama.
- [x] File tetap memakai storage pengajuan yang sama.
- [x] Validasi PDF dan cleanup file saat transaksi gagal tetap memakai helper
  existing.
- [ ] Histori approval immutable terpisah dan metric berbasis approval belum
  dibuat.
- [ ] Jangan menghapus histori approval atau histori item ketika file
  operasional dihapus, jika fitur penghapusan file nanti tersedia.

### Retensi dan histori

- [x] Item target dan waktu perubahan tercatat melalui `status_log`.
- [x] Actor upload tercatat pada metadata file dan `audit_log`.
- [ ] Histori approval immutable terpisah belum dibuat.

## Service dan Transaksi

### Helper domain

- [x] Gunakan helper terpusat `uploadSignedStatement`, yang menerima:
  - `idPengajuan`;
  - file surat;
  - `scope`;
  - daftar `noItem` bila scope `selected_items`;
  - actor dan role.
- [x] Pisahkan fungsi resolusi target item dari fungsi perubahan status agar
  mudah diuji.
- [x] Resolusi `all_rejected` mengambil seluruh item `Ditolak` pada saat
  transaksi berjalan.
- [x] Resolusi `selected_items` hanya menerima nomor item unik dari payload.
- [x] Tolak scope kosong.
- [x] Tolak daftar item yang mengandung item selain `Ditolak`.
- [x] Tolak item duplikat dan item dari pengajuan lain.
- [x] Tolak upload bila pengajuan sudah soft-deleted atau `Selesai`.
- [x] Validasi ulang file dan target di dalam transaksi, bukan hanya di UI.

### Urutan transaksi

Dalam satu transaksi:

1. Ambil pengajuan dan seluruh item target dengan lock/validasi yang sesuai
   kemampuan database.
2. Pastikan pengajuan aktif dan belum `Selesai`.
3. Resolusi cakupan item.
4. Pastikan semua target masih berstatus `Ditolak`.
5. Simpan file ke storage dengan storage key server-side.
6. Simpan metadata `pengajuan_files`.
7. Simpan relasi setiap item pada `pengajuan_file_items`.
9. Ubah setiap item target:
   - `keputusanItem = Disetujui`;
   - `approvalOverrideReason = signed_statement`;
   - `statusCetak = Belum Dicetak`;
   - `statusKirim = Belum Dikirim`;
   - kosongkan timestamp cetak/kirim bila memang masih tersimpan dari state
     sebelumnya.
10. Tulis `status_log` untuk setiap item yang berubah.
11. Hitung ulang status agregat pengajuan satu kali.
12. Tulis `status_log` pengajuan bila status agregat berubah.
13. Tulis `audit_log` untuk approval override dan daftar item target.
14. Commit transaksi. Jika commit gagal, hapus file yang sudah ditulis.

### Status agregat

- [x] Gunakan resolver status existing setelah item target dipulihkan.
- [x] Jika item target membuat pengajuan kembali dapat diproses, status menjadi
  `Disetujui` atau status operasional berikutnya sesuai kondisi item.
- [x] Jangan mengubah item ditolak yang tidak dipilih.
- [x] Jangan memaksa status `Selesai` pada saat override.
- [x] Pastikan item target langsung memenuhi filter antrean cetak.
- [x] Pastikan item target tidak langsung dianggap sudah dicetak atau dikirim.

### Idempotency dan retry

- [ ] Tentukan idempotency key untuk satu proses upload/approval.
- [ ] Retry request yang sama tidak membuat file, relasi item,
  `status_log`, atau `audit_log` ganda.
- [ ] Upload file baru dengan target yang sama diperlakukan sebagai event baru
  hanya jika item memang kembali berstatus `Ditolak` dan aturan bisnis
  mengizinkannya.
- [x] Jangan menganggap keberadaan file `signed_statement` saja sebagai bukti
  approval berhasil.
- [x] Cakupan item berasal dari relasi `pengajuan_file_items` dan perubahan
  status yang berhasil, bukan dari isi catatan bebas.

## API

Pertahankan endpoint yang sudah ada bila memungkinkan:

```text
POST /api/pengajuan/[idPengajuan]/signed-statement
```

Payload multipart yang direncanakan:

```text
file: PDF
scope: all_rejected | selected_items
itemNos: JSON array, wajib bila scope = selected_items
idempotencyKey: string opsional tetapi direkomendasikan
```

Checklist endpoint:

- [x] Endpoint hanya menerima session admin sesuai policy saat ini.
- [x] Endpoint membedakan scope `all_rejected` dan `selected_items`.
- [x] Endpoint tidak menentukan cakupan dari nama file.
- [x] Endpoint menolak `selected_items` tanpa daftar item.
- [x] Endpoint menolak item yang tidak ditolak.
- [x] Endpoint menolak pengajuan `Selesai`, soft-deleted, atau tidak ditemukan.
- [x] Endpoint mengembalikan DTO pengajuan yang sama secara backward-compatible,
  ditambah informasi event/cakupan bila diperlukan.
- [x] Response menyertakan item yang dipulihkan melalui DTO item dan relasi
  cakupan file.
- [x] Error validasi menjelaskan item mana yang sudah berubah atau tidak lagi
  memenuhi syarat.
- [ ] Retry menghasilkan response konsisten tanpa duplikasi histori.

## Frontend

Perubahan dilakukan pada panel detail pengajuan yang sudah ada.

### Selector cakupan

- [x] Tampilkan aksi upload surat bila ada minimal satu item berstatus
  `Ditolak` dan pengajuan belum `Selesai`.
- [x] Jangan hanya bergantung pada status pengajuan `Ditolak`.
- [x] Sediakan pilihan:
  - `Semua item ditolak`; atau
  - `Pilih item tertentu`.
- [x] Saat memilih item tertentu, tampilkan hanya item `Ditolak`.
- [x] Tampilkan nomor item, model, nomor seri, dan alasan penolakan agar admin
  dapat memastikan cakupan surat.
- [x] Cegah submit bila tidak ada item terpilih.
- [x] Item `Disetujui` tidak dapat dipilih.
- [x] Tampilkan daftar item yang akan dipulihkan sebelum submit.

### Upload dan hasil

- [x] Terima hanya PDF pada kontrol file.
- [x] Tampilkan error upload tanpa kehilangan pilihan item selama masih aman.
- [x] Nonaktifkan submit ganda selama proses berjalan.
- [x] Setelah berhasil, refresh detail pengajuan.
- [x] Tampilkan badge/keterangan bahwa item tertentu disetujui berdasarkan surat.
- [x] Tampilkan relasi surat dan item yang dicakup pada detail.
- [x] Tampilkan item yang tidak dicakup tetap `Ditolak`.
- [x] Jangan membuat halaman approval override baru.
- [x] Jangan menampilkan file surat sebagai approval bila approval override belum
  berhasil.

### Upload saat create

- [ ] Putuskan apakah surat boleh diunggah saat create dalam fase ini.
- [ ] Jika diizinkan, create harus menerima file `signed_statement` beserta
  cakupan item setelah nomor item terbentuk.
- [ ] Jika nomor item hanya diketahui dari urutan form, validasi mapping sebelum
  commit.
- [ ] Surat saat create tidak boleh otomatis mengubah status `Baru` menjadi
  `Disetujui` tanpa keputusan bisnis eksplisit.
- [ ] Rekomendasi fase ini: fokus pada upload setelah item ditolak; upload saat
  create tetap menjadi scope terpisah agar tidak mencampur pembuatan dan
  approval.

## DTO dan Dashboard

- [ ] Tambahkan DTO histori approval terpisah secara backward-compatible,
  misalnya:

```ts
type ApprovalOverrideDto = {
  id: string
  reason: 'signed_statement'
  scope: 'all_rejected' | 'selected_items'
  itemNos: number[]
  fileName: string
  actor: string
  createdAt: string
}
```

- [ ] Detail pengajuan dapat menampilkan daftar histori approval dan item
  cakupannya.
- [ ] Jika metric approval berbasis surat tetap diperlukan, hitung dari relasi
  approval yang sukses, bukan sekadar keberadaan file.
- [ ] Hitung pengajuan unik yang memiliki minimal satu approval surat sukses.
- [ ] Kecualikan pengajuan soft-deleted.
- [ ] Tetap hitung pengajuan walaupun status akhirnya `Disetujui`, `Diprint`,
  `Dikirim`, atau `Selesai`.
- [ ] Upload ulang atau beberapa approval pada pengajuan yang sama tidak
  menggandakan jumlah pengajuan pada metric.
- [ ] Jangan mengubah arti filter status lifecycle yang sudah ada.

## Audit dan Permission

- [x] Catat upload file pada `audit_log`.
- [x] Catat approval dengan action terstruktur untuk level pengajuan dan item.
- [x] Simpan ID pengajuan, actor, scope, dan daftar item target pada metadata
  audit; ID file tidak disalin ke metadata karena entity audit sudah
  `pengajuan_file`.
- [x] Catat perubahan setiap item dari `Ditolak` ke `Disetujui` pada
  `status_log`.
- [x] Catat perubahan status agregat pengajuan bila terjadi.
- [x] Pastikan QRCC dan management menerima response permission yang konsisten.
- [x] Pastikan actor berasal dari session server, bukan payload browser.
- [ ] Pastikan retry tidak menggandakan audit atau status log; idempotency
  belum menjadi scope implementasi saat ini.

## Test

### Domain dan service

- [x] Satu surat dengan scope `all_rejected` memulihkan semua item ditolak.
- [x] Satu surat dengan scope `selected_items` memulihkan hanya item terpilih.
- [x] Item ditolak yang tidak dipilih tetap ditolak.
- [x] Item yang sudah disetujui tidak berubah.
- [x] Item `Menunggu` tidak dapat dipilih.
- [x] Item dari pengajuan lain tidak dapat dipilih.
- [x] Daftar item duplikat ditolak.
- [x] Scope kosong ditolak.
- [x] Semua target divalidasi ulang di dalam transaksi.
- [x] Item hasil override masuk antrean cetak.
- [x] Item hasil override belum berstatus dicetak atau dikirim.
- [x] Status agregat dihitung ulang satu kali.
- [x] Pengajuan `Selesai` tidak menerima override baru.
- [x] Pengajuan soft-deleted tidak menerima override.

### File dan transaksi

- [x] `signed_statement` yang bukan PDF ditolak.
- [x] MIME type, ekstensi, ukuran, checksum, dan storage containment tervalidasi
  melalui helper file existing.
- [x] File dibersihkan bila transaksi database gagal.
- [x] Metadata file menunjuk ke cakupan relasi item yang berhasil.
- [x] Satu file dapat direlasikan ke banyak item tanpa duplikasi blob/file.
- [ ] Upload ulang yang sama tidak menggandakan approval atau relasi.
- [ ] File yang hanya tersimpan tanpa approval sukses tidak dihitung sebagai
  approval.

### Endpoint dan permission

- [ ] Anonymous ditolak.
- [ ] QRCC ditolak bila policy tetap admin-only.
- [ ] Management ditolak bila policy tetap admin-only.
- [ ] Admin dapat menggunakan scope `all_rejected`.
- [ ] Admin dapat menggunakan scope `selected_items`.
- [ ] Payload invalid menghasilkan error yang dapat ditindaklanjuti.
- [ ] Retry dengan idempotency key menghasilkan hasil konsisten.

### Regression

- [x] Upload hardcopy, evidence, dan attachment tetap berjalan.
- [x] Queue cetak lama tetap bekerja.
- [x] Queue pengiriman lama tetap bekerja.
- [x] Status `Diprint`, `Dikirim`, dan `Selesai` tetap mengikuti aturan lama.
- [x] Approval normal tidak tercatat sebagai approval berbasis surat.
- [x] Data legacy dari Fase 13 tetap dapat dibaca karena `item_id` lama pada
  `pengajuan_files` tetap dipertahankan.

## Acceptance Criteria

- [x] Admin dapat mengunggah satu surat untuk seluruh item `Ditolak`.
- [x] Admin dapat mengunggah satu surat untuk beberapa item `Ditolak` yang
  dipilih.
- [x] Item `Ditolak` yang tidak dipilih tetap ditolak.
- [x] Item yang sudah `Disetujui` tetap tidak berubah.
- [x] Satu file tidak diduplikasi ketika berlaku untuk beberapa item.
- [x] Setiap item yang dipulihkan masuk antrean cetak.
- [x] Setiap item yang tidak dipulihkan tidak masuk antrean cetak.
- [x] Approval memiliki actor, timestamp, file, scope, dan daftar item melalui
  metadata file, relasi item, status log, dan audit log.
- [x] Perubahan item dan status agregat memiliki `status_log`.
- [x] Operasi memiliki `audit_log` terstruktur.
- [ ] Retry tidak menggandakan file, relasi, status log, atau audit log.
- [x] Tidak ada status lifecycle baru.
- [x] Tidak ada halaman approval baru.
- [x] Workflow cetak/pengiriman existing tetap berjalan.
- [x] Test service, permission, transaksi, dan regression service lulus.
- [ ] Test endpoint khusus dan idempotency belum dibuat.

## Urutan Implementasi

1. Sepakati kontrak aktor: admin mengunggah sekaligus menyetujui, atau cabang
   mengunggah lalu admin menyetujui dalam dua langkah.
2. Kunci model data file dan relasi item.
3. Buat schema, foreign key, index, dan migration.
4. Buat helper resolusi cakupan item.
5. Buat service transaksi approval override multi-item.
6. Tambahkan audit/status log. Idempotency ditunda.
7. Perbarui endpoint existing secara backward-compatible.
8. Perbarui panel detail dengan pilihan semua item atau item tertentu.
9. Tambahkan DTO histori event dan metric bila dashboard membutuhkannya.
10. Tambahkan test endpoint dan idempotency bila retry lintas jaringan menjadi
    kebutuhan.
11. Jalankan verifikasi:

```bash
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Risiko dan Keputusan yang Harus Dikunci

- Apakah satu surat boleh dipakai untuk beberapa proses approval terpisah?
- Apakah item yang pernah dipulihkan lalu ditolak kembali boleh menerima surat
  baru?
- Apakah cabang memiliki akun aplikasi dan boleh upload langsung?
- Jika cabang upload langsung, apakah admin perlu melihat status `Menunggu
  Persetujuan` sebelum item berubah menjadi `Disetujui`?
- Apakah satu surat boleh mencakup item yang berasal dari beberapa pengajuan?
  Rekomendasi: tidak; satu event selalu berada dalam satu pengajuan.
- Apakah surat yang sudah disetujui boleh dihapus? Rekomendasi: jangan hapus
  histori event approval.
