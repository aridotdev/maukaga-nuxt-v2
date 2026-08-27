# Plan: Pisah Project CS Static & Admin - Monorepo, CS Tanpa Node Runtime

## Context

Project `maukaga-nuxt` adalah satu Nuxt 4 app yang saat ini menggabungkan halaman publik Cabang/CS tanpa login dan halaman Admin yang butuh login. Tantangan deployment di kantor: **tidak tersedia Node runtime untuk menjalankan app di server kantor**. Node tetap tersedia di PC development untuk install dependency dan menjalankan proses build.

PRD menjelaskan bahwa bagian Cabang/CS secara produk adalah frontend publik/statis yang memanggil Google Apps Script API. Karena itu, bagian CS harus bisa dideploy sebagai **static artifact**: HTML, CSS, JS, dan asset hasil build. Node hanya dibutuhkan saat development/build, bukan saat runtime di kantor.

Saat ini build root Nuxt menghasilkan `.output/` Nitro server untuk mode server. Output seperti ini butuh runtime Node dan tidak cocok untuk deployment CS di kantor. Selain itu, lock route admin belum cukup kuat bila CS dan Admin masih satu Nuxt app, karena middleware redirect bukan security boundary dan kode admin berisiko ikut ter-bundle.

## Hasil Penelusuran Best Practice Nuxt 4

Rujukan resmi yang dipakai:

- Nuxt Deployment v4.4.4: https://nuxt.com/docs/4.x/getting-started/deployment
- Nuxt Prerendering v4.4.4: https://nuxt.com/docs/4.x/getting-started/prerendering
- Nuxt Rendering Modes v4.4.4: https://nuxt.com/docs/4.x/guide/concepts/rendering
- Nuxt Config v4.4.4: https://nuxt.com/docs/4.x/api/nuxt-config

Inti best practice yang relevan:

1. Nuxt app dapat dideploy sebagai Node server, static hosting, serverless, atau edge/CDN. Untuk CS yang tidak boleh memakai Node runtime, target yang tepat adalah **static hosting**.
2. `nuxt generate` menghasilkan output static di `.output/public/` dan folder ini dapat dideploy ke static hosting.
3. Static Nuxt memiliki dua pendekatan resmi:
   - SSG dengan `ssr: true`, yaitu route diprerender saat build.
   - Static SPA dengan `ssr: false`, yaitu satu entry HTML dan bundle JS client-side.
4. Untuk aplikasi internal yang sangat interaktif, tidak butuh SEO, memakai browser API seperti `localStorage`, upload file, dan print, pendekatan **static SPA** sering lebih sederhana dan robust.
5. Untuk static hosting dengan path subfolder, Nuxt menyediakan `app.baseURL`. Built asset directory relatif terhadap `baseURL`.
6. Runtime config yang bersifat `public` akan terekspos ke frontend. Jangan simpan secret di bundle static.
7. Static hosting adalah jalur produksi yang lebih baik daripada `file://`. `file://` boleh menjadi fallback distribusi, tetapi wajib diuji khusus karena routing, asset path, MIME type, dan fallback behavior browser berbeda dari static web server.

## Outcome yang Diharapkan

1. App `cs-web` build-nya **100% static** dan bisa dideploy tanpa Node runtime di kantor.
2. Runtime kantor untuk CS cukup static hosting: IIS, Apache, Nginx, internal web server, shared intranet static host, atau static object hosting yang disetujui IT.
3. `file://` tetap didukung sebagai fallback distribusi zip bila benar-benar tidak ada static hosting, tetapi bukan jalur utama best practice.
4. App `admin-web` tetap dipisahkan dari CS. Admin dapat tetap menjadi Node/Nitro app bila tersedia VPS/server Node, tetapi tidak menjadi syarat deployment CS.
5. Halaman `/login`, `/confirm`, `/dashboard/**`, middleware admin, composable admin, dan server API admin **tidak ada sama sekali** di source/build `cs-web`.
6. Shared code yang aman untuk publik dipakai bersama via workspace/layer: types, utils, CSS, dan composable publik.
7. Setelah deploy CS final dan stabil, `apps/admin-web` yang sama dapat memiliki **local fullstack admin mirror mode** di PC developer/admin dengan SQLite sebagai cache/read replica dari Google Sheets.
8. Migration dilakukan bertahap. Build lama tetap jalan sampai cut-over.

