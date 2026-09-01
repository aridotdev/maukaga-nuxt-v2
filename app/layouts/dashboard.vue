<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const toast = useToast()
const runTimeConfig = useRuntimeConfig()
const { isAdmin, isManagement, isQrcc } = useUserProfile()
const { resolveSourceQuery } = useDashboardDataSource()
const SOURCE_AWARE_NAVIGATION_PATHS = new Set(['/dashboard', '/dashboard/pengajuan'])
const {
  status: localSyncStatus,
  lastRun: localSyncLastRun,
  isLoading: isLocalSyncLoading,
  error: localSyncError,
  refreshStatus: refreshLocalSyncStatus,
  syncNow: syncLocalNow
} = useLocalSyncStatus()
const {
  rows: reviewProductRows,
  ensureLoaded: ensureReviewProductQueueLoaded
} = useReviewProductQueue()
const reviewProductInvalidations = useActiveInvalidationState()
const MANUAL_LOCAL_SYNC_MODE = 'manual' as const

const open = ref(false)
const localSyncLimit = ref(100)
const pendingProductReviewCount = computed(() =>
  reviewProductRows.value.reduce((total, group) => total + Number(group.count || 0), 0)
)
const productReviewBadge = computed(() =>
  pendingProductReviewCount.value > 0 ? String(pendingProductReviewCount.value) : undefined
)
const canReviewProductName = computed(() => isAdmin.value || isQrcc.value)
const canManualLocalSync = computed(() => isAdmin.value)
const localSyncMeta = computed(() => localSyncStatus.value?.meta || {})
const localSyncTone = computed(() => {
  if (localSyncError.value || localSyncMeta.value['archive_sync:last_status'] === 'failed') return 'text-error'
  if (localSyncStatus.value?.inProgress || isLocalSyncLoading.value) return 'text-warning'
  if (localSyncMeta.value['archive_sync:last_status'] === 'success' || (localSyncLastRun.value && localSyncLastRun.value.failureCount === 0)) return 'text-success'
  return 'text-muted'
})
const localSyncLabel = computed(() => {
  if (localSyncStatus.value?.inProgress || isLocalSyncLoading.value) return 'Sync lokal berjalan'
  if (localSyncError.value || localSyncMeta.value['archive_sync:last_status'] === 'failed') return 'Sync lokal gagal'
  if (localSyncLastRun.value) {
    return localSyncLastRun.value.failureCount > 0 ? 'Sync lokal selesai sebagian' : 'Sync lokal selesai'
  }
  if (localSyncMeta.value['archive_sync:last_status'] === 'success') return 'Sync lokal siap'
  return 'Belum ada sync lokal'
})
const localSyncSummary = computed(() => {
  if (localSyncError.value) {
    return localSyncError.value
  }

  if (localSyncLastRun.value) {
    return `${localSyncLastRun.value.processedIds.length} pengajuan • ${localSyncLastRun.value.successCount} sukses • ${localSyncLastRun.value.failureCount} gagal`
  }

  const processed = Number(localSyncMeta.value['archive_sync:last_processed_count'] || 0)
  const success = Number(localSyncMeta.value['archive_sync:last_success_count'] || 0)
  const failure = Number(localSyncMeta.value['archive_sync:last_failure_count'] || 0)

  if (processed > 0) {
    return `${processed} pengajuan • ${success} sukses • ${failure} gagal`
  }

  return `${localSyncStatus.value?.fileSummary.total || 0} file arsip`
})
const localSyncDetail = computed(() => {
  if (localSyncStatus.value?.inProgress || isLocalSyncLoading.value) {
    return 'Menunggu hasil sinkronisasi lokal.'
  }

  if (localSyncError.value) return localSyncError.value
  if (localSyncLastRun.value && localSyncLastRun.value.failureCount > 0) {
    return `Mode ${localSyncLastRun.value.mode} berjalan dengan sebagian kegagalan.`
  }

  const message = localSyncMeta.value['archive_sync:last_message']
  if (message) return message

  const finishedAt = localSyncMeta.value['archive_sync:last_finished_at']
  if (finishedAt) return `Terakhir selesai ${formatSyncStamp(finishedAt)}`

  return 'Sync lokal dijalankan manual oleh admin melalui dashboard.'
})

