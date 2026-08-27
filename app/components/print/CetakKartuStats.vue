<script setup lang="ts">
type CetakKartuSummary = {
  total: number
  local: number
  import: number
  unset: number
}

const props = defineProps<{
  summary?: Partial<CetakKartuSummary>
  selectedCount?: number
  loading?: boolean
}>()

const normalizedSummary = computed(() => ({
  total: Number(props.summary?.total || 0),
  local: Number(props.summary?.local || 0),
  import: Number(props.summary?.import || 0),
  unset: Number(props.summary?.unset || 0)
}))

const stats = computed(() => [{
  title: 'Total Antrean',
  icon: 'i-lucide-files',
  value: normalizedSummary.value.total,
  description: `${Number(props.selectedCount || 0)} item dipilih`
}, {
  title: 'Kartu Local',
  icon: 'i-lucide-map-pin',
  value: normalizedSummary.value.local,
  description: 'Siap cetak Local'
}, {
  title: 'Kartu Import',
  icon: 'i-lucide-globe-2',
  value: normalizedSummary.value.import,
  description: 'Siap cetak Import'
}, {
  title: 'Belum Dipilih',
  icon: 'i-lucide-circle-help',
  value: normalizedSummary.value.unset,
  description: 'Perlu jenis kartu'
}])
</script>

<template>
  <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
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
        title: 'font-normal text-muted text-xs uppercase',
        description: 'text-xs text-muted'
      }"
      class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
    >
      <div class="flex items-end justify-between gap-3">
        <span class="text-2xl font-semibold text-highlighted">
          {{ loading ? '...' : stat.value }}
        </span>
        <span class="text-xs text-muted">
          {{ stat.description }}
        </span>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
