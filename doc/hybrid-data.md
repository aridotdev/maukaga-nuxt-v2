# Next Plan MAUKAGA

Dokumen ini berisi langkah berikutnya setelah penataan single source of truth arsitektur hybrid active/local.

## Prioritas 1 - Tutup Gap Kritis -> DONE

1. Perbaiki test bootstrap admin. -> DONE
   - File: `server/services/admin-members-service.ts`
   - Masalah: schema `bootstrapAdminSchema` memanggil `z.email(...).trim()` sehingga email dengan spasi gagal sebelum trim.
   - Hasil: input email di-trim sebelum validasi `z.email(...)`, deprecated Zod email usage dirapikan, dan `pnpm test` lulus.

2. Pastikan auth bridge Nitro -> GAS. -> DONE
   - Kontrak dipilih: signed server-to-server HMAC.
   - Nitro menandatangani request GAS dengan `NUXT_GAS_BRIDGE_SECRET`/`GAS_BRIDGE_SECRET`.
   - GAS memverifikasi `bridgeSignature`, timestamp maksimal 5 menit, nonce sekali pakai, allowlist action, dan role.
   - Deployment wajib mengisi Script Property GAS `GAS_BRIDGE_SECRET` dengan nilai yang sama.

3. Smoke test local sync end-to-end.
   - Pastikan `NUXT_GAS_BRIDGE_SECRET` di Nitro sama dengan Script Property GAS `GAS_BRIDGE_SECRET`.
   - Buat pengajuan test sampai status `Selesai`.
   - Jalankan `/api/local/sync`.
   - Verifikasi row masuk SQLite.
   - Verifikasi file ada di `public/arsip_file`.
   - Verifikasi row GAS aktif terhapus.
   - Verifikasi file Drive masuk trash.

## Prioritas 2 - Lengkapi UX dan Operasional -> DONE

1. Tambahkan kontrol UI active/local yang jelas. -> DONE
   - Kontrol yang dimaksud adalah segmented control dua state di header dashboard: `Active` dan `Local`, masing-masing dengan ikon, state aktif mengikuti query URL, dan `Local` memakai mode read-only.
   - Pilihan source disimpan ke query URL agar reload dan share link tetap konsisten.
   - Implementasi saat ini ada di root admin app: dashboard, list pengajuan, detail pengajuan, dan link antar halaman.
   - Tahapan implementasi:
     1. Scan halaman yang sudah memakai `source`: dashboard, list pengajuan, detail pengajuan, dan link antar halaman.
     2. Buat kontrol UI `Active`/`Local` dengan default `Active`.
     3. Ubah pilihan source ke query URL, misalnya `?source=local`.
     4. Pastikan fetch data mengikuti source: `Active` ke `/api/active/*`, `Local` ke `/api/local/*`.
     5. Pastikan link dashboard/list/detail membawa query `source` yang sedang aktif.
     6. Buat mode `Local` read-only dengan menyembunyikan atau menonaktifkan aksi mutasi.
     7. Verifikasi reload/share URL, tampilan mobile/desktop, `pnpm typecheck`, `pnpm lint`, dan `pnpm test`.

2. Tentukan scheduler local sync. -> DONE
   - Keputusan tahap awal: manual-only.
   - Jalankan local sync lewat tombol sync yang sudah ada di `app/layouts/dashboard.vue`.
   - Cron server atau Nitro scheduled task ditunda sampai smoke test end-to-end lulus dan proses manual stabil.
   - SOP manual tetap perlu mencatat kapan sync dijalankan, limit batch, pengecekan hasil, dan tindakan saat gagal.
   - Tahapan implementasi:
     1. Review tombol sync di `app/layouts/dashboard.vue` dan endpoint `/api/local/sync`.
     2. Pastikan tombol hanya bisa dipakai admin yang sudah login melalui Better Auth.
     3. Pastikan tombol menjalankan sync manual dengan mode dan limit batch yang jelas.
     4. Rapikan state tombol: loading, sukses, gagal, dan pesan ringkasan hasil sync.
     5. Setelah sync selesai, refresh status dari `/api/local/sync-status` atau data dashboard yang relevan.
     6. Tulis SOP manual: prasyarat env/secret, kapan sync dijalankan, limit batch, cara cek hasil, dan retry jika gagal.
     7. Tunda cron/server scheduler sampai smoke test end-to-end manual lulus dan pola operasionalnya stabil.

3. Implementasikan incremental sync yang nyata -> PENDING (hingga sistem stabil)
   - Definisikan sumber delta di GAS.
   - Mode `changed` dan `background` jangan hanya menjadi alias full sync.
   - Simpan cursor/watermark di `sync_meta`.
   - Implementasi yang disarankan:
     - Pakai watermark berbasis `updatedAt`/timestamp perubahan terakhir dari GAS sebagai titik mulai delta.
     - `changed` hanya tarik data yang berubah sejak watermark terakhir, lalu update watermark setelah sink sukses.
     - `background` pakai jalur delta yang sama, tapi dijalankan dengan batch lebih kecil dan prioritas lebih rendah.
     - `full` tetap jadi fallback manual ketika watermark hilang, rusak, atau perlu rebuild total.
     - Simpan state minimal di `sync_meta`: `last_cursor`, `last_watermark`, `last_mode`, `last_success_at`, dan ringkasan batch terakhir.
     - Validasi hasil dengan membandingkan run ulang: data yang tidak berubah tidak ikut diproses ulang.

4. Rapikan legacy GAS admin auth/users. -> DONE
   - Root app memakai Better Auth lokal melalui `useAdminIdentity`.
   - Handler login/user GAS lama, sheet user GAS, fallback token provider lama, dan helper provider lama sudah dihapus.
   - GAS admin action sekarang hanya menerima bridge HMAC server-to-server dari Nitro.

## Prioritas 3 - Hardening

1. Tambahkan integration test local sync dengan mock GAS.
   - Skenario sukses: detail `Selesai` -> SQLite -> file lokal -> finalize.
   - Skenario gagal file: SQLite boleh tersimpan, finalize tidak dipanggil.
   - Skenario status bukan `Selesai`: finalize ditolak.

2. Tambahkan test source active/local.
   - Dashboard/list/chart memakai `/api/active/*` saat source active.
   - Dashboard/list/chart memakai `/api/local/*` saat source local.

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
- Local sync berhasil dengan data dan file test nyata.
- GAS finalisasi hanya terjadi setelah file lokal aman.
- Dashboard memiliki navigasi active/local yang eksplisit.
- PRD tetap menjadi satu-satunya dokumen pemahaman arsitektur.
