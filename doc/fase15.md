# Fase 15 - Approval Override Surat dengan Cakupan Item

## Tujuan

Menyempurnakan approval override melalui surat pernyataan bertanda tangan agar
satu surat dapat berlaku untuk:

- seluruh item yang saat ini berstatus `Ditolak`; atau
- sebagian item `Ditolak` yang dipilih secara eksplisit.

Item yang sudah `Disetujui` tidak boleh berubah. Item `Ditolak` yang tidak
termasuk dalam cakupan surat tetap `Ditolak`.

Fase ini melanjutkan [Fase 13](fase13.md). Fase 13 sudah menyediakan tipe file
`signed_statement` dan upload setelah pengajuan ditolak, tetapi model saat ini
belum menyimpan relasi satu surat ke banyak item secara eksplisit.

## Status

- [ ] Belum dimulai

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

- [ ] Satu file `signed_statement` dapat memiliki cakupan lebih dari satu item.
- [ ] Cakupan surat disimpan sebagai daftar item eksplisit, bukan hanya flag
  `all`.
- [ ] Opsi `Semua item ditolak` diselesaikan menjadi daftar item konkret saat
  approval diproses.
- [ ] Hanya item dengan `keputusanItem = Ditolak` yang dapat dipilih.
- [ ] Item yang berubah setelah form dibuka harus divalidasi ulang di dalam
  transaksi.
- [ ] Item yang sudah `Disetujui`, `Menunggu`, atau tidak berasal dari
  pengajuan yang sama ditolak.
- [ ] Item ditolak yang tidak dipilih tetap `Ditolak`.
- [ ] Item target berubah menjadi `Disetujui` hanya setelah file, cakupan, dan
  seluruh perubahan database berhasil.
- [ ] Approval satu surat untuk beberapa item menghasilkan satu event override
  dan beberapa relasi item.
- [ ] Setiap item target dicatat sebagai pemulihan terpisah pada `status_log`.
- [ ] Status pengajuan dihitung ulang dari seluruh item setelah semua target
  berhasil dipulihkan.
- [ ] Jika masih ada item ditolak yang tidak dicakup surat, status pengajuan
  tetap mengikuti aturan agregasi yang berlaku dan item tersebut tetap ditolak.
- [ ] Jika pengajuan sebelumnya `Diprint` atau `Dikirim`, pemulihan item yang
  belum dicetak/dikirim boleh menurunkan status agregat sesuai aturan existing.
- [ ] Pengajuan `Selesai` tidak dapat menerima approval override baru tanpa
  keputusan bisnis eksplisit.
- [ ] Approval override yang sudah tersimpan tidak boleh hilang hanya karena
  file metadata atau relasi operasional dibersihkan.

## Schema dan Storage

### Model relasi yang disarankan

Tambahkan entitas event approval override agar satu file dapat dikaitkan dengan
banyak item tanpa menggandakan file.

Contoh tabel:

```text
pengajuan_approval_overrides
- id
- pengajuan_id
- file_id
- reason
- scope
- actor_id
- created_at
```

```text
pengajuan_approval_override_items
- override_id
- item_id
- keputusan_sebelum
- keputusan_sesudah
- created_at
```

Keputusan implementasi:

- [ ] Gunakan satu record `pengajuan_approval_overrides` untuk satu proses
  upload dan approval surat.
- [ ] Gunakan `scope = all_rejected` atau `scope = selected_items` untuk
  menyimpan niat awal admin.
- [ ] Simpan item hasil resolusi pada tabel relasi
  `pengajuan_approval_override_items`.
- [ ] Tambahkan foreign key dari event override ke `pengajuan`, file, dan actor.
- [ ] Tambahkan unique constraint pada pasangan `override_id` dan `item_id`.
- [ ] Tambahkan index pada `pengajuan_id`, `file_id`, `item_id`, `reason`, dan
  `created_at` sesuai kebutuhan query.
- [ ] Pastikan satu file hanya menjadi file utama untuk satu event override.
- [ ] Jangan memakai `pengajuan_files.item_id` sebagai sumber kebenaran cakupan
  untuk `signed_statement` multi-item.
