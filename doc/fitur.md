# Sync Lokal Manual

Fitur ini dipakai untuk menjalankan sinkronisasi data arsip dari Google Apps Script ke database SQLite lokal dan folder file lokal `public/arsip_file`.

## Tujuan Fitur

- Memindahkan data historis berstatus `Selesai` dari GAS ke penyimpanan lokal.
- Menjaga dashboard admin tetap cepat saat data arsip semakin besar.
- Mengurangi ketergantungan pembacaan data historis ke Google Apps Script.
- Menyimpan file lampiran pengajuan selesai ke storage lokal agar tetap bisa dibuka dari aplikasi.

## Lokasi UI

Kontrol ada di sidebar dashboard admin, pada blok `Sync lokal`.

Saat ini UI hanya menampilkan:

- Status sync terkini
- Mode `Manual`
- `Limit batch`
- Tombol `Sync lokal`

Opsi mode lain tidak ditampilkan di UI sampai sistem benar-benar stabil.

## Cara Kerja

Saat admin menekan tombol `Sync lokal`, sistem akan:

1. Memastikan user adalah admin yang sedang login.
2. Mengambil daftar pengajuan berstatus `Selesai` dari GAS.
3. Memproses detail pengajuan satu per satu.
4. Menyimpan data ke SQLite lokal.
5. Mengunduh file arsip ke `public/arsip_file`.
6. Jika semua file aman, sistem memfinalisasi data di GAS.
7. Menandai hasil sync di `sync_log` dan `sync_meta`.

## Arti Mode

Saat ini mode yang aktif di sidebar hanya `Manual`.

Makna `Manual`:

- Sync dijalankan oleh admin secara langsung lewat tombol.
- Tidak ada scheduler otomatis.
- Tidak ada cron produksi untuk tahap ini.
- Mode ini dipakai sampai pola operasional dianggap stabil.

Catatan untuk programmer:

- Backend masih mengenal mode lain di schema.
- Namun UI tidak lagi memberi pilihan untuk mode selain `Manual`.
- Hal ini sengaja dilakukan agar operasi tidak ambigu.

## Arti Limit Batch

`Limit batch` adalah batas maksimal jumlah pengajuan yang diproses dalam satu kali run.

Tujuannya:

- mengendalikan beban request ke GAS,
- membatasi durasi proses,
- memudahkan retry kalau ada kegagalan,
- mencegah sync besar jalan tanpa pengawasan.

Aturan yang dipakai:

- Default: `100`
- Minimum: `1`
- Maksimum: `1000`

Ini adalah batas jumlah **pengajuan**, bukan jumlah file.
Satu pengajuan bisa punya lebih dari satu file lampiran.

## Output Yang Diharapkan

Setelah sync selesai, sistem akan menampilkan ringkasan seperti:

- jumlah pengajuan yang diproses
- jumlah yang sukses
- jumlah yang gagal
- status file arsip

Hasil detail juga dicatat ke status sync lokal agar admin bisa cek ulang.

## Status Operasional Saat Ini

Kebijakan saat ini adalah:

- hanya manual,
- belum ada incremental delta produksi,
- belum ada background scheduler,
- opsi selain `Manual` tidak dipakai untuk operasi harian.

## Panduan Singkat Untuk User

1. Login sebagai admin.
2. Buka dashboard.
3. Pastikan status sync lokal terlihat.
4. Biarkan mode tetap `Manual`.
5. Isi `Limit batch` sesuai kebutuhan.
6. Klik `Sync lokal`.
7. Cek ringkasan hasil setelah proses selesai.

## Panduan Singkat Untuk Programmer

- Jangan menambahkan mode baru ke UI tanpa keputusan operasional.
- Jika nanti incremental sync dibuat, mode `Changed` dan `Background` harus punya perilaku nyata.
- Jika scheduler ditambahkan, dokumentasi ini harus diperbarui bersama SOP operasional.
- Referensi utama implementasi ada di `app/layouts/dashboard.vue` dan `server/utils/archive-sync.ts`.

## Referensi Kode

- `app/layouts/dashboard.vue`
- `server/utils/archive-sync.ts`
- `server/services/archive-service.ts`
- `doc/prd.md`
- `next-plan.md`