---

## Arsitektur Target

```text
maukaga-nuxt/
|-- pnpm-workspace.yaml
|-- package.json
|-- tsconfig.base.json
|-- .env
|-- .gitignore
|
|-- apps/
|   |-- cs-web/                         # STATIC, no Node runtime at office
|   |   |-- nuxt.config.ts
|   |   |-- package.json
|   |   |-- app.vue
|   |   |-- app.config.ts
|   |   |-- pages/                      # HANYA halaman publik CS
|   |   |-- layouts/cs.vue
|   |   |-- public/
|   |   |   |-- favicon.ico
|   |   |   |-- robots.txt
|   |   |   `-- config.json             # optional runtime config untuk static artifact
|   |   `-- tsconfig.json
|   |
|   `-- admin-web/                      # Admin only; Node/Nitro optional sesuai infra
|       |-- nuxt.config.ts
|       |-- package.json
|       |-- app.vue
|       |-- app.config.ts
|       |-- pages/                      # HANYA login/confirm/dashboard/admin
|       |-- layouts/dashboard.vue
|       |-- middleware/
|       |-- composables/
|       |-- components/
|       |-- server/                     # hanya jika admin memang memakai Nitro server atau local mirror
|       |-- db/                         # schema/migrations SQLite untuk local mirror
|       |-- scripts/                    # seed/sync/maintenance lokal
|       |-- public/
|       `-- tsconfig.json
|
|-- packages/
|   `-- shared/                         # @maukaga/shared Nuxt layer/package
|       |-- package.json
|       |-- nuxt.config.ts
|       |-- index.ts
|       `-- runtime/
|           |-- composables/
|           |-- utils/
|           |-- types/
|           `-- css/
|
|-- doc/prd.md
|-- README.md
`-- implementation-steps.md
```

Catatan workspace: `pnpm-workspace.yaml` saat ini sudah berisi konfigurasi `allowBuilds` dan `onlyBuiltDependencies`. Saat menambahkan `packages:`, **jangan replace isi lama**.

Contoh target akhir:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

allowBuilds:
  '@parcel/watcher': true
  esbuild: true
  maplibre-gl: true
  unrs-resolver: true
  vue-demi: true

onlyBuiltDependencies:
  - '@parcel/watcher'
  - esbuild
  - maplibre-gl
  - unrs-resolver
  - vue-demi
```

---

## Strategi Deployment CS Tanpa Node Runtime

### Jalur Utama: Static Hosting Internal

1. Build dilakukan di PC developer atau CI yang punya Node:

   ```bash
   pnpm install
   pnpm build:cs
   ```

2. Artifact yang dikirim ke kantor hanya:

   ```text
   apps/cs-web/.output/public/
   ```

3. Folder tersebut dideploy ke static host internal, misalnya:
   - IIS static site
   - Apache/Nginx static site
   - intranet web server
   - shared static hosting dari IT
   - object/static hosting internal

4. Server kantor tidak perlu menjalankan `node`, `pnpm`, `nuxt`, atau Nitro.

### Fallback: Zip dan `file://`

Fallback ini hanya dipakai bila static hosting tidak tersedia sama sekali.

Syarat tambahan:

1. Semua asset harus bisa dimuat dari hasil extract zip.
2. Test manual wajib dilakukan dengan double-click `index.html`.
3. Routing deep link seperti `/new` tidak boleh dianggap pasti jalan dari `file://`.
4. Bila `file://` menjadi kebutuhan keras, pertimbangkan static SPA dengan hash routing atau satu entry `index.html` agar navigasi tidak bergantung pada server rewrite.
5. API call ke Google Apps Script tetap memakai `Content-Type: text/plain;charset=utf-8` untuk menghindari preflight CORS seperti implementasi lama.

---

