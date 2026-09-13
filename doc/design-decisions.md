# Keputusan Desain Final - Fase 2 MAUKAGA

Dokumen ini mencatat keputusan domain dan data yang dikunci sebelum schema
database overhaul Fase 2 diimplementasikan. Dokumen ini melengkapi
[PRD](prd.md), menjadi referensi detail untuk
[implementation plan](../implementation-plan.md), dan menggantikan asumsi
workflow draft atau source split dari aplikasi lama.

Tanggal pencatatan: 13 September 2026

Generator ID pada keputusan ini sudah diimplementasikan pada Fase 3 di
`server/services/pengajuan-id-service.ts`. Implementasi memakai upsert atomic
terhadap `daily_sequence` dalam transaksi Drizzle, menentukan tanggal sequence
berdasarkan `TZ` atau fallback `Asia/Jakarta`, dan melakukan retry terbatas
untuk konflik transaksi yang dapat dipulihkan. Test terkait berada di
`tests/pengajuan-id-service.test.ts`.

## 1. Keputusan Utama

| Area | Keputusan |
| --- | --- |
| Database awal | Overhaul dimulai dari database baru dan kosong. Data lama tidak dimigrasikan. |
| Pembuatan pengajuan | Satu admin mengisi dan mengirim pengajuan langsung dari form aplikasi. |
| Draft | Konsep draft, `resume_token`, penyimpanan draft di browser, dan final submit terpisah dihapus. |
| Status awal | Pengajuan baru dibuat dengan status `Baru`. |
| Kontak | Tidak ada field kontak yang wajib atau tabel kontak khusus pada overhaul pertama. |
| Soft delete | Pengajuan menggunakan soft delete. Record dan audit tetap dipertahankan. |
| ID pengajuan | ID dibuat server-side dengan format `KG-YYYYMMDD-0001` dan sequence harian di database. |
| Duplikasi | Kombinasi model + nomor serial tidak boleh digunakan kembali pada pengajuan mana pun. |
| Keputusan item | Item dalam pengajuan yang sama boleh memiliki keputusan berbeda: sebagian `Disetujui`, sebagian `Ditolak`. |
| File | Hardcopy PDF wajib pada saat pengajuan dibuat. Bukti/lampiran PDF/JPG melekat pada pengajuan, bukan item. |
| Lifecycle | Lifecycle pengajuan dipisahkan dari keputusan dan status operasional item. |
| Ditolak | `Ditolak` bersifat final pada alur normal. Admin berwenang mengubahnya kembali ke `Baru`. |
| Cetak | Status pengajuan terkait cetak diperbarui otomatis berdasarkan item yang disetujui dan histori cetak yang berhasil. |
| Pengiriman | Status pengajuan terkait pengiriman diperbarui otomatis setelah seluruh item yang disetujui berhasil dikirim. |
| Selesai | Pengajuan hanya boleh menjadi `Selesai` jika minimal satu item sudah dikirim dan setiap item lainnya sudah ditolak atau sudah dikirim. Jika semua item ditolak, status tetap `Ditolak`. |
| Histori batch | Setiap percobaan cetak dan pengiriman disimpan sebagai histori batch. Cetak ulang dan pengiriman ulang membuat batch baru. |
| Sinkronisasi | Tidak ada `import_batches`, `sync_log`, `sync_meta`, atau tabel pemisahan sumber data pada overhaul pertama. |

## 2. Alur Pembuatan Pengajuan

1. Admin membuka form `Buat Pengajuan`.
2. Admin mengisi data pengajuan dan menambahkan minimal satu item.
3. Admin mengisi model serta nomor serial setiap item.
4. Admin mengunggah hardcopy PDF yang wajib dan bukti/lampiran PDF/JPG jika
   diperlukan.
5. Server memvalidasi seluruh payload, file, master model, dan duplikasi model
   + nomor serial.
6. Dalam satu workflow transaksi, server membuat ID pengajuan, record
   pengajuan, item, metadata file, status log awal, dan audit log.
