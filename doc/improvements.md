# IMPROVEMENT

## Guard Duplikat Model + Nomor Seri
Sudah aku implementasikan guard berbasis **gabungan `Model + Nomor Seri`**.

Perubahan utama:
- [app/pages/new.vue](/home/arsya/sharp/maukaga-nuxt/app/pages/new.vue:51): validasi frontend sekarang menolak item duplikat dalam satu form, dengan pesan “Model dan nomor seri sudah sama dengan item #...”.
- [apps/cs-web/pages/new.vue](/home/arsya/sharp/maukaga-nuxt/apps/cs-web/pages/new.vue:51): tersinkron dari root CS page.
- [doc/Code.gs](/home/arsya/sharp/maukaga-nuxt/doc/Code.gs:427): backend Apps Script sekarang mengecek duplikasi sebelum create via `submitPengajuan`.
- [doc/Code.gs](/home/arsya/sharp/maukaga-nuxt/doc/Code.gs:467): backend mengecek saat save/update draft.
- [doc/Code.gs](/home/arsya/sharp/maukaga-nuxt/doc/Code.gs:653): backend mengecek ulang saat final submit.
- [doc/Code.gs](/home/arsya/sharp/maukaga-nuxt/doc/Code.gs:3416): helper baru membaca `PengajuanItems`, menormalisasi model dan nomor seri, lalu menolak jika kombinasi itu sudah ada di ID pengajuan lain.

Perilaku sekarang:
- Duplikat dalam form langsung kena notifikasi frontend.
- Duplikat terhadap database akan ditolak dari backend dengan pesan berisi ID pengajuan existing.
- Update draft/final submit tetap boleh memakai item milik ID pengajuan yang sama, karena guard mengecualikan `currentId`.

Verifikasi:
- `pnpm typecheck` sukses.
- `node scripts/sync-cs-web.mjs --check` sukses.
- Lint terarah untuk `app/pages/new.vue` dan `apps/cs-web/pages/new.vue` sukses.
- `pnpm lint` global masih gagal karena error lama yang tidak terkait di `HomeChart.client.vue` dan beberapa file CS naming. Aku tidak ubah itu.

Catatan penting: perubahan backend ada di `doc/Code.gs`, jadi perlu deployment Apps Script agar guard ini aktif di sistem live.