## Rendering Mode untuk `cs-web`

Rekomendasi default untuk CS:

```ts
export default defineNuxtConfig({
  ssr: false,
  nitro: {
    preset: 'static'
  }
})
```

Alasan:

- CS adalah aplikasi internal/interaktif, bukan halaman SEO.
- Banyak fitur bergantung browser: `localStorage`, upload file, print, query resume token, dan API call client-side.
- Static SPA lebih mudah dipaketkan sebagai artifact tanpa server runtime.
- Risiko hydration mismatch lebih kecil dibanding memaksa SSR untuk form/print yang berat di browser.

Alternatif jika ingin HTML tiap route sudah diprerender:

```ts
export default defineNuxtConfig({
  ssr: true,
  nitro: {
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        '/new',
        '/final-submit',
        '/check-status',
        '/print-ulang',
        '/403'
      ],
      ignore: [
        '/login',
        '/confirm',
        '/dashboard',
        '/dashboard/**',
        '/admin',
        '/admin/**'
      ]
    }
  }
})
```

Catatan: bila memakai SSG, jangan hanya prerender `/`. Semua route CS yang harus bisa dibuka langsung perlu masuk `nitro.prerender.routes` atau harus bisa ditemukan crawler melalui link HTML.

---

## Konfigurasi Kunci `apps/cs-web/nuxt.config.ts`

Rekomendasi awal untuk CS static SPA:

```ts
const defaultAppsScriptApiUrl = 'https://script.google.com/macros/s/AKfycbxAikXauXo-Ct_FfawqXjrdMxa3K-cK6eyBZFuG74IlrVNW2bE2vwX4BLsEo-CS7AwIyA/exec'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  extends: ['../../packages/shared'],
  modules: [
    '@nuxt/fonts',
    '@nuxt/ui',
    '@nuxt/eslint'
  ],
  nitro: {
    preset: 'static'
  },
  app: {
    // Untuk static host subfolder, set saat build via env:
    // NUXT_APP_BASE_URL=/maukaga-cs/
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
  },
  runtimeConfig: {
    public: {
      appsScriptApiUrl: process.env.NUXT_PUBLIC_APPS_SCRIPT_API_URL || defaultAppsScriptApiUrl,
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'Mau KaGa',
      maxUploadMb: Number(process.env.NUXT_PUBLIC_MAX_UPLOAD_MB || 10),
      maxItems: Number(process.env.NUXT_PUBLIC_MAX_ITEMS || 10)
    }
  }
})
```

Important:

- Jangan masukkan `@nuxtjs/supabase` di `cs-web` bila halaman CS tidak memakai Supabase.
- Jangan ada folder `server/` di `cs-web`.
- Jangan ada middleware auth admin di `cs-web`.
- Jangan ada import ke composable admin di `cs-web`.
- Jangan simpan secret di `runtimeConfig.public`.

### Runtime Config Static yang Lebih Fleksibel

Karena build static akan membundel nilai `runtimeConfig.public`, gunakan `public/config.json` bila konfigurasi perlu diubah tanpa rebuild:

```json
{
  "appsScriptApiUrl": "https://script.google.com/macros/s/.../exec",
  "appName": "Mau KaGa",
  "maxUploadMb": 10,
  "maxItems": 10
}
```

Lalu `cs-web` memuat config ini saat startup dengan `$fetch('/config.json')` atau fallback ke `runtimeConfig.public`. Untuk deployment subfolder, pastikan path config mengikuti `app.baseURL`.

---

## Konfigurasi `apps/admin-web`

Admin tetap dipisahkan agar tidak bocor ke CS.

Ada dua opsi:

### Opsi A - Admin Node/Nitro, jika tersedia VPS/server Node

```ts
export default defineNuxtConfig({
  ssr: true,
  extends: ['../../packages/shared'],
  nitro: {
    preset: 'node-server'
  }
})
```

Output admin dijalankan dengan:

```bash
node .output/server/index.mjs
```

### Opsi B - Admin Static SPA, jika tidak tersedia Node sama sekali