7. Pengajuan langsung berstatus `Baru`; tidak ada record draft sebelumnya.

Jika validasi atau penyimpanan salah satu file gagal, data database tidak boleh
dianggap berhasil dibuat dan file sementara harus dibersihkan.

## 3. Dua Lapisan Lifecycle

### 3.1 Status pengajuan

Status pengajuan adalah status agregat dan operasional pada tingkat pengajuan.
Status ini tidak menggantikan keputusan item.

| Status | Aturan |
| --- | --- |
| `Baru` | Pengajuan baru dibuat atau masih menunggu keputusan item. |
| `Disetujui` | Minimal ada item yang disetujui untuk diproses. Item lain masih boleh menunggu atau ditolak. |
| `Ditolak` | Pengajuan ditolak pada level pengajuan atau seluruh item ditolak. Status ini final pada alur normal dan hanya admin yang boleh mengubahnya kembali ke `Baru`. |
| `Diprint` | Seluruh item yang berstatus `Disetujui` dan eligible untuk dicetak memiliki histori cetak berhasil. Item yang ditolak tidak perlu dicetak. |
| `Dikirim` | Seluruh item yang berstatus `Disetujui` memiliki histori pengiriman berhasil. Item yang ditolak tidak perlu dikirim. |
| `Selesai` | Minimal satu item sudah dikirim dan setiap item lainnya berada pada kondisi terminal: `Ditolak` atau sudah dikirim. Pengajuan dengan seluruh item ditolak tetap `Ditolak`. |

Status `Disetujui`, `Diprint`, dan `Dikirim` dapat dipengaruhi otomatis oleh
perubahan kondisi item. Admin tidak mengubah status `Diprint` atau `Dikirim`
secara manual untuk menggantikan event item.

### 3.2 Keputusan dan status item

Keputusan item disimpan terpisah dari status pengajuan:

| Data item | Nilai penting |
| --- | --- |
| Keputusan | `Menunggu`, `Disetujui`, atau `Ditolak`. |
| Status cetak | Belum dicetak atau sudah memiliki hasil cetak berhasil. |
| Status kirim | Belum dikirim atau sudah memiliki hasil pengiriman berhasil. |
| Catatan | Alasan keputusan atau catatan operasional item. |

Aturan item:

- Item `Ditolak` adalah terminal dan tidak masuk antrean cetak atau pengiriman.
- Item `Disetujui` dapat dicetak dan dikirim secara terpisah dari item lain.
- Satu pengajuan boleh memiliki campuran item `Disetujui` dan `Ditolak`.
- Item yang belum memiliki keputusan mencegah pengajuan menjadi `Selesai`.
- Setiap keputusan item dicatat dalam `status_log` dan `audit_log`.

## 4. Transisi Workflow

Transisi berikut menjadi aturan service, bukan sekadar aturan UI:

| Dari | Ke kondisi | Hasil |
| --- | --- | --- |
| Baru | Ada minimal satu item disetujui | Pengajuan menjadi `Disetujui`. |
| Baru/Disetujui | Semua item sudah diputuskan dan ada item disetujui | Pengajuan tetap berada pada alur pemrosesan; item ditolak dikecualikan dari cetak dan kirim. |
| Disetujui | Semua item disetujui berhasil dicetak | Pengajuan otomatis menjadi `Diprint`. |
| Diprint | Semua item disetujui berhasil dikirim | Pengajuan otomatis menjadi `Dikirim`. |
| Dikirim | Minimal satu item sudah dikirim dan semua item lainnya ditolak atau sudah dikirim | Pengajuan boleh menjadi `Selesai`, setelah validasi server. |
| Status apa pun yang ditolak | Admin melakukan pemulihan | Pengajuan dapat dikembalikan ke `Baru`; mutasi ini wajib memiliki actor, alasan, dan audit log. |

