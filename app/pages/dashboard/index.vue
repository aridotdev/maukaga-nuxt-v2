<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
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
const selectedPeriod = ref<DashboardPeriod>('This month')
const {
  data: dashboard,
  status,
  refresh,
} = await useFetch<DashboardResponse>('/api/dashboard', {
  query: { period: selectedPeriod },
  lazy: true,
})

const currentDashboard = computed(() => {
  if (status.value !== 'success' || dashboard.value?.period !== selectedPeriod.value) return null
  return dashboard.value
})

const summary = computed(() => currentDashboard.value?.summary ?? null)
const chart = computed(() => currentDashboard.value?.chart ?? [])
const recentSubmissions = computed(() => currentDashboard.value?.recentSubmissions ?? [])
const topModels = computed(() => currentDashboard.value?.topModels ?? [])
const topPemohon = computed(() => currentDashboard.value?.topPemohon ?? [])
const loading = computed(() => status.value !== 'error' && !currentDashboard.value)

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
  { accessorKey: 'idPengajuan', header: 'ID Pengajuan' },
  { accessorKey: 'nama', header: 'Pemohon' },
  { accessorKey: 'submittedAt', header: 'Tanggal' },
  { accessorKey: 'itemCount', header: 'Item' },
  { accessorKey: 'status', header: 'Status' },
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
      <UDashboardNavbar title="Home">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
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
          </div>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <USelect
            v-model="selectedPeriod"
            :items="periodItems"
            aria-label="Periode statistik"
            class="w-48"
          />
        </template>
      </UDashboardToolbar>
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

      <UCard v-if="status !== 'error'" :ui="{ body: 'p-0!' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold text-highlighted">Pengajuan terbaru</h2>
              <p class="mt-1 text-sm text-muted">Lima pengajuan terakhir pada periode ini.</p>
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

        <div v-if="loading" class="space-y-4 p-4 sm:p-6" aria-label="Memuat pengajuan terbaru">
          <USkeleton v-for="index in 5" :key="index" class="h-8 w-full" />
        </div>
        <div v-else-if="!recentSubmissions.length" class="px-6 py-12 text-center text-sm text-muted">
          Belum ada pengajuan pada periode ini.
        </div>
        <UTable
          v-else
          :data="recentSubmissions"
          :columns="recentColumns"
          class="w-full"
          :ui="{
            base: 'min-w-160',
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

      <div v-if="status !== 'error'" class="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <UCard>
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
          <ol v-else class="space-y-4">
            <li v-for="(item, index) in topModels" :key="item.model">
              <div class="mb-1.5 flex items-center gap-3 text-sm">
                <span class="w-5 shrink-0 text-center text-muted">{{ index + 1 }}</span>
                <span class="min-w-0 flex-1 truncate font-medium text-highlighted" :title="item.model">{{ item.model }}</span>
                <span class="shrink-0 tabular-nums text-muted">{{ formatNumber(item.itemCount) }} item</span>
              </div>
              <UProgress :model-value="item.itemCount" :max="topModels[0]?.itemCount || 1" size="xs" color="primary" />
            </li>
          </ol>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">Top 5 pemohon</h2>
            <p class="mt-1 text-sm text-muted">Pemohon dengan pengajuan terbanyak.</p>
          </template>

          <div v-if="loading" class="space-y-5" aria-label="Memuat top pemohon">
            <USkeleton v-for="index in 5" :key="index" class="h-9 w-full" />
          </div>
          <p v-else-if="!topPemohon.length" class="py-8 text-center text-sm text-muted">
            Belum ada pemohon pada periode ini.
          </p>
          <ol v-else class="space-y-4">
            <li v-for="(item, index) in topPemohon" :key="`${item.nama}-${item.bagian}-${item.cabang}`">
              <div class="mb-1.5 flex items-center gap-3 text-sm">
                <span class="w-5 shrink-0 text-center text-muted">{{ index + 1 }}</span>
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium text-highlighted" :title="item.nama">{{ item.nama }}</p>
                  <p class="truncate text-xs text-muted">{{ item.bagian }} · {{ item.cabang }}</p>
                </div>
                <span class="shrink-0 tabular-nums text-muted">{{ formatNumber(item.submissionCount) }} pengajuan</span>
              </div>
              <UProgress :model-value="item.submissionCount" :max="topPemohon[0]?.submissionCount || 1" size="xs" color="primary" />
            </li>
          </ol>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
