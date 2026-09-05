<script setup lang="ts">
import { sub } from 'date-fns'
import HomePengajuan from '~/components/home/HomePengajuan.vue'
import type { Period, Range } from '~/types'

const { isNotificationsSlideoverOpen } = useDashboard()
const { source: dashboardSource } = useDashboardDataSource()

definePageMeta({
  middleware: ['auth-guard', 'role-guard']
})

const range = shallowRef<Range>({
  start: sub(new Date(), { days: 14 }),
  end: new Date()
})
const period = ref<Period>('daily')
const reviewPanelClass = computed(() =>
  dashboardSource.value === 'active'
    ? 'lg:grid-cols-[minmax(0,1fr)_24rem]'
    : 'lg:grid-cols-1'
)

function openNotifications() {
  isNotificationsSlideoverOpen.value = true
}
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Home" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <DashboardSourceSwitcher />
          <UTooltip text="Notifications" :shortcuts="['N']">
            <UButton
              color="neutral"
              variant="ghost"
              square
              @click="openNotifications"
            >
              <UChip color="error" inset>
                <UIcon name="i-lucide-bell" class="size-5 shrink-0" />
              </UChip>
            </UButton>
          </UTooltip>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <!-- NOTE: The `-ms-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
          <HomeDateRangePicker v-model="range" class="-ms-1" />

          <HomePeriodSelect v-model="period" :range="range" />
        </template>
      </UDashboardToolbar>
    </template>



    <template #body>
      <HomeStats :source="dashboardSource" />
      <div class="grid min-w-0 max-w-full gap-6 max-h-121.75" :class="reviewPanelClass">
        <HomeChart :period="period" :range="range" :source="dashboardSource" class="min-w-0 w-full" />
        <HomeReviewProductName v-show="dashboardSource === 'active'" class="min-w-0" />
      </div>
      <HomePengajuan :source="dashboardSource" />
    </template>
  </UDashboardPanel>
</template>