Penolakan item tidak otomatis menolak seluruh pengajuan jika masih ada item
lain yang disetujui. Jika semua item ditolak, status pengajuan tetap `Ditolak`
dan tidak boleh diubah otomatis menjadi `Selesai`. Penolakan pengajuan level
utama dan penolakan semua item dibedakan dari penolakan sebagian item melalui
status pengajuan dan histori.

## 5. File dan Storage

- Hardcopy PDF adalah syarat pembuatan pengajuan.
- Bukti/lampiran tambahan menggunakan PDF/JPG dan disimpan pada relasi
  pengajuan.
- Tidak ada file yang melekat langsung pada item pada desain awal.
- Metadata file minimal menyimpan nama aman, MIME type, ukuran, checksum,
  lokasi relatif, waktu upload, actor, dan jenis file.
- File disimpan di bawah directory pengajuan, misalnya
  `storage/pengajuan/{id-pengajuan}/`.
- Akses file melewati route server yang memvalidasi session dan role.
- Soft delete pengajuan tidak otomatis menghapus histori atau file tanpa
  kebijakan retensi dan audit yang jelas.

## 6. Aturan Unik dan Soft Delete

Kombinasi model + nomor serial adalah kunci bisnis global:

- Duplikasi dalam satu form ditolak.
- Duplikasi terhadap pengajuan tersimpan ditolak.
- Record soft-deleted tetap memegang kombinasi tersebut.
- Soft delete tidak membebaskan nomor serial untuk dipakai lagi.
- Normalisasi model dan nomor serial harus konsisten sebelum dibandingkan atau
  disimpan.

Pengajuan yang di-soft-delete:

- memiliki `deleted_at`, actor penghapus, dan alasan jika diwajibkan kebijakan;
- tidak muncul pada daftar default;
- tetap tersedia untuk audit dan kebijakan pemulihan;
- tidak boleh dihapus secara hard delete melalui endpoint operasional biasa.

## 7. Histori Cetak dan Pengiriman

Status saat ini pada item boleh menyimpan referensi ke batch terakhir yang
berhasil, tetapi histori tidak boleh ditimpa.

### Cetak

- Satu operasi cetak membuat satu `print_batches`.
- Item yang dicoba dalam operasi tersebut dicatat pada
  `print_batch_items`, termasuk hasil tiap item.
- Cetak ulang membuat batch baru dan relasi item baru.
- Batch gagal atau sebagian gagal tetap disimpan untuk audit.

### Pengiriman

- Satu operasi pengiriman membuat satu `shipping_batches`.
- Item yang dicoba dicatat pada `shipping_batch_items`, termasuk hasil tiap
  item.
- Pengiriman ulang membuat batch baru dan tidak menghapus batch sebelumnya.
- Status `Dikirim` hanya dihitung dari pengiriman yang berhasil.

## 8. Blueprint Schema

Blueprint ini menjelaskan tanggung jawab dan relasi tabel. Nama kolom final
boleh mengikuti konvensi project, tetapi maknanya harus dipertahankan.

### `pengajuan`

- `id`: primary key internal.
- `id_pengajuan`: identifier publik unik, misalnya `KG-20260913-0001`.
- Field bisnis pengajuan yang memang diperlukan oleh form, tanpa field kontak
  khusus.
- `status`: status agregat lifecycle pengajuan.
- `created_by`, `created_at`, `updated_at`.
- `deleted_at`, `deleted_by`, dan alasan penghapusan untuk soft delete.

### `pengajuan_items`

- `id` dan `pengajuan_id`.
- `no_item`: nomor item unik di dalam satu pengajuan.
- `model_produk_id` bila model berasal dari master, ditambah snapshot model atau
  nama produk bila diperlukan untuk menjaga histori.
- `model` dan `nomor_seri` sebagai nilai yang tervalidasi.
- Kunci normalisasi model + nomor serial untuk unique constraint global.
- `keputusan_item`: `Menunggu`, `Disetujui`, atau `Ditolak`.
- Actor, waktu, dan catatan keputusan item.
- Jenis kartu dan field operasional item yang diperlukan untuk antrean.
- Referensi ringkas ke batch terakhir yang berhasil boleh disimpan, tetapi
  bukan pengganti tabel histori batch.