const links = [[{
  label: 'Home',
  icon: 'i-lucide-house',
  to: '/dashboard',
  exact: true,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Pengajuan',
  icon: 'i-lucide-files',
  to: '/dashboard/pengajuan',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Cetak Kartu Garansi',
  icon: 'i-lucide-printer',
  to: '/dashboard/cetak-kartu',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Cetak Label Pengiriman',
  icon: 'i-lucide-tag',
  to: '/dashboard/cetak-label-pengiriman',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Setting',
  to: '/dashboard/settings',
  icon: 'i-lucide-settings',
  defaultOpen: true,
  type: 'trigger',
  children: [{
    label: 'Product Name',
    to: '/dashboard/settings/product-name',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Layout Cetak',
    to: '/dashboard/settings/layout-kartu',
    exact: true,
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'User Management',
    to: '/dashboard/settings/members',
    onSelect: () => {
      open.value = false
    }
  }]
}]] satisfies NavigationMenuItem[][]

const visibleLinks = computed<NavigationMenuItem[][]>(() => {
  const primary: NavigationMenuItem[] = []

  for (const item of links[0] || []) {
    const to = String(item.to || '')

    if (isManagement.value && [
      '/dashboard/cetak-kartu',
      '/dashboard/cetak-label-pengiriman'
    ].includes(to)) {
      continue
    }

    if (to === '/dashboard/settings') {
      if (!isAdmin.value && !isQrcc.value) continue

      primary.push({
        ...item,
        children: item.children?.filter((child) => {
          const childTo = String((child as { to?: unknown }).to || '')

          if (childTo.startsWith('/dashboard/settings/members')) {
            return isAdmin.value
          }

          return true
        }).map((child) => {
          const childTo = String((child as { to?: unknown }).to || '')

          if (childTo === '/dashboard/settings/product-name') {
            const badge = productReviewBadge.value

            return {
              ...child,
              ...(badge ? { badge } : {})
            }
          }

          return child
        })
      } as NavigationMenuItem)
      continue
    }

    primary.push(withSourceAwareNavigation(item))
  }

  return [primary]
})

const searchLinks = computed(() => visibleLinks.value.flatMap(group =>
  group.map((item) => {
    const path = getNavigationPath(item.to)

    return {
      id: path || String(item.label || ''),
      label: String(item.label || ''),
      icon: typeof item.icon === 'string' ? item.icon : undefined,
      to: item.to
    }
  }).filter(item => item.label)
))

function getNavigationPath(to: unknown) {
  if (typeof to === 'string') return to
  if (to && typeof to === 'object' && 'path' in to) {
    return String((to as { path?: unknown }).path || '')
  }

  return ''
}

function withSourceAwareNavigation(item: NavigationMenuItem): NavigationMenuItem {
  const path = getNavigationPath(item.to)
  if (!SOURCE_AWARE_NAVIGATION_PATHS.has(path)) return item

  return {
    ...item,
    to: {
      path,
      query: resolveSourceQuery()
    }
  }
}

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: searchLinks.value
}, {
  id: 'code',
  label: 'Code',
  items: [{
    id: 'source',
    label: 'View page source',
    icon: 'i-simple-icons-github',
    to: `https://github.com/nuxt-ui-templates/dashboard/blob/main/app/pages${route.path === '/' ? '/index' : route.path}.vue`,
    target: '_blank'
  }]
}])

if (import.meta.client) {
  watch(
    () => [
      canReviewProductName.value,
      reviewProductInvalidations.value.getProductReviewQueue,
      reviewProductInvalidations.value['*']
    ],
    () => {
      if (!canReviewProductName.value) return

      ensureReviewProductQueueLoaded()
    },
    { immediate: true }
  )
}

