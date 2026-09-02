# Cara Setup Awal MAUKAGA

Panduan ini dipakai untuk setup pertama kali dari repo kosong sampai app bisa dipakai untuk alur CS, admin, dan sinkronisasi data `Local`.

Catatan posisi setup saat ini:

- Selesai: `doc/Code.gs` sudah dicopy ke Google Apps Script.
- Selesai: function `setupApp()` sudah dijalankan.
- Selesai: Google Apps Script sudah dideploy sebagai Web App.
- Selesai: URL Web App sudah dimasukkan ke `NUXT_APPS_SCRIPT_API_URL` dan `NUXT_PUBLIC_APPS_SCRIPT_API_URL`.
- Lanjutkan dari tahap 4 untuk melengkapi secret, auth admin, database, dan smoke test.

## 1. Prasyarat

Siapkan:

- Node.js LTS yang kompatibel dengan Nuxt 4.
- `pnpm`.
- Akun Google yang punya akses ke Google Apps Script, Google Sheets, dan Google Drive.
- URL deployment Google Apps Script Web App, formatnya biasanya `https://script.google.com/macros/s/.../exec`.

Install dependency dari root repo:

```bash
pnpm install
```

## 2. Setup Google Apps Script

Jika mengulang dari awal:

1. Buka Google Apps Script.
2. Copy isi `doc/Code.gs` ke file `Code.gs` di GAS.
3. Jalankan function `setupApp()`.
4. Beri izin akses Google Sheets, Drive, Mail, dan trigger jika diminta.
5. Cek log hasil `setupApp()`. Script akan menampilkan `Spreadsheet ID` dan `Drive folder ID`.
6. Buka spreadsheet yang dibuat/dipakai, lalu cek sheet berikut sudah ada:
   `Pengajuan`, `PengajuanItems`, `EmailRecipients`, `Config`, `StatusLog`, `EmailLog`, `PrintBatch`, `PrintLayouts`, dan `ModelProduk`.
7. Buka sheet `Config`, pastikan `DRIVE_FOLDER_ID` sudah terisi.

Admin Nuxt dibuat lewat bootstrap Better Auth lokal, bukan lewat Google Apps Script.

Jika ingin memakai spreadsheet yang sudah ada, isi `SPREADSHEET_ID` di Script Properties atau isi konstanta `APP.SPREADSHEET_ID` sebelum menjalankan `setupApp()`.

## 3. Deploy Google Apps Script

Deploy sebagai Web App:

1. Klik `Deploy` -> `New deployment`.
2. Pilih type `Web app`.
3. `Execute as`: pilih akun pemilik script.
4. `Who has access`: pilih akses yang sesuai environment. Untuk CS static yang diakses browser user, endpoint harus bisa diakses oleh browser user tersebut.
5. Deploy, lalu copy URL Web App `/exec`.

Tes endpoint GAS:

```powershell
Invoke-RestMethod "https://script.google.com/macros/s/ISI_ID_DEPLOYMENT/exec?action=ping"
```

Response sehat berisi `success: true`, nama app, dan waktu server.

Setiap kali `Code.gs` berubah, update deployment GAS lewat `Deploy` -> `Manage deployments` -> edit deployment -> pilih version baru. Jika URL deployment berubah, update `.env` juga.

## 4. Lengkapi `.env`

Copy `.env.example` menjadi `.env` jika belum ada:

```powershell
Copy-Item .env.example .env
```

Isi minimal untuk development lokal:

```ini
DATABASE_URL=file:.data/maukaga.db
NUXT_DATABASE_URL=file:.data/maukaga.db

NUXT_APP_URL=http://localhost:3000
NUXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000

BETTER_AUTH_SECRET=ISI_RANDOM_SECRET_BETTER_AUTH
ADMIN_BOOTSTRAP_TOKEN=ISI_RANDOM_TOKEN_BOOTSTRAP

NUXT_APPS_SCRIPT_API_URL=https://script.google.com/macros/s/ISI_ID_DEPLOYMENT/exec
NUXT_PUBLIC_APPS_SCRIPT_API_URL=https://script.google.com/macros/s/ISI_ID_DEPLOYMENT/exec

NUXT_GAS_BRIDGE_SECRET=ISI_RANDOM_SECRET_BRIDGE_GAS
GAS_BRIDGE_SECRET=ISI_RANDOM_SECRET_BRIDGE_GAS

NUXT_ARCHIVE_FILE_DIRECTORY=public/arsip_file
ARCHIVE_FILE_DIRECTORY=public/arsip_file
NUXT_PUBLIC_ARCHIVE_FILE_BASE_PATH=/arsip_file

NUXT_PUBLIC_APP_NAME=Mau KaGa
NUXT_PUBLIC_MAX_UPLOAD_MB=10
NUXT_PUBLIC_MAX_ITEMS=10
```

