<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const runtimeConfig = useRuntimeConfig()
const open = ref(false)

const links = [[{
  label: 'Home',
  icon: 'i-lucide-house',
  to: '/dashboard',
  exact: true,
  onSelect: () => {
    open.value = false
  },
},
{
  label: 'Pengajuan',
  icon: 'i-lucide-files',
  to: '/dashboard/pengajuan',
  exact: true,
  onSelect: () => {
    open.value = false
  },
},
{
  label: 'Cetak Kartu Garansi',
  icon: 'i-lucide-printer',
  to: '/dashboard/cetak-kartu',
  exact: true,
  onSelect: () => {
    open.value = false
  },
},
{
  label: 'Cetak Label Pengiriman',
  icon: 'i-lucide-tags',
  to: '/dashboard/cetak-label-kirim',
  exact: true,
  onSelect: () => {
    open.value = false
  },
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
}
]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <div class="flex h-17.5 items-center px-2" :class="collapsed ? 'justify-center' : 'gap-3'">
          <div
            class="flex shrink-0 items-center justify-center bg-[#B6F500] shadow-[0_0_15px_rgba(182,245,0,0.3)] transition-all"
            :class="collapsed ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-lg'"
          >
            <UIcon name="i-lucide-shield-check" class="size-6 text-neutral-950" />
          </div>
          <span
            v-if="!collapsed"
            class="inline-flex h-10 items-center text-xl font-black leading-none"
          >
            {{ runtimeConfig.public.appName }}
          </span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
          class="pt-3"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