onMounted(async () => {
  await refreshLocalSyncStatus()

  const localSyncTimer = window.setInterval(() => {
    void refreshLocalSyncStatus()
  }, 30_000)

  onUnmounted(() => {
    window.clearInterval(localSyncTimer)
  })

  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }

  toast.add({
    title: 'We use first-party cookies to enhance your experience on our website.',
    duration: 0,
    close: false,
    actions: [{
      label: 'Accept',
      color: 'neutral',
      variant: 'outline',
      onClick: () => {
        cookie.value = 'accepted'
      }
    }, {
      label: 'Opt out',
      color: 'neutral',
      variant: 'ghost'
    }]
  })
})

async function runManualArchiveSync() {
  if (!canManualLocalSync.value) return

  const limit = sanitizeSyncLimit(localSyncLimit.value)

  try {
    const result = await syncLocalNow({
      mode: MANUAL_LOCAL_SYNC_MODE,
      limit,
      finalize: true
    })

    toast.add({
      title: 'Sync lokal selesai',
      description: formatLocalSyncResult(result),
      color: result.failureCount > 0 ? 'warning' : 'success',
      icon: result.failureCount > 0 ? 'i-lucide-circle-alert' : 'i-lucide-circle-check'
    })
  } catch (error) {
    toast.add({
      title: 'Sync lokal gagal',
      description: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    await refreshLocalSyncStatus()
  }
}

function sanitizeSyncLimit(value: number) {
  const parsed = Math.floor(Number(value || 0))
  if (!Number.isFinite(parsed)) return 100
  return Math.min(Math.max(parsed, 1), 1000)
}

function formatLocalSyncResult(result: {
  mode: string
  processedIds: string[]
  successCount: number
  failureCount: number
  downloadedCount: number
  missingCount: number
  errorCount: number
  finalizedCount: number
}) {
  return `Mode ${result.mode} • ${result.processedIds.length} pengajuan • ${result.successCount} sukses • ${result.failureCount} gagal`
}

function formatSyncStamp(value: string) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default" v-model:open="open" collapsible resizable class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }">
      
      <template #header="{ collapsed }">
        <div class="flex h-17.5 items-center" :class="collapsed ? 'justify-center' : 'gap-3 px-2'">
          <div
            class="flex shrink-0 items-center justify-center bg-[#B6F500] shadow-[0_0_15px_rgba(182,245,0,0.3)] transition-all"
            :class="collapsed ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl'">
            <svg
              width="34" height="32" viewBox="0 0 34 32" fill="none" xmlns="http://www.w3.org/2000/svg"
              class="block h-6 w-6">
              <path
                d="M25.8108 6.1863C26.6396 5.35742 27.9966 5.34999 28.7094 6.28054C30.7732 8.97476 32 12.3439 32 16C32 17.888 31.6724 19.6991 31.0715 21.3804C30.4545 23.1066 30.6507 25.1038 31.9469 26.4L33.3931 27.8462C34.1582 28.6113 34.1583 29.8517 33.3933 30.6169C32.6282 31.3824 31.3874 31.3825 30.6221 30.6172L27.317 27.3121C27.3156 27.3107 27.3134 27.3108 27.3125 27.3125C27.3116 27.3142 27.3094 27.3143 27.308 27.3129L25.81 25.8148C24.9808 24.9857 25.0001 23.6499 25.668 22.6862C26.9836 20.7882 27.7549 18.4844 27.7549 16C27.7549 13.516 26.9839 11.2126 25.6687 9.31476C25.0009 8.35108 24.9817 7.01535 25.8108 6.1863ZM16 0C17.9814 0 19.8786 0.360395 21.6297 1.01898C22.9864 1.52921 23.2039 3.25187 22.1788 4.27662C21.5116 4.94363 20.5019 5.09696 19.6038 4.80797C18.4682 4.44253 17.2572 4.24512 16 4.24512C9.50784 4.24512 4.24512 9.50784 4.24512 16C4.24512 22.4922 9.50784 27.7549 16 27.7549C17.2566 27.7549 18.4666 27.5569 19.6016 27.1914C20.4998 26.902 21.5097 27.0556 22.1769 27.7228C23.202 28.7479 22.9843 30.4708 21.6274 30.9811C19.8769 31.6395 17.9807 32 16 32C7.17794 32 0.0244211 24.86 0.000977863 16.0435C0.000977146 16.0432 0.000758446 16.043 0.000488923 16.043C0.000218898 16.043 0 16.0427 0 16.0425V8.21415C0 6.74321 1.19243 5.55078 2.66337 5.55078C3.43768 5.55078 4.16496 5.20486 4.71381 4.65867C7.60704 1.77944 11.5957 0 16 0Z"
                fill="#0a0a0a" />
              <circle cx="16" cy="16" r="8" fill="#0a0a0a" />
            </svg>
          </div>
          <span
            v-if="!collapsed"
            class="inline-flex h-10 items-center text-xl font-black leading-none tracking-tighter">{{ runTimeConfig.public.appName }}</span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu :collapsed="collapsed" :items="visibleLinks[0]" orientation="vertical" tooltip popover />

        <UNavigationMenu :collapsed="collapsed" :items="visibleLinks[1] || []" orientation="vertical" tooltip class="mt-auto" />
        <div class="mb-2 flex w-full flex-col gap-3 overflow-hidden px-2">
          <div class="min-w-0 text-xs" :class="localSyncTone">
            <div class="truncate font-medium">
              {{ localSyncLabel }}
            </div>
            <div class="truncate text-muted">
              {{ localSyncSummary }}
            </div>
            <div v-if="!collapsed" class="mt-1 truncate text-muted">
              {{ localSyncDetail }}
            </div>
          </div>

          <template v-if="!collapsed && canManualLocalSync">
            <div class="grid gap-2">
              <div>
                <p class="mb-1 text-[11px] font-medium text-muted">
                  Mode
                </p>
                <div class="flex h-10 items-center rounded-md border border-default bg-elevated px-3 text-sm font-medium text-highlighted">
                  Manual
                </div>
              </div>

              <div>
                <p class="mb-1 text-[11px] font-medium text-muted">
                  Limit batch
                </p>
                <UInput
                  v-model.number="localSyncLimit"
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  class="w-full"
                />
              </div>
            </div>
          </template>

          <div class="flex items-center gap-2">
            <UTooltip :text="canManualLocalSync ? 'Sync lokal manual' : 'Hanya admin yang dapat menjalankan sync lokal'">
              <UButton
                class="shrink-0"
                :icon="canManualLocalSync ? 'i-lucide-refresh-cw' : 'i-lucide-lock'"
                color="neutral"
                variant="ghost"
                size="sm"
                :label="collapsed ? undefined : 'Sync lokal'"
                :square="collapsed"
                :loading="isLocalSyncLoading || localSyncStatus?.inProgress"
                :disabled="!canManualLocalSync || isLocalSyncLoading || localSyncStatus?.inProgress"
                @click="runManualArchiveSync"
              />
            </UTooltip>
          </div>

          <UAlert
            v-if="!collapsed && (localSyncError || localSyncLastRun)"
            :color="localSyncLastRun && localSyncLastRun.failureCount > 0 ? 'warning' : localSyncError ? 'error' : 'success'"
            :icon="localSyncError ? 'i-lucide-circle-alert' : localSyncLastRun && localSyncLastRun.failureCount > 0 ? 'i-lucide-circle-alert' : 'i-lucide-circle-check'"
            :title="localSyncError ? 'Sync lokal gagal' : localSyncLastRun && localSyncLastRun.failureCount > 0 ? 'Sync lokal selesai sebagian' : 'Sync lokal selesai'"
            :description="localSyncError || formatLocalSyncResult(localSyncLastRun || { mode: MANUAL_LOCAL_SYNC_MODE, processedIds: [], successCount: 0, failureCount: 0, downloadedCount: 0, missingCount: 0, errorCount: 0, finalizedCount: 0 })"
            variant="subtle"
          />
        </div>
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />
  </UDashboardGroup>
</template>
