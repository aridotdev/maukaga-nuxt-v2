# MAUKAGA Nuxt

MAUKAGA adalah aplikasi Pengajuan Cetak Ulang Kartu Garansi dengan arsitektur hybrid active-archive.

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

Root app menjalankan admin Nuxt/Nitro, API active proxy, archive API, Better Auth, dan SQLite archive.

## CS Static Build

CS static tidak membutuhkan Node runtime di server kantor.

```bash
pnpm build:cs
```

Artifact yang dideploy:

```text
apps/cs-web/.output/public/
```

Untuk deployment di subfolder:

```bash
NUXT_APP_BASE_URL=/maukaga-cs/ pnpm build:cs
```

## Verification

```bash
pnpm sync:cs:check
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

Default archive file directory: `public/arsip_file`.