Gunakan hanya bila semua action admin bisa langsung ke Google Apps Script/Supabase/approved serverless backend dan tidak perlu server route Nuxt.

```ts
export default defineNuxtConfig({
  ssr: false,
  extends: ['../../packages/shared'],
  nitro: {
    preset: 'static'
  }
})
```

Konsekuensi:

- `server/api/admin-action.post.ts` harus dihapus/diganti.
- Action admin user management yang saat ini melewati `/api/admin-action` harus dipindahkan ke Google Apps Script atau serverless function yang disetujui.
- Security tetap harus divalidasi di backend, bukan hanya route guard frontend.

Untuk kebutuhan saat ini, fokus utama adalah **CS static tanpa Node runtime**. Admin Node boleh tetap direncanakan terpisah dan tidak menghalangi deployment CS.

---

## Tahap 2 Opsional: Offline/Local-First Mode di `apps/admin-web` dengan SQLite

Setelah deployment CS static selesai dan stabil, app admin yang sama (`apps/admin-web`) dapat diberi mode fullstack lokal di PC yang punya Node runtime. Ini **bukan app admin kedua**. Tujuannya bukan mengganti Google Apps Script/Sheets sebagai backend utama, tetapi membuat pengalaman dashboard admin lebih mulus dengan membaca data dari SQLite lokal.

### Prinsip Arsitektur

```text
CS static di kantor
  -> Google Apps Script
  -> Google Sheets sebagai source of truth

Admin-web mode lokal di PC lokal
  -> SQLite local sebagai read replica/cache
  -> background sync dari Google Apps Script/Google Sheets
  -> write-through admin action ke Google Apps Script
```

Prinsip penting:

1. Google Sheets tetap **source of truth** pada tahap awal.
2. SQLite lokal adalah **read replica/cache**, bukan database utama.
3. Dashboard `apps/admin-web` membaca dari SQLite saat berjalan dalam mode lokal agar filter, search, pagination, detail, dan statistik terasa cepat.
4. Admin action yang mengubah data tetap dikirim ke Google Apps Script terlebih dahulu.
5. Setelah Google Apps Script sukses, SQLite lokal di-update secara optimistic-safe atau record terkait di-sync ulang.
6. CS tidak berubah: upload data, submit final, dan cek status tetap langsung ke Google Apps Script.
7. Mode normal admin dan mode local mirror tetap berada di codebase admin yang sama; bedanya ada di konfigurasi/runtime mode dan sumber baca data.

### Mode Sync yang Direkomendasikan

Mulai dari mode aman:

```text
pull sync berkala
  Google Apps Script/Sheets -> SQLite

write-through action
  Admin UI -> Google Apps Script -> SQLite local update/resync
```

Hindari pada tahap awal:

```text
Admin UI -> SQLite dulu -> nanti sync ke Google Sheets
```

Mode local-first penuh seperti itu memang mungkin, tetapi butuh retry queue, idempotency key, conflict handling, audit log, status sync, dan recovery saat koneksi/API gagal. Kerjakan hanya setelah read replica dan write-through stabil.

### Data Lokal yang Dicerminkan ke SQLite

Minimal mirror table:

- `pengajuan`
- `pengajuan_items`
- `model_produk`
- `warranty_cards`
- `print_layouts`
- `status_log`
- `sync_state`
- `sync_log`
- optional: `pending_mutations`, hanya untuk fase offline writes nanti

Kolom kontrol yang disarankan:

- `source_updated_at`, bila tersedia dari Apps Script/Sheets
- `local_synced_at`
- `source_hash`, untuk deteksi perubahan bila `updated_at` belum konsisten
- `sync_status`
- `last_sync_error`

Jika Google Sheets belum punya `updated_at` yang konsisten di semua sheet, mulai dari full sync berkala atau checksum per row. Setelah itu tambahkan endpoint incremental seperti:

```text
getChangesSince({ since: "2026-06-10T10:00:00Z" })
```

### Batasan dan Keamanan

