<script setup lang="ts">

const stats = [{
  title: 'Total Pengajuan',
  icon: 'i-lucide-files',
  value: 279
}, {
  title: 'Pengajuan Baru',
  icon: 'i-lucide-clipboard-check',
  value: 10
}, {
  title: 'Item Disetujui',
  icon: 'i-lucide-file-check-corner',
  value: 249
}, {
  title: 'Item Ditolak',
  icon: 'i-lucide-file-x-corner',
  value: 20
}]


</script>

<template>
  <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
    <UPageCard
      v-for="(stat, index) in stats"
      :key="index"
      :icon="stat.icon"
      :title="stat.title"
      to="/pengajuan"
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
        <span class="text-2xl font-semibold text-highlighted">
          {{ stat.value }}
        </span>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