- [ ] Pertahankan `item_id` lama untuk kompatibilitas data yang sudah tersimpan,
  lalu dokumentasikan bahwa relasi baru menjadi sumber kebenaran untuk event
  multi-item.
- [ ] Pertahankan `approval_override_reason` pada pengajuan/item sebagai
  compatibility snapshot bila masih dibutuhkan DTO lama.
- [ ] Gunakan tabel event override sebagai sumber kebenaran histori, metric,
  dan audit approval berbasis surat.
- [ ] File tetap disimpan di storage pengajuan yang sama.
- [ ] File PDF tetap divalidasi dengan MIME type, ekstensi, ukuran, checksum,
  basename aman, dan storage containment.
- [ ] Cleanup file tetap dilakukan bila transaksi database gagal.
- [ ] Jangan menghapus event override atau histori item ketika file operasional
  dihapus, jika fitur penghapusan file nanti tersedia.

### Retensi dan histori

- [ ] Simpan item sebelum dan sesudah approval pada relasi event.
- [ ] Simpan actor dan timestamp pada event override.
- [ ] Simpan file yang digunakan oleh event override secara immutable selama
  kebijakan retensi mengizinkan.
- [ ] Jika item ditolak kembali pada masa depan, event override sebelumnya tetap
  menjadi histori dan approval baru menggunakan event baru.

## Service dan Transaksi

### Helper domain

- [ ] Buat helper terpusat, misalnya
  `createSignedStatementOverride`, yang menerima:
  - `idPengajuan`;
  - file surat;
  - `scope`;
  - daftar `noItem` bila scope `selected_items`;
  - actor dan role.
- [ ] Pisahkan fungsi resolusi target item dari fungsi perubahan status agar
  mudah diuji.
- [ ] Resolusi `all_rejected` mengambil seluruh item `Ditolak` pada saat
  transaksi berjalan.
- [ ] Resolusi `selected_items` hanya menerima nomor item unik dari payload.
- [ ] Tolak scope kosong.
- [ ] Tolak daftar item yang mengandung item selain `Ditolak`.
- [ ] Tolak item duplikat dan item dari pengajuan lain.
- [ ] Tolak upload bila pengajuan sudah soft-deleted atau `Selesai`.
- [ ] Validasi ulang file dan target di dalam transaksi, bukan hanya di UI.

### Urutan transaksi

Dalam satu transaksi:

1. Ambil pengajuan dan seluruh item target dengan lock/validasi yang sesuai
   kemampuan database.
2. Pastikan pengajuan aktif dan belum `Selesai`.
3. Resolusi cakupan item.
4. Pastikan semua target masih berstatus `Ditolak`.
5. Simpan file ke storage dengan storage key server-side.
6. Simpan metadata `pengajuan_files`.
7. Simpan record `pengajuan_approval_overrides`.
8. Simpan relasi setiap item pada
   `pengajuan_approval_override_items`.
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
13. Tulis `audit_log` untuk event override dan daftar item target.
14. Commit transaksi. Jika commit gagal, hapus file yang sudah ditulis.

### Status agregat

- [ ] Gunakan resolver status existing setelah item target dipulihkan.
- [ ] Jika item target membuat pengajuan kembali dapat diproses, status menjadi
  `Disetujui` atau status operasional berikutnya sesuai kondisi item.
- [ ] Jangan mengubah item ditolak yang tidak dipilih.
- [ ] Jangan memaksa status `Selesai` pada saat override.
- [ ] Pastikan item target langsung memenuhi filter antrean cetak.
- [ ] Pastikan item target tidak langsung dianggap sudah dicetak atau dikirim.

### Idempotency dan retry

- [ ] Tentukan idempotency key untuk satu proses upload/approval.
- [ ] Retry request yang sama tidak membuat file event, relasi item,
  `status_log`, atau `audit_log` ganda.
- [ ] Upload file baru dengan target yang sama diperlakukan sebagai event baru
  hanya jika item memang kembali berstatus `Ditolak` dan aturan bisnis
  mengizinkannya.
- [ ] Jangan menganggap keberadaan file `signed_statement` saja sebagai bukti
  approval berhasil.