1. SQLite lokal menyimpan data operasional admin, jadi PC lokal harus dianggap environment internal yang sensitif.
2. Jangan simpan secret Google/Supabase/service role di frontend. Secret hanya boleh di server lokal atau environment variable lokal.
3. Semua perubahan status, approval, layout, dan print marker tetap divalidasi ulang oleh Google Apps Script.
4. Conflict policy awal: Google Sheets menang, kecuali action admin baru saja sukses dan memiliki response resmi dari backend.
5. Sync harus idempotent: menjalankan sync dua kali tidak boleh menggandakan data.
6. Tambahkan audit `sync_log` untuk melihat kapan sync terakhir sukses/gagal dan action apa yang tertunda.

---

## File-File Penting Refactor Map

### Halaman CS ke `apps/cs-web/pages/`

- `index.vue` - portal launcher/layout CS
- `new.vue` - form pengajuan baru
- `final-submit.vue` - upload hard copy/final submit
- `check-status.vue` - cek status publik
- `print-ulang.vue` - print ulang
- `403.vue` - forbidden/catch state publik
- Optional: `[...slug].vue` untuk fallback 404/redirect ke `/`

### Halaman Admin ke `apps/admin-web/pages/`

- `login.vue`
- `confirm.vue`
- `dashboard.vue`
- `dashboard/index.vue`
- `dashboard/pengajuan/index.vue`
- `dashboard/pengajuan/[idPengajuan].vue`
- `dashboard/cetak-kartu.vue`
- `dashboard/cetak-label-pengiriman.vue`
- `dashboard/settings/index.vue`
- `dashboard/settings/layout-kartu.vue`
- `dashboard/settings/members.vue`
- `dashboard/settings/security.vue`
- `dashboard/settings/product-name.vue`
- `403.vue`

### Shared Public-Safe Code ke `packages/shared`

- `types/print.ts`
- `types/database.types.ts`
- `utils/print.ts`
- `utils/index.ts`
- `assets/css/main.css`
- `usePrintWithFilename.ts`
- `useAppsScriptApi.ts`, dengan refactor penting:
  - token admin tidak dibaca otomatis dari `sessionStorage` di shared composable.
  - token opsional dipass eksplisit oleh caller.
  - CS memanggil action publik tanpa token.
  - Admin memanggil action admin dengan token dari session admin.

### Admin-Only Code Tetap di `apps/admin-web`

- `useAdminApi.ts`
- `useAuthBridge.ts`
- `useCurrentSession.ts`
- `useDashboard.ts`
- `useDashboardData.ts`
- `usePengajuanDetail.ts`
- `useReviewProductQueue.ts`
- `useUserProfile.ts`
- `useAppSheetQuery.ts`, bila hanya dipakai admin
- `middleware/auth.global.ts`
- `middleware/auth-guard.ts`
- `middleware/guest-guard.ts`
- `middleware/role-guard.ts`
- semua komponen dashboard/admin
- `server/api/admin-action.post.ts`, hanya bila admin tetap Node/Nitro

---

## Sequence Implementasi Bertahap

Urutan besar implementasi:

1. **Finalisasi deploy app CS** sampai benar-benar bisa dipakai tanpa Node runtime di kantor.
2. **Kerjakan offline/local-first admin mirror** setelah jalur CS stabil.

### Fase 1 - Finalisasi Deploy App CS

Target fase ini: CS static app selesai, aman dari kebocoran admin bundle, dan bisa dideploy ke static hosting internal atau fallback zip.

#### Tahap 1 - Setup Workspace Tanpa Mengganggu Build Lama

1. Update `pnpm-workspace.yaml` dengan `packages`, tapi pertahankan `allowBuilds` dan `onlyBuiltDependencies` yang sudah ada.
2. Tambah scripts root:

   ```json
   {
     "build:cs": "pnpm --filter @maukaga/cs-web generate",
     "preview:cs": "pnpm --filter @maukaga/cs-web preview",
     "dev:cs": "pnpm --filter @maukaga/cs-web dev",
     "build:admin": "pnpm --filter @maukaga/admin-web build",
     "dev:admin": "pnpm --filter @maukaga/admin-web dev",
     "dev:admin:local": "pnpm --filter @maukaga/admin-web dev:local",
     "sync:admin:local": "pnpm --filter @maukaga/admin-web sync"
   }
   ```

