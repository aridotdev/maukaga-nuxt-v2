// https://nuxt.com/docs/api/configuration/nuxt-config
import { createPublicAppBuildInfo } from './config/app-version'
import {
  DEFAULT_ARCHIVE_FILE_DIRECTORY,
  DEFAULT_ARCHIVE_PUBLIC_BASE_PATH,
  DEFAULT_DATABASE_URL,
} from './config/database'

const defaultAppsScriptApiUrl = 'https://script.google.com/macros/s/AKfycbxAikXauXo-Ct_FfawqXjrdMxa3K-cK6eyBZFuG74IlrVNW2bE2vwX4BLsEo-CS7AwIyA/exec'
const publicAppBuildInfo = createPublicAppBuildInfo()
const supabaseUrl = import.meta.env.NUXT_SUPABASE_URL || import.meta.env.NUXT_PUBLIC_SUPABASE_URL || ''
const supabasePublishableKey = import.meta.env.NUXT_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.NUXT_PUBLIC_SUPABASE_KEY
  || ''
const supabaseSecretKey = import.meta.env.NUXT_SUPABASE_SECRET_KEY
  || import.meta.env.NUXT_SUPABASE_SERVICE_ROLE_KEY
  || import.meta.env.NUXT_PUBLIC_SUPABASE_SECRET_KEY
  || import.meta.env.SUPABASE_SECRET_KEY
  || import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  || ''

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/fonts', '@nuxt/ui', '@nuxt/eslint', '@nuxtjs/supabase'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    appsScriptApiUrl: import.meta.env.NUXT_APPS_SCRIPT_API_URL || import.meta.env.NUXT_PUBLIC_APPS_SCRIPT_API_URL || defaultAppsScriptApiUrl,
    databaseUrl: import.meta.env.NUXT_DATABASE_URL || import.meta.env.DATABASE_URL || DEFAULT_DATABASE_URL,
    archiveFileDirectory: import.meta.env.NUXT_ARCHIVE_FILE_DIRECTORY || import.meta.env.ARCHIVE_FILE_DIRECTORY || DEFAULT_ARCHIVE_FILE_DIRECTORY,
    supabaseUrl,
    supabasePublishableKey,
    supabaseSecretKey,
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
  supabase: {
    redirect: false,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/', '/login', '/confirm', '/403'],
    },
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 2,
      sameSite: 'lax',
      secure: import.meta.env.NODE_ENV === 'production',
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