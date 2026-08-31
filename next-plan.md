# Next Plan MAUKAGA

Dokumen ini berisi langkah berikutnya setelah penataan single source of truth arsitektur hybrid active-archive.

## Prioritas 1 - Tutup Gap Kritis

1. Perbaiki test bootstrap admin. -> DONE
   - File: `server/services/admin-members-service.ts`
   - Masalah: schema `bootstrapAdminSchema` memanggil `z.email(...).trim()` sehingga email dengan spasi gagal sebelum trim.
   - Hasil: input email di-trim sebelum validasi `z.email(...)`, deprecated Zod email usage dirapikan, dan `pnpm test` lulus.

2. Pastikan auth bridge Nitro -> GAS. -> DONE
   - Kontrak dipilih: signed server-to-server HMAC.
   - Nitro menandatangani request GAS dengan `NUXT_GAS_BRIDGE_SECRET`/`GAS_BRIDGE_SECRET`.
   - GAS memverifikasi `bridgeSignature`, timestamp maksimal 5 menit, nonce sekali pakai, allowlist action, dan role.
   - Deployment wajib mengisi Script Property GAS `GAS_BRIDGE_SECRET` dengan nilai yang sama.

3. Smoke test archive sync end-to-end.
   - Pastikan `NUXT_GAS_BRIDGE_SECRET` di Nitro sama dengan Script Property GAS `GAS_BRIDGE_SECRET`.
   - Buat pengajuan test sampai status `Selesai`.
   - Jalankan `/api/archive/sync`.
   - Verifikasi row masuk SQLite.
   - Verifikasi file ada di `public/arsip_file`.
   - Verifikasi row GAS aktif terhapus.
   - Verifikasi file Drive masuk trash.

## Prioritas 2 - Lengkapi UX dan Operasional

1. Tambahkan kontrol UI active/archive yang jelas. -> DECISION CONFIRMED
   - Keputusan: gunakan segmented control/tab sederhana untuk memilih `active` atau `archive`.
   - Simpan pilihan source ke query URL agar reload dan share link tetap konsisten.
   - Tahapan implementasi:
     1. Scan halaman yang sudah memakai `source`: dashboard, list pengajuan, detail pengajuan, dan link antar halaman.
     2. Buat kontrol UI `Active`/`Archive` dengan default `Active`.
     3. Ubah pilihan source ke query URL, misalnya `?source=archive`.
     4. Pastikan fetch data mengikuti source: `Active` ke `/api/active/*`, `Archive` ke `/api/archive/*`.
     5. Pastikan link dashboard/list/detail membawa query `source` yang sedang aktif.
     6. Buat mode `Archive` read-only dengan menyembunyikan atau menonaktifkan aksi mutasi.
     7. Verifikasi reload/share URL, tampilan mobile/desktop, `pnpm typecheck`, `pnpm lint`, dan `pnpm test`.
   - Implementasi UI belum dikerjakan.

2. Tentukan scheduler archive sync. -> DECISION CONFIRMED
   - Keputusan tahap awal: manual-only.
   - Jalankan archive sync lewat tombol sync yang sudah ada di `app/layouts/dashboard.vue`.
   - Cron server atau Nitro scheduled task ditunda sampai smoke test end-to-end lulus dan proses manual stabil.
   - SOP manual tetap perlu mencatat kapan sync dijalankan, limit batch, pengecekan hasil, dan tindakan saat gagal.
   - Tahapan implementasi:
     1. Review tombol sync di `app/layouts/dashboard.vue` dan endpoint `/api/archive/sync`.
     2. Pastikan tombol hanya bisa dipakai admin yang sudah login melalui Better Auth.
     3. Pastikan tombol menjalankan sync manual dengan mode dan limit batch yang jelas.
     4. Rapikan state tombol: loading, sukses, gagal, dan pesan ringkasan hasil sync.
     5. Setelah sync selesai, refresh status dari `/api/archive/sync-status` atau data dashboard yang relevan.
     6. Tulis SOP manual: prasyarat env/secret, kapan sync dijalankan, limit batch, cara cek hasil, dan retry jika gagal.
     7. Tunda cron/server scheduler sampai smoke test end-to-end manual lulus dan pola operasionalnya stabil.

3. Implementasikan incremental sync yang nyata.
   - Definisikan sumber delta di GAS.
   - Mode `changed` dan `background` jangan hanya menjadi alias full sync.
   - Simpan cursor/watermark di `sync_meta`.

4. Rapikan legacy GAS admin auth/users.
   - Hapus atau isolasi helper auth lama yang tidak lagi menjadi arsitektur utama.
   - Pastikan GAS tetap bisa melayani public CS dan active proxy Nitro.
   - Hindari dependency auth provider lama untuk konfigurasi Nuxt terbaru.

## Prioritas 3 - Hardening

1. Tambahkan integration test archive sync dengan mock GAS.
   - Skenario sukses: detail `Selesai` -> SQLite -> file lokal -> finalize.
   - Skenario gagal file: SQLite boleh tersimpan, finalize tidak dipanggil.
   - Skenario status bukan `Selesai`: finalize ditolak.

2. Tambahkan test source active/archive.
   - Dashboard/list/chart memakai `/api/active/*` saat source active.
   - Dashboard/list/chart memakai `/api/archive/*` saat source archive.

3. Validasi deployment env.
   - Pastikan `.env.example` selaras dengan `nuxt.config.ts`, `apps/cs-web/nuxt.config.ts`, `config/database.ts`, dan Better Auth.
   - Hindari reliance pada hardcoded GAS default untuk production.

4. Bersihkan migration/worktree sebelum commit.
   - Pastikan hanya migration terbaru yang dibutuhkan yang tersisa.
   - Review file deleted lama agar tidak ada dokumen arsitektur lama kembali.
   - Jalankan `git status --short` sebelum commit.

## Definition of Done Berikutnya

- `pnpm typecheck` lulus.
- `pnpm lint` lulus.
- `pnpm test` lulus.
- Archive sync berhasil dengan data dan file test nyata.
- GAS finalisasi hanya terjadi setelah file lokal aman.
- Dashboard memiliki navigasi active/archive yang eksplisit.
- PRD tetap menjadi satu-satunya dokumen pemahaman arsitektur.