3. Buat skeleton awal:
   - `apps/cs-web/`
   - `apps/admin-web/`
   - `packages/shared/`
4. Buat `package.json` tiap app/package.
5. Jalankan `pnpm install` di root.

#### Tahap 2 - Isi Shared Package untuk CS

1. Pindahkan public-safe types, utils, CSS, dan print helper.
2. Refactor `useAppsScriptApi.ts` agar generic dan token opsional eksplisit.
3. Buat `packages/shared/nuxt.config.ts` sebagai layer untuk CSS dan auto-import composables bila cocok.
4. Buat `packages/shared/index.ts` untuk barrel export type/utils.
5. Pastikan shared package tidak membawa dependency admin-only atau Supabase-only ke CS.

#### Tahap 3 - Bangun `apps/cs-web`

1. Buat `apps/cs-web/nuxt.config.ts` dengan target static SPA.
2. Copy `app.vue`, `app.config.ts`, `layouts/cs.vue`.
3. Copy hanya pages CS.
4. Hapus dependency yang tidak dipakai CS, terutama Supabase bila tidak diperlukan.
5. Update import dari `~/types`, `~/utils`, `~/composables` ke shared package/layer.
6. Tambahkan fallback route `[...slug].vue` bila static host membutuhkan fallback yang jelas.
7. Build:

   ```bash
   pnpm build:cs
   ```

8. Pastikan artifact deploy hanya:

   ```text
   apps/cs-web/.output/public/
   ```

#### Tahap 4 - Verifikasi dan Finalisasi Deploy CS

1. Jalankan static host test dengan `python -m http.server` dari `.output/public/`.
2. Jalankan fallback `file://` test bila distribusi zip tetap dibutuhkan.
3. Jalankan bundle leak test untuk memastikan tidak ada route/action/admin token di build CS.
4. Test workflow CS end-to-end:
   - buka portal
   - buat draft
   - print form
   - lanjutkan draft
   - submit final dengan upload file valid
   - cek status
5. Dokumentasikan cara deploy CS di README:
   - build di PC/CI yang punya Node
   - upload/copy `.output/public/` ke static hosting internal
   - fallback zip hanya jika tidak ada static hosting
6. Setelah CS lulus, jadikan `apps/cs-web` sebagai artifact produksi untuk cabang.

### Fase 2 - Offline/Local-First Mode di `apps/admin-web`

Target fase ini: app admin yang sama (`apps/admin-web`) dapat berjalan dalam mode lokal di PC kamu, membaca SQLite agar lebih cepat, sementara Google Apps Script/Sheets tetap menjadi source of truth.

#### Tahap 5 - Baseline Admin Tetap Satu App

1. Copy admin pages, middleware, components, composables, dan optional server API ke `apps/admin-web`.
2. Pastikan tidak ada import admin dari `apps/cs-web`.
3. Jalankan admin existing mode untuk memastikan fitur login/dashboard masih sama seperti sebelum refactor.
4. Tambahkan mode lokal di `apps/admin-web`, bukan membuat app admin baru. Mode lokal dapat dikontrol via env/config, misalnya `ADMIN_DATA_SOURCE=sqlite` atau script `dev:local`.
5. Pastikan mode normal tetap bisa membaca Apps Script langsung bila SQLite/local mirror belum diaktifkan.

#### Tahap 6 - Setup SQLite dan Sync Skeleton

1. Tambahkan folder SQLite ke `apps/admin-web`, misalnya `apps/admin-web/db/`.
2. Tambahkan SQLite library/migration tool yang dipilih ke `apps/admin-web`.
3. Buat schema awal:
   - `pengajuan`
   - `pengajuan_items`
   - `model_produk`
   - `warranty_cards`
   - `print_layouts`
   - `status_log`
   - `sync_state`
   - `sync_log`
