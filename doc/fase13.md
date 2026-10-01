Dokumen ini mendefinisikan **Fase 13** setelah `Acceptance fase 12` dan sebelum
`Backlog Setelah Form Manual Stabil - Import Excel` di
[implementation-plan.md](../implementation-plan.md).


## Fase 13 - Approval Override melalui Surat Pernyataan Bertanda Tangan

Tujuan fase ini adalah mendukung kondisi ketika pengajuan yang ditolak tetap
dapat diproses setelah admin mengunggah surat pernyataan bertanda tangan dalam
format PDF.

Implementasi harus mempertahankan status lifecycle yang sudah ada dan
membatasi perubahan pada schema, service, endpoint upload, agregasi data, serta
UI yang benar-benar diperlukan.

### Keputusan Domain

- [x] Jangan menambahkan status lifecycle baru. Hasil override menggunakan
  status `Disetujui` yang sudah ada.
- [x] Bedakan surat pernyataan dari hardcopy, form bukti pengajuan, dan
  attachment PDF/JPG biasa melalui `file_type`.
- [x] Jangan menentukan tipe dokumen berdasarkan ekstensi atau nama file saja.
- [x] Tambahkan tipe file `signed_statement` pada `pengajuan_files`.
- [x] Tipe file `signed_statement` hanya boleh berupa PDF.
- [x] Tambahkan penanda terstruktur nullable pada `pengajuan`, misalnya
  `approval_override_reason`.
- [x] Isi `approval_override_reason` dengan `signed_statement` hanya ketika
  status benar-benar berubah menjadi `Disetujui` karena surat tersebut.
- [x] Admin yang mengunggah surat dianggap sudah memvalidasi surat tersebut.
  Tidak perlu OCR, validasi tanda tangan digital, atau langkah verifikasi
  tambahan.
- [x] Tetap jalankan validasi teknis file yang sudah berlaku: session, role,
  MIME type, ekstensi, ukuran, checksum, nama aman, storage containment, dan
  cleanup jika workflow gagal.
- [ ] Surat dapat diunggah saat pembuatan pengajuan maupun setelah pengajuan
  tersimpan.
- [x] Pengajuan berstatus `Baru` tidak otomatis menjadi `Disetujui` hanya
  karena sudah memiliki file surat.
- [x] Jika pengajuan ditolak pada level status utama dan memiliki surat
  pernyataan, hasil akhirnya menjadi `Disetujui`.
- [x] Jika seluruh item berstatus `Ditolak` dan memiliki surat pernyataan,
  seluruh item diubah menjadi `Disetujui`, lalu status pengajuan menjadi
  `Disetujui`.
- [ ] Jika item bercampur antara `Disetujui` dan `Ditolak`, pertahankan
  keputusan item yang sudah ada dan pulihkan status pengajuan utama menjadi
  `Disetujui`.
- [x] Pengajuan yang disetujui secara normal tidak dianggap sebagai approval
  berbasis surat walaupun memiliki file `signed_statement`.
- [x] Setelah override berhasil, pengajuan tetap melanjutkan lifecycle normal
  ke `Diprint`, `Dikirim`, dan `Selesai`.
- [x] Nilai alasan override tetap dipertahankan setelah status berubah ke
  `Diprint`, `Dikirim`, atau `Selesai`.

### Schema dan Storage

- [x] Audit schema dan migration `pengajuan_files` sebelum menambahkan tipe
  `signed_statement`.
- [x] Tambahkan `signed_statement` ke validasi dan mapping metadata file tanpa
  mengubah makna `hardcopy`, `evidence`, atau `attachment`.
- [x] Tambahkan field nullable `approval_override_reason` pada `pengajuan`.
- [ ] Tambahkan index pada `approval_override_reason` jika diperlukan untuk
  agregasi atau filter.
- [x] Pastikan file surat tetap disimpan menggunakan storage pengajuan yang
  sudah ada.
- [x] Jangan membuat tabel atau storage root baru khusus untuk surat.
- [x] Pastikan file surat dapat diunggah setelah pengajuan berstatus `Ditolak`.
- [ ] Pastikan query operasional dan agregasi mengecualikan pengajuan yang
  sudah soft-deleted.
