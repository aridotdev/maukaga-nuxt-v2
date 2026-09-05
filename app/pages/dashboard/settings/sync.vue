<script setup lang="ts">
definePageMeta({
  middleware: ['auth-guard', 'role-guard']
})

const MANUAL_LOCAL_SYNC_MODE = 'manual' as const
const DEFAULT_LOCAL_SYNC_LIMIT = 100

type LocalSyncRunSummary = {
  mode: string
  processedIds: string[]
  successCount: number
  failureCount: number
  downloadedCount: number
  missingCount: number
  errorCount: number
  finalizedCount: number
}

const toast = useToast()
const { profile, fetchProfile, isAdmin } = useUserProfile()
const {
  status: localSyncStatus,
  lastRun: localSyncLastRun,
  isLoading: isLocalSyncLoading,
  error: localSyncError,
  refreshStatus: refreshLocalSyncStatus,
  syncNow: syncLocalNow
} = useLocalSyncStatus()

const localSyncLimit = ref(DEFAULT_LOCAL_SYNC_LIMIT)
const canManualLocalSync = computed(() => isAdmin.value)
const localSyncMeta = computed(() => localSyncStatus.value?.meta || {})
const isLocalSyncBusy = computed(() => isLocalSyncLoading.value || localSyncStatus.value?.inProgress === true)
const localSyncStatusColor = computed<'error' | 'warning' | 'success' | 'neutral'>(() => {
  if (localSyncError.value || localSyncMeta.value['archive_sync:last_status'] === 'failed') return 'error'
  if (isLocalSyncBusy.value) return 'warning'
  if (localSyncMeta.value['archive_sync:last_status'] === 'success'
    || (localSyncLastRun.value && localSyncLastRun.value.failureCount === 0)) {
    return 'success'
  }

  return 'neutral'
})
const localSyncStatusIcon = computed(() => {
  if (localSyncStatusColor.value === 'error') return 'i-lucide-circle-alert'
  if (localSyncStatusColor.value === 'warning') return 'i-lucide-refresh-cw'
  if (localSyncStatusColor.value === 'success') return 'i-lucide-circle-check'
  return 'i-lucide-database'
})
const localSyncLabel = computed(() => {
  if (isLocalSyncBusy.value) return 'Sync lokal berjalan'
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
    return formatLocalSyncResult(localSyncLastRun.value)
  }

  const processed = Number(localSyncMeta.value['archive_sync:last_processed_count'] || 0)
  const success = Number(localSyncMeta.value['archive_sync:last_success_count'] || 0)
  const failure = Number(localSyncMeta.value['archive_sync:last_failure_count'] || 0)

  if (processed > 0) {
    return `${processed} pengajuan - ${success} sukses - ${failure} gagal`
  }

  return `${localSyncStatus.value?.fileSummary.total || 0} file arsip`
})
const localSyncDetail = computed(() => {
  if (isLocalSyncBusy.value) {
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

  return 'Sync lokal dijalankan manual oleh admin melalui halaman ini.'
})
const fileSummaryItems = computed(() => {
  const summary = localSyncStatus.value?.fileSummary

  return [{
    label: 'Total File',
    value: summary?.total || 0,
    icon: 'i-lucide-files'
  }, {
    label: 'Downloaded',
    value: summary?.downloaded || 0,
    icon: 'i-lucide-download'
  }, {
    label: 'Pending',
    value: summary?.pending || 0,
    icon: 'i-lucide-clock'
  }, {
    label: 'Missing/Error',
    value: (summary?.missing || 0) + (summary?.error || 0),
    icon: 'i-lucide-circle-alert'
  }]
})
const latestMetaItems = computed(() => [{
  label: 'Run ID',
  value: localSyncMeta.value['archive_sync:last_run_id'] || '-'
}, {
  label: 'Mode',
  value: localSyncMeta.value['archive_sync:last_mode'] || MANUAL_LOCAL_SYNC_MODE
}, {
  label: 'Mulai',
  value: formatSyncStamp(localSyncMeta.value['archive_sync:last_started_at'])
}, {
  label: 'Selesai',
  value: formatSyncStamp(localSyncMeta.value['archive_sync:last_finished_at'])
}])

let localSyncTimer: number | undefined

onMounted(async () => {
  if (!profile.value) {
    await fetchProfile()
  }

  await refreshLocalSyncStatus()

  localSyncTimer = window.setInterval(() => {
    void refreshLocalSyncStatus()
  }, 30_000)
})

onUnmounted(() => {
  if (localSyncTimer) {
    window.clearInterval(localSyncTimer)
  }
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

function formatLocalSyncResult(result: LocalSyncRunSummary) {
  return `Mode ${result.mode} - ${result.processedIds.length} pengajuan - ${result.successCount} sukses - ${result.failureCount} gagal`
}

function formatSyncStamp(value?: string) {
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
  <div class="space-y-4">
    <UPageCard
      variant="subtle"
    >
      <template #header>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-highlighted">
              Sinkronisasi Data
            </h2>
            <p class="mt-1 text-sm text-muted">
              Jalankan sinkronisasi arsip ke SQLite lokal dan pantau status file hasil sync.
            </p>
          </div>

          <UBadge
            :color="localSyncStatusColor"
            :icon="localSyncStatusIcon"
            :label="localSyncLabel"
            variant="subtle"
            class="w-fit shrink-0"
          />
        </div>
      </template>

      <div class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section class="rounded-lg border border-default bg-default/50 p-4">
          <div class="flex flex-col gap-1">
            <p class="text-sm font-semibold text-highlighted">
              {{ localSyncLabel }}
            </p>
            <p class="text-sm text-muted">
              {{ localSyncSummary }}
            </p>
            <p class="text-sm text-muted">
              {{ localSyncDetail }}
            </p>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div
              v-for="item in fileSummaryItems"
              :key="item.label"
              class="rounded-md border border-muted bg-elevated/40 p-3"
            >
              <div class="flex items-center gap-2 text-xs font-medium text-muted">
                <UIcon :name="item.icon" class="size-4" />
                <span>{{ item.label }}</span>
              </div>
              <p class="mt-2 text-2xl font-semibold text-highlighted">
                {{ item.value }}
              </p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-default bg-default/50 p-4">
          <div class="grid gap-3">
            <UFormField label="Mode">
              <div class="flex h-10 items-center rounded-md border border-default bg-elevated px-3 text-sm font-medium text-highlighted">
                Manual
              </div>
            </UFormField>

            <UFormField
              label="Limit batch"
              description="Batas jumlah pengajuan yang diproses dalam satu kali sync."
            >
              <UInput
                v-model.number="localSyncLimit"
                type="number"
                min="1"
                max="1000"
                step="1"
                class="w-full"
              />
            </UFormField>

            <UTooltip :text="canManualLocalSync ? 'Sync lokal manual' : 'Hanya admin yang dapat menjalankan sync lokal'">
              <UButton
                :icon="canManualLocalSync ? 'i-lucide-refresh-cw' : 'i-lucide-lock'"
                color="neutral"
                label="Sync lokal"
                :loading="isLocalSyncBusy"
                :disabled="!canManualLocalSync || isLocalSyncBusy"
                block
                @click="runManualArchiveSync"
              />
            </UTooltip>
          </div>
        </section>
      </div>

      <UAlert
        v-if="localSyncError || localSyncLastRun"
        :color="localSyncLastRun && localSyncLastRun.failureCount > 0 ? 'warning' : localSyncError ? 'error' : 'success'"
        :icon="localSyncError ? 'i-lucide-circle-alert' : localSyncLastRun && localSyncLastRun.failureCount > 0 ? 'i-lucide-circle-alert' : 'i-lucide-circle-check'"
        :title="localSyncError ? 'Sync lokal gagal' : localSyncLastRun && localSyncLastRun.failureCount > 0 ? 'Sync lokal selesai sebagian' : 'Sync lokal selesai'"
        :description="localSyncError || formatLocalSyncResult(localSyncLastRun || { mode: MANUAL_LOCAL_SYNC_MODE, processedIds: [], successCount: 0, failureCount: 0, downloadedCount: 0, missingCount: 0, errorCount: 0, finalizedCount: 0 })"
        variant="subtle"
        class="mt-4"
      />
    </UPageCard>

    <UPageCard
      title="Run Terakhir"
      description="Metadata sinkronisasi terakhir dari arsip lokal."
      variant="subtle"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <div
          v-for="item in latestMetaItems"
          :key="item.label"
          class="rounded-lg border border-default bg-default/50 p-4"
        >
          <p class="text-xs font-medium text-muted">
            {{ item.label }}
          </p>
          <p class="mt-1 truncate text-sm font-semibold text-highlighted">
            {{ item.value }}
          </p>
        </div>
      </div>
    </UPageCard>
  </div>
</template>
