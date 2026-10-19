<script setup lang="ts">
import { VisArea, VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'
import { useElementSize } from '@vueuse/core'
import type { DashboardChartPoint, DashboardPeriod } from '#shared/types/dashboard'

const props = defineProps<{
  period: DashboardPeriod
  data: DashboardChartPoint[]
  timeZone: string
  loading?: boolean
}>()

type ChartRecord = DashboardChartPoint & { dateValue: Date }

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
const { width } = useElementSize(cardRef)

const data = computed<ChartRecord[]>(() => props.data.map(point => ({
  ...point,
  dateValue: new Date(point.date),
})))

const x = (_: ChartRecord, index: number) => index
const itemPengajuan = (point: ChartRecord) => point.itemPengajuan
const itemDisetujui = (point: ChartRecord) => point.itemDisetujui
const itemDitolak = (point: ChartRecord) => point.itemDitolak

const total = computed(() => data.value.reduce((sum, point) => sum + point.itemPengajuan, 0))
const formatNumber = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format

const isDaily = computed(() => props.period === 'This month' || props.period === 'Last month')
const isYearly = computed(() => props.period === 'All time')
const dateFormatter = computed(() => new Intl.DateTimeFormat('id-ID', {
  timeZone: props.timeZone,
  ...(isYearly.value
    ? { year: 'numeric' }
    : {
        day: 'numeric',
        month: 'short',
        ...(isDaily.value ? {} : { year: 'numeric' }),
      }),
}))
const formatDate = (date: Date) => dateFormatter.value.format(date)

const xTicks = (index: number) => {
  const point = data.value[index]
  if (!point || (!isYearly.value && (index === 0 || index === data.value.length - 1))) return ''
  return formatDate(point.dateValue)
}

const template = (point: ChartRecord) => [
  `<strong>${formatDate(point.dateValue)}</strong>`,
  `Qty item pengajuan: ${formatNumber(point.itemPengajuan)}`,
  `Item Disetujui: ${formatNumber(point.itemDisetujui)}`,
  `Item Ditolak: ${formatNumber(point.itemDitolak)}`,
].join('<br>')
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: 'px-0! pt-0! pb-3!' }">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs text-muted uppercase mb-1.5">
            Trend Pengajuan
          </p>
          <p class="text-3xl text-highlighted font-semibold tabular-nums">
            {{ formatNumber(total) }}
          </p>
          <p class="text-sm text-muted">
            Qty item pengajuan
          </p>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted" aria-label="Kategori chart">
          <span class="inline-flex items-center gap-1.5"><i class="size-2 rounded-full bg-info" />Qty item pengajuan</span>
          <span class="inline-flex items-center gap-1.5"><i class="size-2 rounded-full bg-success" />Item Disetujui</span>
          <span class="inline-flex items-center gap-1.5"><i class="size-2 rounded-full bg-error" />Item Ditolak</span>
        </div>
      </div>
    </template>

    <div v-if="loading" class="h-96 flex items-center justify-center text-sm text-muted">
      Memuat data chart...
    </div>
    <div v-else-if="!data.length" class="h-96 flex items-center justify-center text-sm text-muted">
      Belum ada data pada periode ini.
    </div>
    <VisXYContainer
      v-else
      :data="data"
      :padding="{ top: 40 }"
      :margin="{ left: -5, right: -5 }"
      class="h-96"
      :width="width"
    >
      <VisLine :x="x" :y="itemPengajuan" color="var(--ui-info)" />
      <VisLine :x="x" :y="itemDisetujui" color="var(--ui-success)" />
      <VisLine :x="x" :y="itemDitolak" color="var(--ui-error)" />
      <VisArea :x="x" :y="itemPengajuan" color="var(--ui-info)" :opacity="0.1" />

      <VisAxis type="x" :x="x" :tick-format="xTicks" />
      <VisCrosshair color="var(--ui-primary)" :template="template" />
      <VisTooltip />
    </VisXYContainer>
  </UCard>
</template>

<style scoped>
.unovis-xy-container {
  --vis-crosshair-line-stroke-color: var(--ui-primary);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);

  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);

  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