4. Buat command `sync` di package `@maukaga/admin-web` untuk full sync dari Google Apps Script ke SQLite.
5. Buat halaman/status kecil untuk melihat waktu sync terakhir, jumlah row, dan error terakhir.

#### Tahap 7 - Dashboard Admin Baca dari SQLite

1. Buat Nitro server routes lokal untuk query SQLite:
   - list pengajuan
   - detail pengajuan
   - dashboard summary
   - print queue
   - layout list
2. Ubah dashboard admin saat mode lokal agar membaca dari SQLite, bukan langsung Apps Script.
3. Pertahankan shape response agar UI tidak perlu refactor besar.
4. Tambahkan search/filter/pagination di SQLite agar dashboard terasa cepat.

#### Tahap 8 - Write-Through Admin Actions

1. Untuk action yang mengubah data, kirim request ke Google Apps Script terlebih dahulu.
2. Jika sukses, update SQLite lokal atau sync ulang record terkait.
3. Catat action dan hasilnya di `sync_log`.
4. Pastikan action idempotent bila user retry.
5. Jika Apps Script gagal, jangan anggap SQLite sebagai data final.

#### Tahap 9 - Incremental Sync dan Offline Writes Opsional

1. Tambahkan endpoint Apps Script `getChangesSince` bila data sudah cukup besar.
2. Gunakan `updated_at` atau `source_hash` untuk mengurangi full sync.
3. Tambahkan `pending_mutations` hanya bila benar-benar butuh admin bisa bekerja saat internet/API putus.
4. Untuk offline writes, wajib ada:
   - idempotency key
   - retry queue
   - conflict policy
   - audit log
   - UI status pending/synced/failed
5. Jangan aktifkan offline writes sebelum read replica dan write-through stabil.

#### Tahap 10 - Cut-over dan Dokumentasi

1. Setelah `cs-web` dan `admin-web` lulus test dalam mode normal serta mode local mirror, hapus/migrasikan source lama di root `app/` secara bertahap.
2. Pastikan root `nuxt.config.ts` tidak lagi menjadi source utama produksi.
3. Update README:
   - deploy CS static
   - run admin web normal mode
   - run admin web local mirror mode
   - run sync
   - troubleshooting sync
4. Update `implementation-steps.md` dengan status fase 1 dan fase 2.

---

## Verifikasi Wajib CS Static

### Static Host Test

1. Jalankan:

   ```bash
   pnpm build:cs
   ```

2. Serve artifact secara lokal:

   ```bash
   cd apps/cs-web/.output/public
   python -m http.server 8080
   ```

3. Buka `http://localhost:8080`.
4. Test halaman:
   - `/`
   - `/new`
   - `/final-submit`
   - `/check-status`
   - `/print-ulang`
   - route tidak dikenal
5. Test workflow:
   - load model produk dari Apps Script
   - simpan draft
   - print form
   - lanjutkan draft
   - submit final dengan upload file dummy yang valid
   - cek status
6. Pastikan tidak ada request ke endpoint admin atau `/api/admin-action`.

### Fallback `file://` Test

1. Zip `apps/cs-web/.output/public/`.
2. Extract ke folder lain.
3. Double-click `index.html`.
4. Test minimal:
   - halaman utama muncul
   - asset CSS/JS termuat
   - navigasi utama jalan
   - fetch ke Apps Script jalan
   - localStorage jalan
   - upload file dan print tidak error
5. Bila route path tidak jalan dari `file://`, dokumentasikan bahwa produksi wajib static hosting atau ubah ke hash routing/static SPA fallback.

### Bundle Leak Test

Dari folder `apps/cs-web/.output/public/`, cek bundle:

```bash
rg "signInWithPassword|admin_token|/dashboard|adminUsersList|admin-action|markWarrantyCardsPrinted|approveModelProduk" .
```

Expected:

- Tidak ada string admin/auth dashboard di bundle CS.
- Tidak ada `/api/admin-action`.
- Tidak ada admin-only action.

Catatan: bila ada kata generik seperti `admin` dari teks dokumentasi/error yang tidak berbahaya, review manual sebelum dianggap gagal.

---

