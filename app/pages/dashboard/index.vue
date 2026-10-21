<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useLocalStorage } from '@vueuse/core'
import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
  type DashboardRecentSubmission,
  type DashboardResponse,
} from '#shared/types/dashboard'

definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

const periodItems = [...DASHBOARD_PERIODS]
const selectedPeriod = useLocalStorage<DashboardPeriod>('dashboard-period', 'All time', {
  initOnMounted: true,
  serializer: {
    read: (value: string): DashboardPeriod => DASHBOARD_PERIODS.includes(value as DashboardPeriod)
      ? value as DashboardPeriod
      : 'All time',
    write: (value: DashboardPeriod) => value,
  },
})
const {
  data: dashboard,
  status,
  refresh,
} = await useFetch<DashboardResponse>('/api/dashboard', {
  query: { period: selectedPeriod },
  lazy: true,
})
const {
  data: latestSubmissions,
  status: latestSubmissionsStatus,
  refresh: refreshLatestSubmissions,
} = await useFetch<DashboardRecentSubmission[]>('/api/dashboard/recent-submissions', {
  lazy: true,
})

const currentDashboard = computed(() => {
  if (dashboard.value?.period !== selectedPeriod.value) return null
  return dashboard.value ?? null
})

const summary = computed(() => currentDashboard.value?.summary ?? null)
const chart = computed(() => currentDashboard.value?.chart ?? [])
const recentSubmissions = computed(() => latestSubmissions.value ?? [])
const topModels = computed(() => currentDashboard.value?.topModels ?? [])
const topPemohon = computed(() => currentDashboard.value?.topPemohon ?? [])
const loading = computed(() => status.value !== 'error' && !currentDashboard.value)
const latestSubmissionsLoading = computed(() => latestSubmissionsStatus.value === 'idle' || latestSubmissionsStatus.value === 'pending')

const chartTimeZone = computed(() => dashboard.value?.range.timeZone ?? 'Asia/Jakarta')
const dateFormatter = computed(() => new Intl.DateTimeFormat('id-ID', {
  timeZone: chartTimeZone.value,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}))
const formatDate = (date: string) => dateFormatter.value.format(new Date(date))
const formatNumber = (value: number) => value.toLocaleString('id-ID')

const recentColumns: TableColumn<DashboardRecentSubmission>[] = [
  {
    accessorKey: 'idPengajuan',
    header: 'ID Pengajuan',
    meta: { class: { th: 'w-[30%]', td: 'w-[30%]' } },
  },
  {
    accessorKey: 'nama',
    header: 'Pemohon',
    meta: { class: { th: 'w-[26%]', td: 'w-[26%]' } },
  },
  {
    accessorKey: 'submittedAt',
    header: 'Tanggal',
    meta: { class: { th: 'w-[19%]', td: 'w-[19%]' } },
  },
  {
    accessorKey: 'itemCount',
    header: 'Item',
    meta: { class: { th: 'w-[10%]', td: 'w-[10%]' } },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    meta: { class: { th: 'w-[15%]', td: 'w-[15%]' } },
  },
]

