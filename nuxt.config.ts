// https://nuxt.com/docs/api/configuration/nuxt-config
import { createPublicAppBuildInfo } from './config/app-version'
import {
  DEFAULT_ARCHIVE_FILE_DIRECTORY,
  DEFAULT_ARCHIVE_PUBLIC_BASE_PATH,
  DEFAULT_DATABASE_URL,
} from './config/database'

const defaultAppsScriptApiUrl = 'https://script.google.com/macros/s/AKfycbxAikXauXo-Ct_FfawqXjrdMxa3K-cK6eyBZFuG74IlrVNW2bE2vwX4BLsEo-CS7AwIyA/exec'
const publicAppBuildInfo = createPublicAppBuildInfo()

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/fonts', '@nuxt/ui', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    appsScriptApiUrl: import.meta.env.NUXT_APPS_SCRIPT_API_URL || import.meta.env.NUXT_PUBLIC_APPS_SCRIPT_API_URL || defaultAppsScriptApiUrl,
    gasBridgeSecret: import.meta.env.NUXT_GAS_BRIDGE_SECRET || import.meta.env.GAS_BRIDGE_SECRET || '',
    databaseUrl: import.meta.env.NUXT_DATABASE_URL || import.meta.env.DATABASE_URL || DEFAULT_DATABASE_URL,
    archiveFileDirectory: import.meta.env.NUXT_ARCHIVE_FILE_DIRECTORY || import.meta.env.ARCHIVE_FILE_DIRECTORY || DEFAULT_ARCHIVE_FILE_DIRECTORY,
    appUrl: import.meta.env.NUXT_APP_URL || import.meta.env.NUXT_PUBLIC_APP_URL || '',
    public: {
      ...publicAppBuildInfo,
      appsScriptApiUrl: import.meta.env.NUXT_PUBLIC_APPS_SCRIPT_API_URL || defaultAppsScriptApiUrl,
      archiveFileBasePath: import.meta.env.NUXT_PUBLIC_ARCHIVE_FILE_BASE_PATH || DEFAULT_ARCHIVE_PUBLIC_BASE_PATH,
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
        'zod',
        '@unovis/vue',
        '@vueuse/core',
        'date-fns',
        '@tanstack/table-core',
      ],
    },
  },
})
