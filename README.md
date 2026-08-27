# Mau KaGa Nuxt

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Build CS Static

CS tidak membutuhkan Node runtime di server kantor. Node hanya diperlukan di mesin build atau CI.

```bash
pnpm install
pnpm sync:cs
pnpm build:cs
```

`pnpm build:cs` otomatis menjalankan `pnpm sync:cs` sebelum `nuxt generate`, jadi artifact CS selalu mengikuti halaman publik CS dari root app.

### Update Versi Build Manual

Jika build hanya untuk `cs-web` lalu hasilnya dicopy ke repo Cloudflare Pages lain, naikkan versi sebelum build:

```bash
npm version patch --no-git-tag-version
pnpm build:cs
```

Gunakan `minor` untuk fitur kecil dan `major` untuk perubahan besar. ganti teks `patch` dengan `minor` atau `major`. Nomor versi dari `package.json` akan tampil di app CS, misalnya `v0.1.1`.



Untuk memberi kode build manual:

```bash
NUXT_PUBLIC_APP_REVISION=manual-001 pnpm build:cs
```

Catatan: `apps/cs-web/layouts/cs.vue` dan `apps/cs-web/pages/403.vue` sengaja menjadi override khusus CS static, sehingga tidak ditimpa oleh sync dari root app.

Untuk mengecek apakah `apps/cs-web` sudah sama dengan root CS app tanpa mengubah file:

```bash
pnpm sync:cs:check
```

Deploy isi folder berikut ke static hosting internal:

```text
apps/cs-web/.output/public/
```

Recommended runtime: IIS, Apache, Nginx, static intranet host, atau static hosting internal lain yang disetujui IT.

Fallback: zip folder `apps/cs-web/.output/public/`, extract di PC cabang, lalu buka `index.html`. Fallback ini wajib diuji karena `file://` tidak sama dengan static hosting untuk routing, asset path, MIME type, dan fetch browser.

Untuk deployment di subfolder, set base URL saat build:

```bash
NUXT_APP_BASE_URL=/maukaga-cs/ pnpm build:cs
```

Artifact produksi CS harus tetap bebas dari halaman, route, middleware, composable, dan server API admin.

## Launch CS Static ke Cloudflare Pages

### 1. Siapkan Google Apps Script

1. Buka project Google Apps Script.
2. Paste isi `doc/Code.gs` ke editor Apps Script.
3. Jalankan fungsi `setupApp()` sekali dari editor.
4. Beri authorization saat diminta.
5. Pastikan sheet sudah terbentuk dan `Config -> DRIVE_FOLDER_ID` sudah terisi.
6. Klik `Deploy -> New deployment`.
7. Pilih type `Web app`.
8. Set `Execute as` ke `Me`.
9. Set `Who has access` ke `Anyone`.
10. Deploy, lalu copy URL web app yang berakhiran `/exec`.

Tes URL Apps Script di browser:

```text
https://script.google.com/macros/s/.../exec?action=ping
```

Jika response JSON sukses, backend Apps Script sudah aktif.

Jika ada perubahan `Code.gs`, update deployment yang sama lewat `Deploy -> Manage deployments -> Edit -> New version -> Deploy`. URL `/exec` tetap sama selama deployment yang dipakai tidak diganti.

### 2. Direct Upload ke Cloudflare Pages

Direct Upload cocok jika build dilakukan di PC lokal, lalu hasil static diupload manual ke Cloudflare Pages.

Buat file env lokal:

```text
apps/cs-web/.env
```

Isi dengan URL Apps Script production:

```env
NUXT_PUBLIC_APPS_SCRIPT_API_URL=https://script.google.com/macros/s/.../exec
```

Build ulang CS web:

```bash
pnpm build:cs
```

Upload folder ini ke Cloudflare Pages Direct Upload:

```text
apps/cs-web/.output/public
```

Pastikan root folder yang diupload langsung berisi file/folder berikut:

```text
index.html
200.html
404.html
_nuxt/
```

### 3. Git Integration Cloudflare Pages

Jika Cloudflare Pages tersambung ke repo Git, gunakan konfigurasi berikut:

```text
Build command:
pnpm build:cs

Build output directory:
apps/cs-web/.output/public
```

Tambahkan environment variable di Cloudflare Pages:

```text
NUXT_PUBLIC_APPS_SCRIPT_API_URL=https://script.google.com/macros/s/.../exec
```

Tambahkan `NUXT_PUBLIC_APP_NAME`, `NUXT_PUBLIC_MAX_UPLOAD_MB`, atau `NUXT_PUBLIC_MAX_ITEMS` hanya jika perlu override nilai default.

Catatan: untuk Direct Upload, environment variable Cloudflare tidak memengaruhi file yang sudah dibuild lokal. Pastikan `.env` lokal sudah benar sebelum menjalankan `pnpm build:cs`.

### 4. Smoke Test Production

Setelah Pages aktif, tes alur berikut:

1. Buka halaman utama CS.
2. Buka form pengajuan baru.
3. Buat draft dan pastikan ID pengajuan muncul.
4. Buka `final-submit` dari draft yang sama.
5. Upload hard copy, submit final, dan pastikan status berubah menjadi `Baru`.
6. Cek status memakai ID Pengajuan atau Nomor Seri.

## Production Root App

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
