<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

definePageMeta({
  middleware: ['auth-guard', 'role-guard']
})

const links = [[{
  label: 'Product Name',
  icon: 'i-lucide-scan-search',
  to: '/dashboard/settings/product-name',
  exact: true
},{
  label: 'Layout Cetak',
  icon: 'i-lucide-layout-template',
  to: '/dashboard/settings/layout-kartu',
  exact: true
}, {
  label: 'User Management',
  icon: 'i-lucide-users',
  to: '/dashboard/settings/members'
}]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Settings">
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