- [ ] Cakupan item harus berasal dari event override yang berhasil, bukan dari
  isi catatan bebas.

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

- [ ] Endpoint hanya menerima session admin sesuai policy saat ini.
- [ ] Endpoint membedakan scope `all_rejected` dan `selected_items`.
- [ ] Endpoint tidak menentukan cakupan dari nama file.
- [ ] Endpoint menolak `selected_items` tanpa daftar item.
- [ ] Endpoint menolak item yang tidak ditolak.
- [ ] Endpoint menolak pengajuan `Selesai`, soft-deleted, atau tidak ditemukan.
- [ ] Endpoint mengembalikan DTO pengajuan yang sama secara backward-compatible,
  ditambah informasi event/cakupan bila diperlukan.
- [ ] Response menyertakan item yang dipulihkan dan event override yang dibuat
  bila UI memerlukannya.
- [ ] Error validasi menjelaskan item mana yang sudah berubah atau tidak lagi
  memenuhi syarat.
- [ ] Retry menghasilkan response konsisten tanpa duplikasi histori.

## Frontend

Perubahan dilakukan pada panel detail pengajuan yang sudah ada.

### Selector cakupan

- [ ] Tampilkan aksi upload surat bila ada minimal satu item berstatus
  `Ditolak` dan pengajuan belum `Selesai`.
- [ ] Jangan hanya bergantung pada status pengajuan `Ditolak`.
- [ ] Sediakan pilihan:
  - `Semua item ditolak`; atau
  - `Pilih item tertentu`.
- [ ] Saat memilih item tertentu, tampilkan hanya item `Ditolak`.
- [ ] Tampilkan nomor item, model, nomor seri, dan alasan penolakan agar admin
  dapat memastikan cakupan surat.
- [ ] Cegah submit bila tidak ada item terpilih.
- [ ] Item `Disetujui` tidak dapat dipilih.
- [ ] Tampilkan jumlah item yang akan dipulihkan sebelum submit.

### Upload dan hasil

- [ ] Terima hanya PDF pada kontrol file.
- [ ] Tampilkan error upload tanpa kehilangan pilihan item selama masih aman.
- [ ] Nonaktifkan submit ganda selama proses berjalan.
- [ ] Setelah berhasil, refresh detail pengajuan.
- [ ] Tampilkan badge/keterangan bahwa item tertentu disetujui berdasarkan surat.
- [ ] Tampilkan relasi surat dan item yang dicakup pada detail.
- [ ] Tampilkan item yang tidak dicakup tetap `Ditolak`.
- [ ] Jangan membuat halaman approval override baru.
- [ ] Jangan menampilkan file surat sebagai approval bila event override belum
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

- [ ] Tambahkan DTO event override secara backward-compatible, misalnya:

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

- [ ] Detail pengajuan dapat menampilkan daftar event override dan item
  cakupannya.
- [ ] Jika metric approval berbasis surat tetap diperlukan, hitung dari event
  override yang sukses, bukan sekadar keberadaan file.
- [ ] Hitung pengajuan unik yang memiliki minimal satu event override sukses.
- [ ] Kecualikan pengajuan soft-deleted.
- [ ] Tetap hitung pengajuan walaupun status akhirnya `Disetujui`, `Diprint`,
  `Dikirim`, atau `Selesai`.
- [ ] Upload ulang atau beberapa event pada pengajuan yang sama tidak
  menggandakan jumlah pengajuan pada metric.
- [ ] Jangan mengubah arti filter status lifecycle yang sudah ada.

## Audit dan Permission

- [ ] Catat upload file pada `audit_log`.
- [ ] Catat event approval dengan action terstruktur, misalnya
  `pengajuan.signed-statement-override`.
- [ ] Simpan ID pengajuan, ID file, ID event, actor, timestamp, scope, dan
  daftar item target pada metadata audit.
- [ ] Catat perubahan setiap item dari `Ditolak` ke `Disetujui` pada
  `status_log`.
- [ ] Catat perubahan status agregat pengajuan bila terjadi.
- [ ] Pastikan QRCC dan management menerima response permission yang konsisten.
- [ ] Pastikan actor berasal dari session server, bukan payload browser.
- [ ] Pastikan retry tidak menggandakan audit atau status log.

