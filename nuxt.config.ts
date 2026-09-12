// https://nuxt.com/docs/api/configuration/nuxt-config
import { createPublicAppBuildInfo } from './config/app-version'
import { DEFAULT_DATABASE_URL } from './config/database'
import {
  DEFAULT_BACKUP_DIRECTORY,
  DEFAULT_PENGAJUAN_FILE_DIRECTORY,
} from './config/storage'

const publicAppBuildInfo = createPublicAppBuildInfo()

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/fonts', '@nuxt/ui', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  icon: {
    clientBundle: {
      scan: {
        ignoreCollections: ['ph'],
      },
    },
    serverBundle: {
      collections: ['lucide', 'simple-icons'],
    },
  },
  runtimeConfig: {
    databaseUrl: import.meta.env.NUXT_DATABASE_URL || import.meta.env.DATABASE_URL || DEFAULT_DATABASE_URL,
    pengajuanFileDirectory: import.meta.env.NUXT_PENGAJUAN_FILE_DIRECTORY || DEFAULT_PENGAJUAN_FILE_DIRECTORY,
    backupDirectory: import.meta.env.NUXT_BACKUP_DIRECTORY || DEFAULT_BACKUP_DIRECTORY,
    appUrl: import.meta.env.NUXT_APP_URL || import.meta.env.NUXT_PUBLIC_APP_URL || '',
    public: {
      ...publicAppBuildInfo,
      appName: import.meta.env.NUXT_PUBLIC_APP_NAME || 'Mau KaGa',
      maxUploadMb: Number(import.meta.env.NUXT_PUBLIC_MAX_UPLOAD_MB || 10),
      maxItems: Number(import.meta.env.NUXT_PUBLIC_MAX_ITEMS || 10),
    },
  },

  routeRules: {
    '/login': { ssr: false },
    '/confirm': { ssr: false },
    '/403': { ssr: false },
    '/dashboard/**': { ssr: false },
  },
  vite: {
    optimizeDeps: {
      include: [
        '@internationalized/date',
        '@tanstack/table-core',
        '@unovis/vue',
        '@vueuse/core',
        'better-auth/client/plugins',
        'better-auth/vue',
        'date-fns',
        'zod',
      ],
    },
  },
})
