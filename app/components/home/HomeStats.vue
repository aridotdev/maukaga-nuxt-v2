<script setup lang="ts">
import type { DashboardDataSource } from '~/composables/useDashboardData'

const props = defineProps<{
  source?: DashboardDataSource
}>()

const router = useRouter()
const dashboardSource = computed(() => props.source || 'active')

const { summary, isLoading, error, ensureLoaded } = useDashboardSummaryData(() => dashboardSource.value)

const stats = computed(() => [{
  title: 'Total Pengajuan',
  icon: 'i-lucide-files',
  value: Number(summary.value.total || 0)
}, {
  title: 'Total Item',
  icon: 'i-lucide-boxes',
  value: Number(summary.value.totalItems || 0)
}, {
  title: 'Pengajuan Baru',
  icon: 'i-lucide-file-plus',
  value: Number(summary.value.baru || 0)
}, {
  title: 'Item Disetujui',
  icon: 'i-lucide-circle-check',
  value: Number(summary.value.itemDisetujui || 0)
}, {
  title: 'Item Ditolak',
  icon: 'i-lucide-x-circle',
  value: Number(summary.value.itemDitolak || 0)
}])

const showSkeleton = computed(() => isLoading.value && !summary.value.total && !summary.value.totalItems)

onMounted(() => {
  ensureLoaded()
})

watch(dashboardSource, () => {
  ensureLoaded()
})

// Pantau perubahan error untuk handle 401.
watch(error, async (msg) => {
  if (msg && (msg.includes('Unauthorized') || msg.includes('Token admin'))) {
    sessionStorage.removeItem('admin_nama')
    sessionStorage.removeItem('admin_username')
    await router.push('/login')
  }
})
</script>

<template>
  <UPageGrid class="lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-px">
    <UPageCard
      v-for="(stat, index) in stats"
      :key="index"
      :icon="stat.icon"
      :title="stat.title"
      variant="subtle"
      :ui="{
        container: 'gap-y-1.5',
        wrapper: 'items-start',
        leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
        title: 'font-normal text-muted text-xs uppercase'
      }"
      class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
    >
      <div class="flex items-center gap-2">
        <USkeleton v-if="showSkeleton" class="h-7 w-16" />
        <span v-else class="text-2xl font-semibold text-highlighted">
          {{ stat.value }}
        </span>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
