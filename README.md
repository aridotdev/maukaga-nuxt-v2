# MAUKAGA Nuxt

MAUKAGA adalah aplikasi Pengajuan Cetak Ulang Kartu Garansi berbasis Nuxt/Nitro.

Single source of truth produk, arsitektur, lifecycle data, env, dan gap implementasi ada di [doc/prd.md](doc/prd.md).

## Setup

```bash
pnpm install
```

Salin `.env.example` menjadi `.env`, lalu isi value sesuai environment lokal/staging/production. `.env` tidak dikomit.

## Development

```bash
pnpm dev
```

Root app menjalankan halaman CS, dashboard admin, Nitro API, Better Auth, dan database lokal.

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

Default local file directory: `public/arsip_file`.
