# MAUKAGA Nuxt

MAUKAGA adalah aplikasi Pengajuan Cetak Ulang Kartu Garansi berbasis Nuxt/Nitro.

Single source of truth produk, arsitektur, lifecycle data, env, dan gap
implementasi ada di [doc/prd.md](doc/prd.md). Keputusan domain dan aturan
schema yang dikunci untuk Fase 2 ada di
[doc/design-decisions.md](doc/design-decisions.md).

## Status Overhaul

Workflow utama sudah tersedia di aplikasi unified Nuxt/Nitro: autentikasi,
form pengajuan manual, upload dokumen, review item, status lifecycle, cetak
kartu, label pengiriman, layout kartu, master model produk, dan manajemen
anggota. Integrasi Apps Script, source split, archive, dan sync lama sudah
dihapus dari runtime.

Pekerjaan yang masih tersisa untuk acceptance MVP adalah dashboard summary/chart,
akses download file terproteksi, backup/restore operasional, test endpoint dan
smoke test browser penuh. Import Excel, reprint normal, dan approval override
surat pada saat create masih merupakan pekerjaan lanjutan atau parsial.
Checklist rinci ada di [implementation-plan.md](implementation-plan.md),
[doc/fase13.md](doc/fase13.md), dan [doc/fase14.md](doc/fase14.md).

## Setup

```bash
pnpm install
```

Salin `.env.example` menjadi `.env`, lalu isi value sesuai environment
lokal/staging/production. `.env` tidak dikomit. Untuk development, default
storage pengajuan adalah `storage/pengajuan` dan default backup adalah
`storage/backups`; keduanya dapat dioverride dengan
`NUXT_PENGAJUAN_FILE_DIRECTORY` dan `NUXT_BACKUP_DIRECTORY`.

Setelah database dibuat dengan `pnpm db:push`, buat akun admin awal melalui
environment command satu kali. Masukkan password hanya saat diminta dan jangan
menyimpannya di repository:

```bash
read -rsp 'Admin seed password: ' ADMIN_SEED_PASSWORD
echo
ADMIN_SEED_EMAIL=admin@maukaga.com \
ADMIN_SEED_NAME=administrator \
ADMIN_SEED_PASSWORD="qwertyuiop" \
pnpm db:seed:admin
unset ADMIN_SEED_PASSWORD
```

```powershell
node --import=dotenv/config --import=tsx scripts/seed-admin.ts
```

Seed bersifat idempotent: pemanggilan ulang tidak mengganti password akun yang
sudah ada. Ganti password awal setelah login pertama dan jangan menyimpan
nilainya di repository atau `.env` production.

## Development

```bash
pnpm dev
```

Root app menjalankan dashboard admin, Nitro API, Better Auth, dan database lokal
sebagai satu aplikasi. Workflow operasional yang sudah tersedia menggunakan
database dan storage aplikasi tunggal.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Database

```bash
pnpm db:generate
pnpm db:push
pnpm db:studio
```

Default local database: `.data/maukaga.db`.

Target default storage pengajuan: `storage/pengajuan`.

Target default backup: `storage/backups`.

### Import Model Produk

Siapkan CSV dengan kolom `model,produk,origin`. Origin boleh `local`,
`import`, atau dikosongkan untuk **Belum Dipilih**.

Preview terlebih dahulu:

```bash
pnpm db:import-model-produk -- ./.data/model-produk.csv
```

Simpan hasil import setelah preview sesuai:

```bash
pnpm db:import-model-produk -- ./.data/model-produk.csv --apply
```

Model duplikat atau yang sudah ada akan dilewati.
