<script setup lang="ts">
import type { DashboardSummary } from '#shared/types/dashboard'

const props = defineProps<{
  summary: DashboardSummary | null
  loading: boolean
}>()

const stats = computed(() => [{
  title: 'Total Pengajuan',
  icon: 'i-lucide-files',
  value: props.summary?.totalPengajuan,
}, {
  title: 'Pengajuan Baru',
  icon: 'i-lucide-clipboard-check',
  value: props.summary?.pengajuanBaru,
}, {
  title: 'Item Disetujui',
  icon: 'i-lucide-file-check-corner',
  value: props.summary?.itemDisetujui,
}, {
  title: 'Item Ditolak',
  icon: 'i-lucide-file-x-corner',
  value: props.summary?.itemDitolak,
}])
</script>

<template>
  <UPageGrid
    class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px"
    :aria-busy="loading"
  >
    <UPageCard
      v-for="stat in stats"
      :key="stat.title"
      :icon="stat.icon"
      :title="stat.title"
      to="/dashboard/pengajuan"
      variant="subtle"
      :ui="{
        container: 'gap-y-1.5',
        wrapper: 'items-start',
        leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
        title: 'font-normal text-muted text-xs uppercase'
      }"
      class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
    >
      <div class="flex h-8 items-center gap-2">
        <USkeleton v-if="loading" class="h-7 w-16" />
        <span v-else class="text-2xl font-semibold text-highlighted tabular-nums">
          {{ stat.value?.toLocaleString('id-ID') ?? '-' }}
        </span>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