- [ ] Jika penghapusan file tersedia, jangan menghapus histori approval yang
  sudah tercatat hanya karena file surat dihapus.

### Service dan Transisi Workflow

- [ ] Buat satu helper atau service evaluasi approval override yang dapat
  digunakan oleh upload file, perubahan status pengajuan, dan keputusan item.
- [ ] Saat admin mencoba menetapkan status `Ditolak`, evaluasi apakah file
  `signed_statement` sudah tersedia.
- [ ] Jika surat sudah tersedia sebelum proses penolakan, simpan hasil efektif
  sebagai `Disetujui` dan catat bahwa penolakan dioverride oleh surat.
- [x] Jika surat baru diunggah setelah pengajuan berstatus `Ditolak`, ubah status
  menjadi `Disetujui` dalam workflow upload yang sama.
- [ ] Saat keputusan item terakhir berubah menjadi `Ditolak`, evaluasi kembali
  keberadaan surat sebelum status agregat final disimpan.
- [x] Jika seluruh item ditolak, ubah keputusan setiap item dari `Ditolak`
  menjadi `Disetujui` dalam satu transaksi.
- [ ] Jika status utama ditolak tetapi item tidak seluruhnya ditolak, ubah hanya
  status utama dan jangan mengubah keputusan item.
- [ ] Hitung ulang status agregat pengajuan satu kali setelah seluruh perubahan
  item selesai.
- [ ] Jadikan evaluasi override idempotent agar retry atau upload ulang tidak
  membuat perubahan status dan log duplikat.
- [x] Tanpa surat pernyataan, perilaku penolakan harus tetap sama seperti
  sebelumnya.
- [x] Item yang dipulihkan menjadi `Disetujui` harus langsung memenuhi filter
  antrean cetak yang sudah ada.
- [x] Semua perubahan dilakukan server-side, memakai validasi role, actor dari
  session, dan transaksi database.

### Status Log dan Audit Log

- [x] Catat perubahan status menjadi `Disetujui` pada `status_log` dengan actor,
  timestamp, dan catatan bahwa dasar persetujuan adalah surat pernyataan
  bertanda tangan.
- [x] Jika sebelumnya status `Ditolak` sudah tersimpan, catat transisi
  `Ditolak` menjadi `Disetujui`.
- [x] Jika seluruh item dipulihkan, catat perubahan keputusan setiap item dari
  `Ditolak` menjadi `Disetujui`.
- [x] Catat upload file bertipe `signed_statement` pada `audit_log`.
- [x] Catat operasi override dengan action terstruktur, misalnya
  `approval_override_signed_statement`.
- [x] Simpan metadata audit minimal berupa ID pengajuan, actor, waktu, alasan,
  dan jumlah item yang dipulihkan.
- [x] Jangan menggunakan isi teks catatan sebagai sumber kebenaran metric.
  Gunakan `approval_override_reason` dan action audit terstruktur.
- [ ] Pastikan retry tidak menggandakan `status_log` atau `audit_log`.

### Endpoint dan Perubahan UI Minimal

- [ ] Audit endpoint create dan upload file yang sudah ada agar menerima
  metadata tipe dokumen `signed_statement`.
- [ ] Dukung upload surat pada saat create.
- [x] Dukung upload surat setelah pengajuan tersimpan dan berstatus `Ditolak`.
- [x] Batasi upload `signed_statement` kepada admin.
- [x] Pertahankan endpoint, layout, dan alur UI yang sudah ada.
- [ ] Jika payload saat ini belum dapat membedakan tipe PDF, tambahkan kontrol
  sekecil mungkin untuk memilih `Surat Pernyataan Bertanda Tangan`.
- [x] Jangan membuat halaman atau workflow baru khusus approval override.
- [x] Jangan menggunakan nama file seperti `surat.pdf` sebagai mekanisme utama
  penentuan tipe dokumen.
- [x] Pertahankan tipe upload lama agar hardcopy, evidence, dan attachment
  tetap berjalan tanpa perubahan perilaku.
- [x] Jika response API perlu diperluas, lakukan secara backward-compatible.
- [ ] Expose informasi override dan metric melalui DTO atau summary yang sudah
  tersedia, tanpa membuat sumber data statistik baru.