### `pengajuan_files`

- `id` dan `pengajuan_id`; tidak ada `item_id` pada desain awal.
- `file_type`: minimal `hardcopy` dan `evidence`/`attachment`.
- Storage key relatif yang dibuat server.
- Nama asli untuk tampilan, nama aman, MIME type, ukuran, checksum, actor, dan
  timestamp upload.
- Hardcopy wajib ditandai jelas agar validasi tidak bergantung pada nama file.

### `status_log`

- Relasi ke pengajuan dan item nullable sesuai scope perubahan.
- Actor user internal, status/kondisi lama, status/kondisi baru, catatan, dan
  timestamp.
- Log keputusan item dan perubahan status agregat harus dapat dibedakan saat
  dibaca untuk audit.

### `audit_log`

- Actor, action, entity type, entity ID, timestamp, dan metadata perubahan.
- Mencatat create, update, soft delete, pemulihan, keputusan item, upload file,
  cetak, cetak ulang, pengiriman, dan pengiriman ulang.

### Sequence ID

- Menyimpan counter per tanggal aplikasi.
- Update counter dan pembuatan `id_pengajuan` dilakukan dalam transaksi yang
  aman dari pembuatan paralel.

### Histori cetak

- `print_batches`: satu record untuk setiap operasi cetak, dengan actor, waktu,
  status batch, layout, dan metadata operasi.
- `print_batch_items`: item yang dicoba dalam batch, hasil per item, error atau
  catatan, dan waktu berhasil.
- Satu item boleh memiliki banyak record histori cetak.

### Histori pengiriman

- `shipping_batches`: satu record untuk setiap operasi pengiriman, dengan actor,
  waktu, status batch, dan metadata operasi.
- `shipping_batch_items`: item yang dicoba, hasil per item, error atau catatan,
  dan waktu berhasil.
- Satu item boleh memiliki banyak record histori pengiriman.

Semua tabel domain memiliki foreign key yang sesuai, timestamp konsisten,
index untuk query operasional, dan actor yang dapat ditelusuri ke user Better
Auth jika operasi dilakukan oleh admin.

## 9. Konsekuensi Schema Fase 2

Schema target minimal perlu menyediakan:

- `pengajuan` dengan status lifecycle, metadata pembuatan, soft delete, dan
  timestamp;
- `pengajuan_items` dengan keputusan item, catatan, model, nomor serial, dan
  status/relasi operasional;
- `pengajuan_files` untuk hardcopy dan lampiran level pengajuan;
- `status_log` untuk perubahan status pengajuan dan keputusan item;
- `audit_log` untuk operasi admin penting;
- sequence harian untuk generator ID;
- `print_batches` dan `print_batch_items`;
- `shipping_batches` dan `shipping_batch_items`;
- `model_produk`, `print_layouts`, `config`, email opsional, dan seluruh tabel
  Better Auth yang masih diperlukan;
- index untuk ID pengajuan, status, tanggal, cabang, model, dan nomor serial;
- unique constraint global untuk ID pengajuan dan kombinasi model + nomor
  serial.

Schema lama yang hanya bermakna integrasi archive atau sinkronisasi tidak
dibawa ke schema target. Migration dibuat terhadap database kosong di
`server/database/migrations`, sesuai konfigurasi Drizzle saat ini.

## 10. Keputusan Edge Case

Jika seluruh item dalam satu pengajuan ditolak, status pengajuan tetap
`Ditolak`. Pengajuan tersebut tidak menjadi `Selesai`, walaupun semua item
sudah berada pada kondisi terminal.

Dengan demikian, syarat `Selesai` adalah:

- minimal satu item sudah dikirim; dan
- setiap item lain sudah dikirim atau ditolak.