## Test

### Domain dan service

- [ ] Satu surat dengan scope `all_rejected` memulihkan semua item ditolak.
- [ ] Satu surat dengan scope `selected_items` memulihkan hanya item terpilih.
- [ ] Item ditolak yang tidak dipilih tetap ditolak.
- [ ] Item yang sudah disetujui tidak berubah.
- [ ] Item `Menunggu` tidak dapat dipilih.
- [ ] Item dari pengajuan lain tidak dapat dipilih.
- [ ] Daftar item duplikat ditolak.
- [ ] Scope kosong ditolak.
- [ ] Semua target divalidasi ulang di dalam transaksi.
- [ ] Item hasil override masuk antrean cetak.
- [ ] Item hasil override belum berstatus dicetak atau dikirim.
- [ ] Status agregat dihitung ulang satu kali.
- [ ] Pengajuan `Selesai` tidak menerima override baru.
- [ ] Pengajuan soft-deleted tidak menerima override.

### File dan transaksi

- [ ] `signed_statement` yang bukan PDF ditolak.
- [ ] MIME type, ekstensi, ukuran, checksum, dan storage containment tervalidasi.
- [ ] File dibersihkan bila transaksi database gagal.
- [ ] Metadata file menunjuk ke satu event override.
- [ ] Satu file dapat direlasikan ke banyak item tanpa duplikasi blob/file.
- [ ] Upload ulang yang sama tidak menggandakan event atau relasi.
- [ ] File yang hanya tersimpan tanpa event sukses tidak dihitung sebagai
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

- [ ] Upload hardcopy, evidence, dan attachment tetap berjalan.
- [ ] Queue cetak lama tetap bekerja.
- [ ] Queue pengiriman lama tetap bekerja.
- [ ] Status `Diprint`, `Dikirim`, dan `Selesai` tetap mengikuti aturan lama.
- [ ] Approval normal tidak tercatat sebagai approval berbasis surat.
- [ ] Data legacy dari Fase 13 tetap dapat dibaca bila migration kompatibilitas
  dipertahankan.

## Acceptance Criteria

- [ ] Admin dapat mengunggah satu surat untuk seluruh item `Ditolak`.
- [ ] Admin dapat mengunggah satu surat untuk beberapa item `Ditolak` yang
  dipilih.
- [ ] Item `Ditolak` yang tidak dipilih tetap ditolak.
- [ ] Item yang sudah `Disetujui` tetap tidak berubah.
- [ ] Satu file tidak diduplikasi ketika berlaku untuk beberapa item.
- [ ] Setiap item yang dipulihkan masuk antrean cetak.
- [ ] Setiap item yang tidak dipulihkan tidak masuk antrean cetak.
- [ ] Event approval memiliki actor, timestamp, file, scope, dan daftar item.
- [ ] Perubahan item dan status agregat memiliki `status_log`.
- [ ] Operasi memiliki `audit_log` terstruktur.
- [ ] Retry tidak menggandakan file event, relasi, status log, atau audit log.
- [ ] Tidak ada status lifecycle baru.
- [ ] Tidak ada halaman approval baru.
- [ ] Workflow cetak/pengiriman existing tetap berjalan.
- [ ] Test service, endpoint, permission, transaksi, dan regression lulus.

## Urutan Implementasi

1. Sepakati kontrak aktor: admin mengunggah sekaligus menyetujui, atau cabang
   mengunggah lalu admin menyetujui dalam dua langkah.
2. Kunci model data event override dan relasi item.
3. Buat schema, foreign key, index, dan migration.
4. Buat helper resolusi cakupan item.
5. Buat service transaksi approval override multi-item.
6. Tambahkan idempotency dan audit/status log.
7. Perbarui endpoint existing secara backward-compatible.
8. Perbarui panel detail dengan pilihan semua item atau item tertentu.
9. Tambahkan DTO histori cakupan dan metric bila metric dashboard tetap
   diperlukan.
10. Tambahkan test domain, transaction, endpoint, permission, dan regression.
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
