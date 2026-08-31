# Next Plan MAUKAGA

Dokumen ini berisi langkah berikutnya setelah penataan single source of truth arsitektur hybrid active-archive.

## Prioritas 1 - Tutup Gap Kritis

1. Perbaiki test bootstrap admin. -> DONE
   - File: `server/services/admin-members-service.ts`
   - Masalah: schema `bootstrapAdminSchema` memanggil `z.email(...).trim()` sehingga email dengan spasi gagal sebelum trim.
   - Target: ubah menjadi pola `z.string().trim().email(...)`, lalu jalankan `pnpm test`.

2. Pastikan auth bridge Nitro -> GAS.
   - Nitro saat ini memvalidasi admin dengan Better Auth.
   - GAS masih memvalidasi action admin dengan session/token GAS.
   - Pilih salah satu kontrak:
     - GAS menerima server-side shared token khusus Nitro untuk active proxy/archive finalize.
     - Nitro melakukan login/token exchange GAS secara eksplisit.
     - GAS memverifikasi token Better Auth dengan mekanisme yang benar-benar bisa divalidasi di GAS.
   - Setelah dipilih, update `doc/Code.gs`, service active/archive Nitro, dan test.

3. Smoke test archive sync end-to-end.
   - Buat pengajuan test sampai status `Selesai`.
   - Jalankan `/api/archive/sync`.
   - Verifikasi row masuk SQLite.
   - Verifikasi file ada di `public/arsip_file`.
   - Verifikasi row GAS aktif terhapus.
   - Verifikasi file Drive masuk trash.

## Prioritas 2 - Lengkapi UX dan Operasional

1. Tambahkan kontrol UI active/archive yang jelas.
   - Saat ini data source sudah didukung lewat query `?source=archive`.
   - Tambahkan segmented control atau tab di dashboard/list/detail agar user tidak perlu mengubah query manual.

2. Tentukan scheduler archive sync.
   - Opsi: cron server, Nitro scheduled task, job Windows/Linux, atau manual-only dengan SOP.
   - Catat jadwal, limit batch, retry policy, dan alert kegagalan.

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