### Agregasi Approval Berbasis Surat

- [ ] Tambahkan agregasi bernama `approvedWithSignedStatement` atau nama setara.
- [ ] Hitung jumlah pengajuan unik dengan
  `approval_override_reason = signed_statement`.
- [ ] Hitung berdasarkan histori bahwa pengajuan pernah memperoleh approval
  melalui surat, bukan hanya berdasarkan status saat ini.
- [ ] Tetap hitung pengajuan yang status akhirnya sudah `Disetujui`, `Diprint`,
  `Dikirim`, atau `Selesai`.
- [ ] Jangan menghitung pengajuan yang hanya memiliki file surat tetapi tidak
  pernah mengalami override.
- [ ] Jangan menghitung pengajuan yang sudah soft-deleted.
- [ ] Pastikan upload ulang, retry, dan perubahan status lanjutan tidak
  menggandakan jumlah.
- [ ] Expose metric melalui summary atau response dashboard yang sudah ada.
- [ ] Jika diperlukan filter, gunakan `approval_override_reason` tanpa mengubah
  arti filter status lifecycle yang sudah ada.

### Test dan Acceptance

- [x] Test membedakan `signed_statement` dari `hardcopy`, `evidence`, dan
  attachment PDF biasa.
- [x] Test menolak `signed_statement` yang bukan PDF.
- [ ] Test menjalankan validasi MIME type, ekstensi, ukuran, checksum, dan
  storage path.
- [ ] Test admin dapat mengunggah surat saat create.
- [x] Test admin dapat mengunggah surat setelah pengajuan berstatus `Ditolak`.
- [ ] Test pengajuan `Baru` tidak otomatis menjadi `Disetujui` hanya karena
  file surat sudah tersedia.
- [ ] Test penolakan level pengajuan dengan surat menghasilkan `Disetujui`.
- [ ] Test upload surat setelah status `Ditolak` menghasilkan
  `Ditolak -> Disetujui`.
- [x] Test seluruh item `Ditolak` berubah menjadi `Disetujui` saat override.
- [ ] Test item yang dipulihkan dapat masuk antrean cetak.
- [ ] Test item campuran mempertahankan keputusan item yang sudah ada.
- [x] Test tanpa surat tetap menjalankan alur `Ditolak` normal.
- [ ] Test approval normal tidak mengisi `approval_override_reason`.
- [ ] Test operasi override idempotent dan tidak menggandakan log.
- [x] Test hanya admin yang dapat mengunggah surat untuk memicu override.
- [ ] Test agregasi menghitung pengajuan unik yang pernah disetujui karena
  surat.
- [ ] Test agregasi tetap menghitung status lanjutan sampai `Selesai`.
- [ ] Test agregasi mengecualikan file surat yang belum pernah menyebabkan
  override.
- [ ] Test agregasi mengecualikan pengajuan soft-deleted.
- [ ] Test rollback memastikan file dan perubahan database dibatalkan atau
  dibersihkan jika salah satu tahap upload/override gagal.
- [x] Jalankan `pnpm typecheck`.
- [x] Jalankan `pnpm lint`.
- [x] Jalankan `pnpm test`.

Acceptance fase 13:

- [x] Surat pernyataan bertanda tangan dapat dibedakan dari PDF bukti pengajuan
  dan attachment biasa.
- [ ] Admin dapat mengunggah surat saat create maupun setelah pengajuan ditolak.
- [x] Pengajuan yang ditolak pada level status utama dapat berubah menjadi
  `Disetujui` tanpa status lifecycle baru.
- [x] Jika seluruh item ditolak, seluruh item dapat dipulihkan menjadi
  `Disetujui` dan masuk antrean cetak.
- [ ] Jika item bercampur, keputusan item yang sudah ada tetap dipertahankan.
- [x] Setiap override memiliki actor, timestamp, alasan terstruktur,
  `status_log`, dan `audit_log`.
- [ ] Pengajuan yang disetujui normal tidak masuk hitungan approval berbasis
  surat.
- [ ] Aplikasi dapat menghitung jumlah pengajuan unik yang pernah disetujui
  karena surat, termasuk yang sudah `Diprint`, `Dikirim`, atau `Selesai`.