const statusColor = (value: string): 'info' | 'primary' | 'success' | 'error' | 'warning' | 'neutral' => {
  if (value === 'Baru') return 'info'
  if (value === 'Disetujui' || value === 'Dikirim') return 'primary'
  if (value === 'Ditolak') return 'error'
  if (value === 'Diprint') return 'warning'
  if (value === 'Selesai') return 'success'
  return 'neutral'
}
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Overview Pengajuan dan Statistik">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <USelect
            v-model="selectedPeriod"
            :items="periodItems"
            aria-label="Periode statistik"
            class="w-48"
          />
          <UButton
            to="/dashboard/pengajuan"
            icon="i-lucide-list"
            color="neutral"
            variant="soft"
            class="hidden sm:inline-flex"
          >
            Lihat Pengajuan
          </UButton>
          <UButton
            to="/dashboard/pengajuan/create"
            icon="i-lucide-plus"
          >
            Pengajuan Baru
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="status === 'error'"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Statistik gagal dimuat"
        :actions="[{
          label: 'Coba lagi',
          icon: 'i-lucide-refresh-cw',
          color: 'error',
          variant: 'soft',
          onClick: () => refresh(),
        }]"
      />
      <HomeStats
        :summary="summary"
        :loading="loading"
      />
      <HomeChart
        :period="selectedPeriod"
        :data="chart"
        :time-zone="chartTimeZone"
        :loading="loading"
      />

      <div class="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-4">
        <UCard class="min-w-0 shrink-0 lg:col-span-2" :ui="{ body: 'p-0!' }">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="font-semibold text-highlighted">Pengajuan terbaru</h2>
                <p class="mt-1 text-sm text-muted">Lima pengajuan terakhir dari semua periode.</p>
              </div>
              <UButton
                to="/dashboard/pengajuan"
                color="neutral"
                variant="ghost"
                size="sm"
                trailing-icon="i-lucide-arrow-up-right"
              >
                Lihat semua
              </UButton>
            </div>
          </template>

          <div v-if="latestSubmissionsStatus === 'error'" class="px-6 py-10 text-center text-sm text-muted">
            <p>Pengajuan terbaru gagal dimuat.</p>
            <UButton class="mt-3" size="sm" variant="soft" @click="refreshLatestSubmissions()">
              Coba lagi
            </UButton>
          </div>
          <div v-else-if="latestSubmissionsLoading" class="space-y-4 p-4 sm:p-6" aria-label="Memuat pengajuan terbaru">
            <USkeleton v-for="index in 5" :key="index" class="h-8 w-full" />
          </div>
          <div v-else-if="!recentSubmissions.length" class="px-6 py-12 text-center text-sm text-muted">
            Belum ada pengajuan.
          </div>
          <UTable
            v-else
            :data="recentSubmissions"
            :columns="recentColumns"
            class="w-full"
            :ui="{
              root: 'w-full',
              base: 'w-full min-w-160 table-fixed overflow-clip',
              th: 'px-4 py-3 text-xs font-semibold uppercase text-muted',
              td: 'px-4 py-3 text-sm',
            }"
          >
            <template #idPengajuan-cell="{ row }">
              <span class="font-mono font-medium text-highlighted">{{ row.original.idPengajuan }}</span>
            </template>
            <template #nama-cell="{ row }">
              <div class="min-w-0">
                <p class="font-medium text-highlighted">{{ row.original.nama }}</p>
                <p class="text-xs text-muted">{{ row.original.cabang }}</p>
              </div>
            </template>
            <template #submittedAt-cell="{ row }">
              <span class="whitespace-nowrap">{{ formatDate(row.original.submittedAt) }}</span>
            </template>
            <template #itemCount-cell="{ row }">
              {{ formatNumber(row.original.itemCount) }}
            </template>
            <template #status-cell="{ row }">
              <UBadge :color="statusColor(row.original.status)" variant="subtle">
                {{ row.original.status }}
              </UBadge>
            </template>
          </UTable>
        </UCard>

        <UCard v-if="status !== 'error'" class="min-w-0 shrink-0 lg:col-span-1" :ui="{ root: 'divide-y-0', header: 'pb-0' }">
          <template #header>
            <h2 class="font-semibold text-highlighted">Top 5 model</h2>
            <p class="mt-1 text-sm text-muted">Model dengan item pengajuan terbanyak.</p>
          </template>

          <div v-if="loading" class="space-y-5" aria-label="Memuat top model">
            <USkeleton v-for="index in 5" :key="index" class="h-9 w-full" />
          </div>
          <p v-else-if="!topModels.length" class="py-8 text-center text-sm text-muted">
            Belum ada model pada periode ini.
          </p>
          <ol v-else class="space-y-2">
            <li v-for="item in topModels" :key="item.model" class="bg-slate-50 p-2 border border-slate-200 dark:bg-slate-600 dark:border-slate-500 rounded-md">
              <div class="flex items-center gap-3 text-sm">
                <UAvatar :text="item.model.substring(0, 2).toUpperCase()" :ui="{ fallback: 'text-xs' }" color="error" />
                <span class="min-w-0 flex-1 truncate font-medium text-highlighted" :title="item.model">{{ item.model }}</span>
                <UBadge size="md" variant="subtle">
                  {{ formatNumber(item.itemCount) }}
                </UBadge>
              </div>
            </li>
          </ol>
        </UCard>

        <UCard v-if="status !== 'error'" class="min-w-0 shrink-0 lg:col-span-1" :ui="{ root: 'divide-y-0', header: 'pb-0' }">
          <template #header>
            <h2 class="font-semibold text-highlighted">Top 5 pemohon</h2>
            <p class="mt-1 text-sm text-muted">Pemohon dengan item pengajuan terbanyak.</p>
          </template>

          <div v-if="loading" class="space-y-5" aria-label="Memuat top pemohon">
            <USkeleton v-for="index in 5" :key="index" class="h-9 w-full" />
          </div>
          <p v-else-if="!topPemohon.length" class="py-8 text-center text-sm text-muted">
            Belum ada pemohon pada periode ini.
          </p>
          
          <ol v-else class="space-y-2">
            <li v-for="item in topPemohon" :key="`${item.nama}-${item.bagian}-${item.cabang}`" class="bg-slate-50 p-2 border border-slate-200 dark:bg-slate-600 dark:border-slate-500 rounded-md">
              <div class="flex items-center gap-3 text-sm">
                <UAvatar :alt="item.nama" :ui="{ fallback: 'text-xs' }" color="error" />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium text-highlighted" :title="item.nama">{{ item.nama }}</p>
                  <p class="truncate text-xs text-muted">{{ item.bagian }} · {{ item.cabang }}</p>
                </div>
                <UBadge size="md" variant="soft" color="primary">
                  {{ formatNumber(item.itemCount) }}
                </UBadge>
              </div>
            </li>
          </ol>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