Buat secret acak dengan Node:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Gunakan secret berbeda untuk `BETTER_AUTH_SECRET`, `ADMIN_BOOTSTRAP_TOKEN`, dan `NUXT_GAS_BRIDGE_SECRET`. Khusus `NUXT_GAS_BRIDGE_SECRET` dan `GAS_BRIDGE_SECRET`, nilainya harus sama persis.

Untuk setup lokal saat ini, key yang wajib kamu lengkapi setelah URL GAS adalah:

- `NUXT_GAS_BRIDGE_SECRET`
- `GAS_BRIDGE_SECRET`
- `NUXT_APP_URL`
- `NUXT_PUBLIC_APP_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_TRUSTED_ORIGINS`
- `BETTER_AUTH_SECRET`
- `ADMIN_BOOTSTRAP_TOKEN`

## 5. Set Script Properties di GAS

Buka Apps Script -> `Project Settings` -> `Script Properties`, lalu tambahkan:

```text
GAS_BRIDGE_SECRET=ISI_RANDOM_SECRET_BRIDGE_GAS
```

Nilainya harus sama persis dengan `NUXT_GAS_BRIDGE_SECRET` dan `GAS_BRIDGE_SECRET` di `.env`.

## 6. Siapkan Database Lokal

Database default ada di `.data/maukaga.db`. Folder `.data` di-ignore dari git.

Push schema Drizzle ke SQLite:

```bash
pnpm db:push
```

Opsional untuk melihat isi database:

```bash
pnpm db:studio
```

Jalankan `pnpm db:generate` hanya kalau schema database berubah dan kamu memang ingin membuat migration baru.

## 7. Jalankan App Admin Lokal

Start dev server:

```bash
pnpm dev
```

Buka:

```text
http://localhost:3000
```

Halaman admin utama:

- Login admin: `http://localhost:3000/login`
- Dashboard admin: `http://localhost:3000/dashboard`

Halaman CS/public yang juga bisa dites dari root app:

- Form baru: `http://localhost:3000/new`
- Upload final: `http://localhost:3000/final-submit`
- Cek status: `http://localhost:3000/check-status`
- Panduan: `http://localhost:3000/panduan`

## 8. Buat Admin Pertama

Bootstrap admin hanya bisa dilakukan saat database user masih kosong.

Pastikan `pnpm dev` sedang berjalan, lalu jalankan dari terminal lain:

```powershell
$body = @{
  email = "admin@example.com"
  full_name = "Administrator"
  password = "Minimal8Karakter"
  bootstrapToken = "ISI_ADMIN_BOOTSTRAP_TOKEN_DARI_ENV"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/admin/bootstrap" `
  -ContentType "application/json" `
  -Body $body
```

```bash
curl -X POST "http://localhost:3000/api/admin/bootstrap" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@maukaga.com",
    "full_name": "Administrator",
    "password": "qwertyuiop",
    "bootstrapToken": "Ua6oCqfAclKIOTebJmCAigHsdkw5Us0g"
  }'
```

Jika berhasil, login lewat:

```text
http://localhost:3000/login
```

Setelah login sebagai `admin`, user tambahan bisa dibuat dari:

```text
/dashboard/settings/members
```

Role yang tersedia:

- `admin`: akses penuh, termasuk finalisasi sync Local.
- `qrcc`: proses/review operasional tertentu.
- `management`: akses baca dashboard/pengajuan.

Untuk sync Local dengan `finalize: true`, gunakan akun role `admin` karena GAS action `finalizeArchivedPengajuan` hanya menerima admin.

## 9. Smoke Test Active Data

Tes jalur data aktif dari admin Nuxt ke GAS:

