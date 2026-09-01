<script setup lang="ts">
const { source, setSource } = useDashboardDataSource()

type SourceOption = {
  key: 'active' | 'archive'
  label: string
  icon: string
}

const sourceOptions: SourceOption[] = [{
  key: 'active',
  label: 'Active',
  icon: 'i-lucide-bolt'
}, {
  key: 'archive',
  label: 'Local',
  icon: 'i-lucide-database'
}]

async function selectSource(nextSource: SourceOption['key']) {
  await setSource(nextSource)
}
</script>

<template>
  <div class="inline-grid grid-cols-2 overflow-hidden rounded-lg border border-muted bg-elevated/40 p-1 shadow-sm">
    <UButton
      v-for="option in sourceOptions"
      :key="option.key"
      :icon="option.icon"
      :label="option.label"
      size="sm"
      :variant="source === option.key ? 'soft' : 'ghost'"
      :color="source === option.key ? 'primary' : 'neutral'"
      class="w-full rounded-none justify-center"
      :aria-pressed="source === option.key"
      @click="selectSource(option.key)"
    />
  </div>
</template>