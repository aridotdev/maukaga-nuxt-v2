# MAUKAGA Nuxt

MAUKAGA adalah aplikasi Pengajuan Cetak Ulang Kartu Garansi berbasis Nuxt/Nitro.

Single source of truth produk, arsitektur, lifecycle data, env, dan gap implementasi ada di [doc/prd.md](doc/prd.md).

## Status Overhaul

Repo ini sedang berada pada reset awal untuk overhaul fullstack Nuxt tunggal.
Banyak modul legacy untuk Google Apps Script, source split `active/archive/local`,
sync arsip, service/repository lama, composable lama, dan test server lama sudah
dihapus dari working tree.

Kondisi ini disengaja sebagai titik awal fresh. Sampai API, service, repository,
dan composable unified dibangun ulang, beberapa halaman dan endpoint lama masih
dapat mengacu ke modul yang sudah tidak ada. Detail kondisi reset dan pekerjaan
lanjutan ada di [implementation-plan.md](implementation-plan.md) dan
[doc/phase-0-baseline.md](doc/phase-0-baseline.md).

## Setup

```bash
pnpm install
```

Salin `.env.example` menjadi `.env`, lalu isi value sesuai environment lokal/staging/production. `.env` tidak dikomit.

## Development

```bash
pnpm dev
```

Target akhir root app menjalankan dashboard admin, Nitro API, Better Auth, dan
database lokal sebagai satu aplikasi. Pada status reset saat ini, `pnpm dev`,
`pnpm typecheck`, dan test dapat gagal sampai modul unified pengganti selesai
dibangun.

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