1. Login sebagai admin.
2. Buka `/dashboard`.
3. Pastikan source di dashboard berada di `Active`.
4. Buka `/dashboard/pengajuan`.
5. Data aktif dari Google Sheets harus bisa tampil.

Jika error:

- `URL Google Apps Script belum dikonfigurasi`: cek `NUXT_APPS_SCRIPT_API_URL`.
- `GAS_BRIDGE_SECRET/NUXT_GAS_BRIDGE_SECRET belum dikonfigurasi`: cek `.env`.
- `Script Property GAS_BRIDGE_SECRET belum dikonfigurasi`: cek Script Properties di GAS.
- `Signature bridge tidak valid`: samakan ulang nilai secret di `.env` dan GAS.
- `Unauthorized`: login ulang atau cek akun admin aktif.

## 10. Smoke Test Flow CS

Tes jalur public CS langsung ke GAS:

1. Buka `/new`.
2. Buat draft pengajuan test.
3. Lanjut ke `/final-submit`.
4. Upload hardcopy PDF.
5. Upload bukti JPG/JPEG jika flow meminta bukti.
6. Submit sampai mendapat ID pengajuan, contohnya `KG-YYYYMMDD-0001`.
7. Buka `/check-status`, cari ID pengajuan atau nomor seri.
8. Pastikan data muncul di Google Sheets `Pengajuan` dan `PengajuanItems`.

Batas default:

- Hardcopy: PDF, maksimal `NUXT_PUBLIC_MAX_UPLOAD_MB` atau Config `MAX_UPLOAD_MB`.
- Bukti: JPG/JPEG, maksimal Config `MAX_EVIDENCE_UPLOAD_MB`.
- Jumlah item: `NUXT_PUBLIC_MAX_ITEMS` atau Config `MAX_ITEMS`.

## 11. Smoke Test Admin Processing

Gunakan dashboard admin source `Active`:

1. Buka `/dashboard/pengajuan`.
2. Buka detail pengajuan test.
3. Review model produk jika status produk masih `needs_review`.
4. Untuk review model, buka `/dashboard/settings/product-name`.
5. Update status pengajuan sesuai proses sampai `Selesai`.

Lifecycle aktif:

```text
Menunggu Upload -> Baru -> Disetujui -> Diprint -> Dikirim -> Selesai
```

Data dengan status `Selesai` adalah kandidat untuk disync ke database Local.

## 12. Smoke Test Sync Local

Prasyarat:

- Login dengan role `admin`.
- `NUXT_GAS_BRIDGE_SECRET` di `.env` sama dengan `GAS_BRIDGE_SECRET` di GAS Script Properties.
- Ada minimal satu pengajuan status `Selesai`.
- File hardcopy/bukti masih tersedia di Drive folder upload.

Jalankan dari UI:

1. Buka dashboard admin.
2. Klik tombol refresh/sync di sidebar dengan tooltip `Sync data`.
3. Tunggu sampai status sync selesai.
4. Buka switcher source `Active` / `Local`.
5. Pilih `Local`.
6. Pastikan pengajuan yang sudah `Selesai` muncul di Local.

Efek sync normal:

- Data detail masuk ke SQLite `.data/maukaga.db`.
- File masuk ke `public/arsip_file`.
- Setelah file lokal aman, GAS memanggil finalisasi.
- Row aktif di Google Sheets dihapus.
- File Google Drive dipindahkan ke trash.

Endpoint internal yang dipakai UI:

```text
POST /api/local/sync
GET  /api/local/sync-status
```

Istilah UI memakai `Local`, dan route internal kini juga memakai namespace `local`.
Alias legacy `/api/archive/*` masih ada sementara untuk kompatibilitas.

Contoh payload sync manual:

```json
{
  "mode": "full",
  "limit": 10,
  "finalize": true
}
```

Contoh sync satu ID tanpa finalisasi, berguna untuk cek aman sebelum menghapus data aktif:

```json
{
  "mode": "detail",
  "idPengajuan": "KG-YYYYMMDD-0001",
  "finalize": false
}
```

Mode yang tersedia di schema: `full`, `changed`, `detail`, `background`, dan `manual`. Untuk tahap awal, gunakan `full` atau `detail`. Mode `changed` dan `background` belum menjadi incremental scheduler produksi.

