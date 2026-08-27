# route pengajuan mutations through Nuxt API

Anda berperan sebagai senior software engineer lakukan rekayasa balik arsitektur dan pahami alur data secara lengkap kode yang terkait dengan detail [idPengajuan].vue
Kemudian, identifikasi:
- Keputusan arsitektur yang buruk
- kode yang membuat lama ketika halaman ini dibuka
- Logika yang duplikat atau kode yang bermasalah
- Masalah atau risiko skalabilitas
- Masalah pemeliharaan
Terakhir, berikan:
- Penjelasan arsitektur yang singkat dan jelas
- Area masalah kritis yang membuat lama
- Strategi refactoring
- Kode tingkat produksi yang lebih baik
Jangan mengubah fungsionalitas lain yang tidak terkait dengan detail pengajuan [idPengajuan].vue, hanya tingkatkan kualitas kode, skalabilitas, dan pemeliharaan.


response :
Saya sudah lakukan reverse engineering dan refactor terbatas di jalur detail pengajuan, tanpa mengubah UI `[idPengajuan].vue`.

**Arsitektur**
Alur data sekarang:
`[idPengajuan].vue` -> `usePengajuanDetail()` -> `useAdminCacheQuery()` -> `/api/admin-cache/pengajuan/:id` -> SQLite admin cache -> background sync ke Apps Script bila perlu. Mutasi item/status masih langsung ke Apps Script dari client, lalu cache detail/list dipatch optimistik dan sync detail dipicu ulang.

**Masalah Kritis**
Penyebab utama halaman lama dibuka ada di endpoint detail: sebelumnya request akan menunggu `syncAdminCache(... mode: 'detail')` kalau ada item tanpa `produkStatus`. Karena data dari list cache sering belum punya `produkStatus`, first open bisa ikut menunggu Apps Script sampai timeout 30 detik.

Masalah arsitektur lain:
- Read path lewat Nuxt server cache, write path langsung dari client ke Apps Script. Ini bikin konsistensi cache sulit dijaga.
- Ada beberapa cache store yang dipatch manual, sehingga gampang stale.
- `useAdminCacheQuery` sebelumnya mengunci cache key pada path awal, kurang aman untuk route dinamis.
- Halaman detail terlalu gemuk: state form, validasi, formatting, Drive URL parsing, dialog confirm, dan UI berada di satu SFC.

**Perubahan Kode**
- [useAdminCacheApi.ts](<D:/ARISAFARI/Works/Project Applications/maukaga-nuxt/app/composables/useAdminCacheApi.ts:85>) sekarang menerima path/params reaktif dan mengambil entry cache berdasarkan key request saat fetch.
- [usePengajuanDetail.ts](<D:/ARISAFARI/Works/Project Applications/maukaga-nuxt/app/composables/usePengajuanDetail.ts:97>) sekarang memakai `detailPath` computed dan reload saat `idPengajuan` berubah.
- [usePengajuanDetail.ts](<D:/ARISAFARI/Works/Project Applications/maukaga-nuxt/app/composables/usePengajuanDetail.ts:266>) sekarang patch detail cache ke `admin-cache-query-store`, bukan hanya store legacy.
- [[id].get.ts](<D:/ARISAFARI/Works/Project Applications/maukaga-nuxt/server/api/admin-cache/pengajuan/[id].get.ts:16>) sekarang hanya blocking sync kalau detail tidak ada atau jumlah item > 0 tapi item cache kosong. Kalau detail cache ada, halaman bisa tampil cepat dan sync enrichment jalan background.

**Strategi Refactor Lanjutan**
Langkah berikut yang paling sehat: pindahkan helper status/decision/date/Drive URL dari SFC ke util domain pengajuan, ekstrak form review item/status ke composable kecil, lalu pindahkan mutasi Apps Script ke Nitro endpoint agar read/write satu boundary dan cache invalidation lebih terkendali.

