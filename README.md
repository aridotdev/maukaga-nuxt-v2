# MAUKAGA Nuxt

MAUKAGA adalah aplikasi Pengajuan Cetak Ulang Kartu Garansi berbasis Nuxt/Nitro.

Single source of truth produk, arsitektur, lifecycle data, env, dan gap
implementasi ada di [doc/prd.md](doc/prd.md). Keputusan domain dan aturan
schema yang dikunci untuk Fase 2 ada di
[doc/design-decisions.md](doc/design-decisions.md).

## Status Overhaul

Repo ini sudah melewati reset dan implementasi Fase 2 untuk memulai overhaul
fullstack Nuxt tunggal. Schema database unified, migration baru, Better Auth,
dan dashboard shell minimal sudah tersedia. Modul draft, source split,
archive/sync, serta halaman operasional lama sudah dihapus.

Workflow API, service domain, form pengajuan, cetak, dan pengiriman akan
dibangun pada fase berikutnya di atas schema baru. Generator ID pengajuan Fase 3
sudah tersedia di server dan siap dipakai oleh workflow pembuatan pengajuan.
Detail keputusan dan urutan kerja ada di [implementation-plan.md](implementation-plan.md),
[doc/phase-0-baseline.md](doc/phase-0-baseline.md), dan
[doc/design-decisions.md](doc/design-decisions.md).

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
ADMIN_SEED_PASSWORD="$ADMIN_SEED_PASSWORD" \
pnpm db:seed:admin
unset ADMIN_SEED_PASSWORD
```

Seed bersifat idempotent: pemanggilan ulang tidak mengganti password akun yang
sudah ada. Ganti password awal setelah login pertama dan jangan menyimpan
nilainya di repository atau `.env` production.

## Development

```bash
pnpm dev
```

Target akhir root app menjalankan dashboard admin, Nitro API, Better Auth, dan
database lokal sebagai satu aplikasi. Saat ini dashboard masih berupa shell
minimal sampai API dan workflow operasional fase berikutnya dibangun.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
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
