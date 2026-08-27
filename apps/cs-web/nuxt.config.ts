import { createPublicAppBuildInfo } from '../../config/app-version'

const defaultAppsScriptApiUrl = 'https://script.google.com/macros/s/AKfycbxAikXauXo-Ct_FfawqXjrdMxa3K-cK6eyBZFuG74IlrVNW2bE2vwX4BLsEo-CS7AwIyA/exec'
const publicAppBuildInfo = createPublicAppBuildInfo()

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  extends: ['../../packages/shared'],
  modules: [
    '@nuxt/fonts',
    '@nuxt/ui',
    '@nuxt/eslint'
  ],
  nitro: {
    preset: 'static'
  },
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
  },
  runtimeConfig: {
    public: {
      ...publicAppBuildInfo,
      appsScriptApiUrl: process.env.NUXT_PUBLIC_APPS_SCRIPT_API_URL || defaultAppsScriptApiUrl,
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'Mau KaGa',
      maxUploadMb: Number(process.env.NUXT_PUBLIC_MAX_UPLOAD_MB || 10),
      maxItems: Number(process.env.NUXT_PUBLIC_MAX_ITEMS || 10)
    }
  },
  vite: {
    optimizeDeps: {
      include: [
        'zod'
      ]
    }
  }
})