Validasi: `pnpm lint` sempat berhasil. `pnpm typecheck` pertama menemukan satu error type guard, sudah saya perbaiki, tapi rerun typecheck ditolak oleh approval sehingga verifikasi TypeScript final belum bisa saya konfirmasi dari command. `app/pages/dashboard/pengajuan/index.vue` sudah modified di working tree, tetapi saya tidak menyentuh file itu.


prompt : 
bantu aku jelaskan singkat saja tentang rekomendasi Strategi Refactor Lanjutan

response :
Strategi refactor lanjutannya singkatnya begini:

1. **Pisahkan logic domain pengajuan**
   Helper seperti status pengajuan, warna badge, label keputusan item, format tanggal, dan validasi transisi sebaiknya dipindah dari `.vue` ke file util/composable khusus. Tujuannya supaya list dan detail tidak punya logic kembar.

2. **Pecah halaman detail jadi composable + komponen kecil**
   `[idPengajuan].vue` sekarang memegang terlalu banyak tanggung jawab: fetch data, form item, form status, dialog confirm, lampiran foto, riwayat, dan formatting. Lebih sehat kalau form review item/status dipindah ke composable atau komponen terpisah.

3. **Satukan jalur baca dan tulis lewat backend Nuxt**
   Saat ini data dibaca dari `/api/admin-cache/...`, tapi update masih langsung dari browser ke Apps Script. Idealnya update item/status juga lewat Nitro server API, lalu server yang update Apps Script dan patch/sync cache. Ini bikin auth, error handling, dan cache lebih konsisten.

4. **Rapikan cache invalidation**
   Sekarang ada beberapa store yang dipatch manual. Ke depan lebih baik punya satu mekanisme invalidasi/detail refresh yang jelas, supaya setelah edit/delete/status update tidak ada data stale di halaman lain.

Prioritas saya: mulai dari nomor 3 dulu kalau fokusnya stabilitas data, atau nomor 2 dulu kalau fokusnya maintainability halaman detail.

prompt:
khusus nomo3, di percakapan kita sebelumnya ini adalah rekomendasimu sendiri, sekarang kamu merekomendasikan terbalik. 

pastikan mana yang sesuai dengan yang best practice industri.

response:

Benar, untuk **best practice industri**, rekomendasi yang paling sesuai adalah:

**Frontend tidak langsung update ke Apps Script. Mutasi sebaiknya lewat backend Nuxt/Nitro.**

Arsitektur yang ideal:

```text
Browser
  -> Nuxt Server API / Nitro
    -> validasi auth + role
    -> panggil Apps Script / source of truth
    -> update atau invalidate admin-cache
    -> return response normalized ke frontend
```

Jadi:

```text
Read:
Browser -> /api/admin-cache/pengajuan/:id -> SQLite cache -> background sync

Write:
Browser -> /api/admin-cache/pengajuan/:id/status
        -> Nuxt server
        -> Apps Script
        -> patch/sync SQLite cache
```

Kalau sebelumnya saya pernah menyarankan tetap direct ke Apps Script, itu lebih cocok sebagai **solusi transisi/minimal change**, bukan arsitektur produksi jangka panjang.

Kenapa backend-first lebih best practice:

1. **Security lebih kuat**
   Token, validasi role, dan akses Apps Script tidak tersebar di browser.

2. **Consistency lebih bagus**
   Karena layer yang menulis data juga bisa langsung update/invalidate cache.

3. **Observability lebih mudah**
   Error, retry, audit log, dan latency bisa dicatat di server.

4. **Maintenance lebih rapi**
   Frontend cukup tahu API internal Nuxt, bukan detail Apps Script.

5. **Scalability lebih aman**
   Kalau nanti Apps Script diganti database/API lain, frontend tidak perlu berubah banyak.

Jadi keputusan final saya: **untuk produksi, gunakan Nuxt/Nitro sebagai backend/BFF untuk read dan write.** Direct Apps Script dari client hanya dipertahankan sementara kalau ingin migrasi bertahap.