- [x] UI dan workflow lama tetap berjalan dengan perubahan sekecil mungkin.
- [x] Tidak ada halaman workflow baru atau status lifecycle baru.
- [ ] Test service, endpoint, permission, agregasi, dan rollback fase ini
  lulus.

Rangkuman status implementasi saat audit:

**Kondisi Saat Ini**

- `pengajuan_files` sudah memiliki `signed_statement` dan nullable
  `item_id`.
- `pengajuan` dan `pengajuan_items` sudah memiliki
  `approval_override_reason`.
- Endpoint upload setelah pengajuan tersimpan sudah tersedia melalui
  `POST /api/pengajuan/[idPengajuan]/signed-statement`.
- UI detail pengajuan sudah menyediakan upload surat untuk admin pada status
  `Ditolak`, termasuk target item.
- Dashboard summary/chart dan metric `approvedWithSignedStatement` belum
  tersedia.
- Upload surat saat create belum tersedia.
- Evaluasi override belum menjadi helper terpusat untuk semua jalur status dan
  keputusan item; kondisi pengajuan dengan item campuran masih perlu diperbaiki
  agar upload surat level pengajuan tidak memulihkan item yang tidak semestinya.

**Tahapan Implementasi**

1. **Tetapkan kontrak domain**
   - Tidak menambah status lifecycle baru.
   - Gunakan status existing `Disetujui`.
   - Gunakan `pengajuan_files.kind` sebagai tipe dokumen.
   - Tambahkan tipe baru: `signed_statement`.
   - `signed_statement` hanya boleh PDF.
   - Approval berbasis surat ditandai dengan `approval_override_reason = 'signed_statement'`.

2. **Perubahan Database**
   File utama:
   - [constants.ts](../server/database/schema/constants.ts:18)
   - [pengajuan.ts](../server/database/schema/pengajuan.ts)
   - [pengajuan-files.ts](../server/database/schema/pengajuan-files.ts)

   Perubahan:
   - Tambah `signed_statement` ke `PENGAJUAN_FILE_KINDS`.
   - Tambah kolom nullable `approval_override_reason` pada tabel `pengajuan`.
   - Tambah index jika diperlukan untuk filter/agregasi.
   - Pertahankan storage dan tabel `pengajuan_files` yang sudah ada.
   - Generate dan review migration dengan `pnpm db:generate`.

3. **Repository**
   File:
   - [pengajuan-repository.ts](../server/repositories/pengajuan-repository.ts)

   Tambahkan helper untuk:
   - Mencari apakah pengajuan memiliki file `signed_statement`.
   - Mengambil file surat berdasarkan `pengajuanId`.
   - Menyimpan `approval_override_reason`.
   - Mengambil agregasi jumlah pengajuan dengan `approval_override_reason = 'signed_statement'`.
   - Selalu mengecualikan data dengan `deletedAt`.
   - Mencegah duplikasi status log dan audit log saat retry.

4. **File Storage dan Validasi**
   File:
   - [pengajuan-file-storage.ts](../server/utils/pengajuan-file-storage.ts)

   Perubahan:
   - Tambahkan `signed_statement` ke tipe file.
   - Gunakan storage pengajuan yang sama.
   - Validasi:
     - role/session,
     - MIME PDF,
     - ekstensi PDF,
     - ukuran,
     - checksum,
     - nama file aman,
     - storage containment.
   - Pastikan file dihapus jika transaksi database gagal.

5. **Service Approval Override**
   File utama:
   - [pengajuan-service.ts](../server/services/pengajuan-service.ts:310)

   Buat satu helper, misalnya `evaluateSignedStatementOverride`, yang dipanggil oleh:

   - `createPengajuan`
   - `updatePengajuanStatus`
   - `updateItemDecision`
   - `updateItemsDecision`
   - service upload file

   Aturan helper:

   - Saat status akan menjadi `Ditolak`, cek apakah surat sudah tersedia.
   - Jika surat tersedia, hasil efektif menjadi `Disetujui`.
   - Jika upload dilakukan setelah status `Ditolak`, proses:
     - simpan file,
     - ubah status `Ditolak -> Disetujui`,
     - isi `approval_override_reason`,
     - tulis `status_log` dan `audit_log`.
   - Jika seluruh item `Ditolak`:
     - ubah seluruh keputusan item menjadi `Disetujui`,
     - catat log setiap item,
     - masukkan item kembali ke antrean cetak.
   - Jika item campuran:
     - pertahankan keputusan item yang sudah ada,
     - hanya pulihkan status utama menjadi `Disetujui`.
   - Jika pengajuan masih `Baru`, keberadaan surat tidak boleh otomatis menyetujui pengajuan.
   - Jika pengajuan sudah disetujui normal, file surat tidak boleh mengisi `approval_override_reason`.
   - Operasi harus idempotent.

