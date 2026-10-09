<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

const links = [[{
  label: 'Product Name',
  icon: 'i-lucide-scan-search',
  to: '/dashboard/master-data/product-name',
  exact: true,
}, {
  label: 'Pemohon',
  icon: 'i-lucide-user-round',
  to: '/dashboard/master-data/pemohon',
  exact: true,
}, {
  label: 'Dealer/Toko',
  icon: 'i-lucide-store',
  to: '/dashboard/master-data/dealer-toko',
  exact: true,
}]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardPanel id="master-data" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Master Data">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
        <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex w-full max-w-4xl flex-col gap-4 sm:gap-6 lg:gap-12 mx-auto">
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
