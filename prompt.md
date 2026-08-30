## Implementation Plan: Migrasi Auth ke Better Auth Lokal

### Sumber resmi yang dipakai
- [Installation](https://better-auth.com/docs/installation)
- [Database](https://better-auth.com/docs/concepts/database)
- [API](https://better-auth.com/docs/concepts/api)
- [Basic Usage](https://better-auth.com/docs/basic-usage)
- [Nuxt Integration](https://better-auth.com/docs/integrations/nuxt)

### Aturan scope
- Fokus hanya ke auth admin dan BFF Nitro.
- CS/public jangan disentuh.
- Better Auth jadi sumber identitas admin di sisi lokal.
- Supabase auth untuk admin dihapus dari jalur aktif.

### Tujuan akhir
- Admin login/logout/session memakai Better Auth lokal.
- Server Nitro memverifikasi session lewat Better Auth, bukan Supabase.
- UI admin tetap jalan, tapi session source pindah.
- BFF active/archive tetap dipakai seperti sekarang.

### Phase 0. Audit dan freeze
1. Inventaris semua titik yang masih bergantung ke Supabase auth.
2. Tandai file yang harus diganti:
   - `useCurrentSession`
   - `useUserProfile`
   - middleware auth/role
   - login/confirm flow
   - helper server yang baca session/token
3. Pastikan jalur CS tidak masuk scope perubahan.
4. Tetapkan satu sumber kebenaran identitas admin lokal.

### Phase 1. Tambah Better Auth - DONE
1. Tambahkan package Better Auth di workspace admin utama.
2. Tambahkan env:
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL`
3. Tentukan adapter database yang dipakai.
4. Karena repo sudah pakai Drizzle + SQLite, gunakan adapter Drizzle ke database lokal.
5. Generate schema/migration Better Auth dengan CLI resmi.
6. Pastikan tabel auth baru bisa dibuat di database lokal tanpa mengganggu tabel lama.

### Phase 2. Buat auth server lokal - DONE
1. Buat `server/lib/auth.ts` atau lokasi setara yang mengekspor `auth`.
2. Konfigurasikan Better Auth sesuai docs resmi:
   - `emailAndPassword.enabled = true` bila login email/password dipakai
   - session disimpan lokal
   - plugin tambahan hanya jika memang dibutuhkan
3. Mount handler Nuxt di `server/api/auth/[...all].ts`.
4. Ikuti pola Nuxt integration resmi:
   - `auth.handler(toWebRequest(event))`
5. Pastikan route auth ini menjadi satu pintu untuk login/session/logout.

### Phase 3. Buat auth client Vue
1. Buat client wrapper lokal, misalnya `app/utils/auth-client.ts`.
2. Gunakan `better-auth/vue`.
3. Ekspor `authClient` dan helper yang dipakai UI.
4. Untuk SSR, pakai `authClient.useSession(useFetch)` sesuai docs resmi Nuxt.
5. Untuk client-only widget, pakai `authClient.useSession()` tanpa argumen.

### Phase 4. Ganti session bridge admin
1. Hapus dependency admin ke `useSupabaseClient`, `useSupabaseSession`, `useSupabaseUser`.
2. Ubah `useCurrentSession` agar membaca session Better Auth.
3. Ubah `useUserProfile` agar sumber profile lokal mengikuti Better Auth session/user.
4. Pastikan guard client tetap memblokir user nonaktif atau role invalid.
5. Login page harus memakai metode Better Auth resmi, bukan Supabase.

### Phase 5. Ganti guard server
1. Ubah helper server yang sekarang cek bearer Supabase menjadi cek session Better Auth.
2. Pakai `auth.api.getSession({ headers: event.headers })` sesuai docs resmi API.
3. Buat helper `requireAdminSession` baru yang:
   - ambil session dari Better Auth
   - validasi role
   - validasi status aktif
4. Cache session per request event bila perlu.
5. Semua route Nitro admin harus pakai helper ini.

### Phase 6. Adaptasi BFF Nitro
1. Pertahankan pola `repository / service / api`.
2. `server/services/admin-auth-service.ts` jadi penghubung session Better Auth.
3. `server/services/active-gas-service.ts` tetap allowlist action active.
4. `server/services/archive-service.ts` tetap gate archive access.
5. Browser tidak boleh pegang jalur GAS langsung.
6. Token/session untuk downstream tetap ditentukan server.

### Phase 7. Migrasi data identitas
1. Tentukan pemetaan dari data admin lama ke Better Auth user.
2. Kalau ada tabel lokal `user` lama, putuskan:
   - dipakai ulang sebagai source profile, atau
   - dimigrasikan ke schema Better Auth
3. Migrasikan field penting:
   - email/username
   - nama
   - role
   - status aktif
4. Siapkan script backfill idempotent.
5. Simpan rollback plan sebelum cutover.

### Phase 8. Bersihkan Supabase auth
1. Hapus pemakaian Supabase auth dari jalur admin.
2. Hapus middleware, composable, dan util yang khusus untuk session Supabase admin.
3. Sisakan Supabase hanya bila ada kebutuhan non-auth lain.
4. Jangan ubah CS/public flow.

### Phase 9. Test dan validasi
1. Tambahkan test untuk:
   - session validation Better Auth
   - login/logout flow
   - role guard
   - route Nitro admin
   - BFF action allowlist
2. Tambahkan test migrasi token/session di server.
3. Smoke test manual:
   - login admin
   - buka dashboard
   - buka archive
   - lakukan satu mutasi active
4. Pastikan CS tetap direct GAS dan tidak error.

### Phase 10. Rollout
1. Deploy auth baru ke staging dulu.
2. Verifikasi tabel auth dan session lokal terbentuk.
3. Verifikasi login lama tidak dipakai lagi di admin.
4. Setelah stabil, hapus sisa konfigurasi Supabase auth admin.
5. Dokumentasikan env, schema, dan alur login baru.

### Acceptance criteria
- Admin auth tidak lagi bergantung ke Supabase.
- Session admin valid lewat Better Auth lokal.
- Nitro BFF tetap jalan untuk active/archive.
- CS tidak berubah.
- Typecheck dan test lulus.

## Status Saat Ini
- Better Auth lokal sudah menjadi jalur auth admin.
- Supabase auth admin dan fallback `admin_token`/bearer legacy sudah dibersihkan.
- `pnpm db:generate` dan `pnpm db:push` sudah dijalankan oleh user.
- File SQLite lokal sudah terbentuk.
- CS/public tetap di luar scope dan jangan disentuh.

## Next Implementation
1. Buat mekanisme bootstrap admin pertama di SQLite Better Auth.
2. Pastikan admin lokal bisa login via `/login` memakai Better Auth.
3. Migrasikan Settings > Members dari action GAS lama ke API Nitro lokal.
4. Gunakan pola `repository / service / api` untuk member management.
5. Fitur member lokal:
   - list users dari tabel Better Auth `user`
   - create/invite user lokal
   - update nama/role/status aktif
   - deactivate user
6. Setelah member management lokal stabil, hapus action admin user lama yang masih lewat Apps Script.
7. Verifikasi full flow: login, guard role, dashboard, member CRUD, logout.


curl -X POST http://localhost:3000/api/admin/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"email":"ari_s@seid.sharp-world.com","full_name":"Admin","password":"password-min-8"}'