6. **Perubahan API**

   Endpoint existing:
   - [create.post.ts](../server/api/pengajuan/create.post.ts:22)
   - `[idPengajuan]/status.post.ts`
   - `[idPengajuan]/item-decision.post.ts`
   - `[idPengajuan]/items-decision.post.ts`

   Perubahan:
   - Create harus mengenali `file:signed_statement:0`.
   - Jangan lagi mengubah semua file non-hardcopy menjadi `evidence`.
   - Tambahkan endpoint baru:

   ```text
   POST /api/pengajuan/[idPengajuan]/files
   ```

   Endpoint tersebut menerima multipart upload untuk surat setelah pengajuan tersimpan.

   Aturan API:
   - `signed_statement` hanya boleh diunggah oleh admin.
   - Upload surat setelah status `Ditolak` langsung memicu override dalam transaksi yang sama.
   - Response tetap mengembalikan DTO pengajuan lama dengan tambahan field secara backward-compatible.
   - Tambahkan summary endpoint, misalnya:

   ```text
   GET /api/dashboard/summary
   ```

   dengan field:

   ```ts
   approvedWithSignedStatement: number
   ```

7. **Perubahan Frontend**

   File:
   - [create.vue](../app/pages/dashboard/pengajuan/create.vue)
   - [pengajuan/index.vue](../app/pages/dashboard/pengajuan/index.vue)
   - [dashboard/index.vue](../app/pages/dashboard/index.vue)

   Perubahan UI:

   - Form create memiliki upload opsional **Surat Pernyataan Bertanda Tangan**.
   - Field hanya ditampilkan untuk admin.
   - Validasi frontend hanya menerima PDF.
   - Detail pengajuan menampilkan:
     - tipe file `Surat Pernyataan Bertanda Tangan`,
     - badge atau keterangan approval berbasis surat,
     - status override berdasarkan `approvalOverrideReason`, bukan hanya karena file surat ada.
   - Untuk pengajuan `Ditolak`, admin mendapat tombol upload surat di panel detail.
   - Tidak membuat halaman/workflow baru.
   - Dashboard menampilkan metric `approvedWithSignedStatement`.

8. **Test dan Verifikasi**

   Tambahkan test untuk:

   - Pembedaan `signed_statement`, `hardcopy`, `evidence`, dan `attachment`.
   - Surat non-PDF ditolak.
   - QRCC tidak dapat mengunggah surat override.
   - Create dengan surat tetap berstatus `Baru`.
   - Penolakan dengan surat menghasilkan `Disetujui`.
   - Upload surat setelah `Ditolak` menghasilkan `Ditolak -> Disetujui`.
   - Semua item ditolak dipulihkan menjadi `Disetujui`.
   - Item campuran tetap mempertahankan keputusan masing-masing.
   - Approval normal tidak mengisi `approval_override_reason`.
   - Retry tidak menggandakan log.
   - Soft-deleted tidak masuk agregasi.
   - File dibersihkan jika transaksi gagal.

   Verifikasi akhir:

   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   ```

**Urutan Pengerjaan yang Disarankan**

1. Schema dan migration.
2. File type serta validasi storage.
3. Repository query dan helper.
4. Service override dan transaksi.
5. Endpoint create serta upload lanjutan.
6. Frontend create dan detail.
7. Dashboard summary.
8. Test dan acceptance checklist.

Scope yang tidak perlu ditambahkan: status baru, tabel storage baru, OCR, validasi tanda tangan digital, atau halaman approval khusus.
