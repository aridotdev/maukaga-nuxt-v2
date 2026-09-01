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
      <div class="flex gap-6 max-w-full max-h-121.75">
        <HomeChart :period="period" :range="range" :source="dashboardSource" class="flex-1" />
        <HomeReviewProductName v-if="dashboardSource === 'active'" />
      </div>
      <HomePengajuan :source="dashboardSource" />
    </template>
  </UDashboardPanel>
</template>
