<script setup lang="ts">
import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
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

const summary = computed(() => {
  if (status.value !== 'success' || dashboard.value?.period !== selectedPeriod.value) return null
  return dashboard.value.summary
})

const chart = computed(() => {
  if (status.value !== 'success' || dashboard.value?.period !== selectedPeriod.value) return []
  return dashboard.value.chart
})

const chartTimeZone = computed(() => dashboard.value?.range.timeZone ?? 'Asia/Jakarta')
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
        :loading="status === 'pending' || status === 'idle'"
      />
      <HomeChart
        :period="selectedPeriod"
        :data="chart"
        :time-zone="chartTimeZone"
        :loading="status === 'pending' || status === 'idle'"
      />
    </template>
  </UDashboardPanel>
</template>
