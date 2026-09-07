<script setup lang="ts">
const props = defineProps<{
  collapsed?: boolean
}>()
const isCollapsed = computed(() => !!props.collapsed)

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

const containerClass = computed(() =>
  props.collapsed
    ? 'inline-flex flex-col overflow-hidden rounded-lg border border-muted bg-elevated/40 p-1 shadow-sm'
    : 'inline-grid w-full grid-cols-2 overflow-hidden rounded-lg border border-muted bg-elevated/40 p-1 shadow-sm'
)

const buttonClass = computed(() =>
  props.collapsed
    ? 'w-8 h-8 rounded-md justify-center p-0'
    : 'w-full rounded-none justify-center'
)
</script>

<template>
  <div :class="containerClass">
    <UButton
      v-for="option in sourceOptions"
      :key="option.key"
      :icon="option.icon"
      :label="isCollapsed ? undefined : option.label"
      size="sm"
      :variant="source === option.key ? 'soft' : 'ghost'"
      :color="source === option.key ? 'primary' : 'neutral'"
      :class="buttonClass"
      :aria-pressed="source === option.key"
      :aria-label="option.label"
      @click="selectSource(option.key)"
    />
  </div>
</template>