## 13. Build dan Verifikasi

Sebelum deploy atau setelah perubahan besar:

```bash
pnpm sync:cs:check
pnpm typecheck
pnpm lint
pnpm test
```

Build admin/Nitro:

```bash
pnpm build
pnpm preview
```

Build CS static:

```bash
pnpm build:cs
```

Artifact CS static yang dideploy:

```text
apps/cs-web/.output/public/
```

Jika CS static dideploy di subfolder, set base URL sebelum build.

PowerShell:

```powershell
$env:NUXT_APP_BASE_URL = "/maukaga-cs/"
pnpm build:cs
```

Bash:

```bash
NUXT_APP_BASE_URL=/maukaga-cs/ pnpm build:cs
```

## 14. Catatan Deploy Production

Untuk production, isi env dengan URL production:

```ini
NUXT_APP_URL=https://admin-domain.example.com
NUXT_PUBLIC_APP_URL=https://admin-domain.example.com
BETTER_AUTH_URL=https://admin-domain.example.com
BETTER_AUTH_TRUSTED_ORIGINS=https://admin-domain.example.com
```

Pastikan:

- `BETTER_AUTH_SECRET`, `ADMIN_BOOTSTRAP_TOKEN`, dan `NUXT_GAS_BRIDGE_SECRET` memakai secret kuat.
- `GAS_BRIDGE_SECRET` di Script Properties GAS sama dengan `NUXT_GAS_BRIDGE_SECRET`.
- `DATABASE_URL` production menunjuk ke storage database yang persisten.
- `public/arsip_file` atau directory yang ditentukan `NUXT_ARCHIVE_FILE_DIRECTORY` ikut dipersist.
- `.env`, `.data`, dan `public/arsip_file` tidak dikomit ke git.

## 15. Troubleshooting Cepat

| Gejala | Cek |
| --- | --- |
| GAS ping gagal | Pastikan URL `/exec` benar dan deployment Web App bisa diakses user/browser. |
| Dashboard Active kosong | Cek data di Google Sheets, URL GAS, dan secret bridge. |
| Login admin gagal | Pastikan database sudah `pnpm db:push`, admin bootstrap berhasil, dan user aktif. |
| Bootstrap admin return 409 | Database sudah punya user. Gunakan user yang ada atau reset database hanya jika aman. |
| Local kosong | Pastikan ada pengajuan status `Selesai`, lalu jalankan sync sebagai admin. |
| Sync gagal karena signature | Samakan `NUXT_GAS_BRIDGE_SECRET`, `GAS_BRIDGE_SECRET`, dan Script Property `GAS_BRIDGE_SECRET`. |
| File tidak masuk `public/arsip_file` | Cek file Drive masih ada, `DRIVE_FOLDER_ID` benar, dan limit file tidak terlampaui. |
| Row GAS tidak terhapus setelah sync | Cek apakah `finalize` true, semua file lokal aman, dan user sync role `admin`. |

## 16. Urutan Ringkas Lanjutan Dari Posisimu

Karena URL GAS sudah kamu isi, lanjutkan urutan ini:

1. Buat secret acak untuk bridge GAS.
2. Isi `NUXT_GAS_BRIDGE_SECRET` dan `GAS_BRIDGE_SECRET` di `.env` dengan nilai yang sama.
3. Isi Script Property GAS `GAS_BRIDGE_SECRET` dengan nilai yang sama.
4. Lengkapi env auth lokal: `NUXT_APP_URL`, `NUXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `BETTER_AUTH_SECRET`, dan `ADMIN_BOOTSTRAP_TOKEN`.
5. Jalankan `pnpm db:push`.
6. Jalankan `pnpm dev`.
7. Bootstrap admin pertama lewat `POST /api/admin/bootstrap`.
8. Login ke `/login`.
9. Tes dashboard source `Active`.
10. Buat pengajuan test dari `/new` dan `/final-submit`.
11. Proses pengajuan sampai `Selesai`.
12. Klik `Sync data` di sidebar dashboard.
13. Pindah source ke `Local` dan pastikan data/file sudah masuk lokal.
14. Jalankan `pnpm typecheck`, `pnpm lint`, dan `pnpm test`.