## Verifikasi `admin-web` Local Mirror Mode

Verifikasi ini dikerjakan setelah fase CS final.

1. Jalankan full sync pertama:

   ```bash
   pnpm sync:admin:local
   ```

2. Pastikan SQLite berisi jumlah row yang masuk akal untuk sheet utama:
   - `pengajuan`
   - `pengajuan_items`
   - `model_produk`
   - `warranty_cards`
   - `print_layouts`
3. Jalankan `admin-web` dalam mode lokal:

   ```bash
   pnpm dev:admin:local
   ```

4. Test dashboard:
   - summary tampil dari SQLite
   - search/filter/pagination cepat
   - detail pengajuan tampil
   - antrean cetak tampil
   - layout cetak tampil
5. Test write-through:
   - ubah status dari admin lokal
   - Google Apps Script sukses menerima update
   - Google Sheets berubah
   - SQLite lokal ikut berubah atau record terkait berhasil di-sync ulang
6. Simulasikan Apps Script gagal:
   - UI menampilkan error
   - SQLite tidak dianggap sebagai final state palsu
   - `sync_log` mencatat kegagalan
7. Jalankan sync ulang dua kali. Expected: data tidak dobel dan hasil tetap konsisten.

---

## Security Notes

1. Memisahkan source/build CS dan Admin adalah kontrol utama agar bundle CS tidak membawa logic admin.
2. Route guard/middleware frontend bukan security boundary.
3. Semua action admin tetap harus divalidasi di backend dengan token/session valid.
4. Public API URL boleh ada di bundle; secret tidak boleh.
5. Resume token draft harus diperlakukan sebagai secret.
6. `runtimeConfig.public` dan file `public/config.json` dapat dibaca user browser. Jangan simpan service role key, private token, password, atau secret backend di sana.
7. Apps Script harus tetap memvalidasi action publik/admin, input, status, ukuran file, token, dan session.
8. SQLite local mirror menyimpan data operasional admin; file database lokal harus diperlakukan sebagai data sensitif.
9. Pada fase awal, Google Sheets tetap source of truth. SQLite tidak boleh menjadi sumber final untuk status sebelum action backend sukses.
10. Offline writes hanya boleh diaktifkan setelah ada retry queue, idempotency key, conflict policy, dan audit log.

---

## Dokumentasi Deployment untuk README

Tambahkan ringkasan seperti ini:

~~~md
## Build CS Static

CS tidak membutuhkan Node runtime di server kantor. Node hanya diperlukan di mesin build.

```bash
pnpm install
pnpm build:cs
```

Deploy isi folder berikut ke static hosting internal:

```text
apps/cs-web/.output/public/
```

Recommended runtime: IIS/Apache/Nginx/static intranet host.
Fallback: zip folder `.output/public/`, extract di PC cabang, lalu buka `index.html`; fallback ini wajib diuji karena `file://` tidak sama dengan static hosting.
~~~

---

## Keputusan Final

Untuk kebutuhan kantor yang tidak menyediakan Node runtime, `prompt.md` harus mengarahkan implementasi sebagai berikut:

1. **CS dipisah menjadi app static sendiri.**
2. **CS dibuild di PC developer/CI yang punya Node.**
3. **Runtime kantor hanya menyajikan file static dari `.output/public/`.**
4. **Static hosting internal adalah best practice utama.**
5. **`file://` adalah fallback, bukan target produksi utama.**
6. **Admin tetap dipisah dan boleh Node/Nitro bila infrastrukturnya tersedia, tetapi tidak boleh menghambat deployment CS.**
7. **Tidak ada admin source, route, middleware, composable, atau server API di build CS.**
8. **Setelah CS final, local mirror dengan SQLite dikerjakan sebagai mode di `apps/admin-web` yang sama untuk mempercepat dashboard dan workflow admin di PC lokal.**
9. **Google Apps Script/Google Sheets tetap source of truth pada fase awal; SQLite adalah read replica/cache dengan write-through action.**
10. **Tidak ada app admin kedua; `apps/admin-web` tetap satu-satunya app admin.**
