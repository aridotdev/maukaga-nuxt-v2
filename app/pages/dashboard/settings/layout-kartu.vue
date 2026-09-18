<script setup lang="ts">
import type { AlertState, CardTypeKey, PrintLayout, PrintLayoutState } from '~/types/print'

definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

const toast = useToast()
const { isAdmin, isQrcc } = useUserProfile()

const printLayouts = ref<PrintLayout[]>([])
const activePrintLayoutIds = ref<Record<CardTypeKey, string>>({
  local: 'local-default',
  import: 'import-default',
})
const activePrintLayouts = ref<Record<CardTypeKey, PrintLayout | null>>({
  local: null,
  import: null,
})
const selectedLayoutType = ref<CardTypeKey>('local')
const selectedLayoutId = ref('')
const editingLayout = ref<PrintLayout>(createEmptyPrintLayout('local'))
const alertState = ref<AlertState>(null)
const isSaving = ref(false)
const canMutate = computed(() => isAdmin.value || isQrcc.value)

const layoutTypeItems = [{
  label: 'Local',
  value: 'local',
}, {
  label: 'Import',
  value: 'import',
}] satisfies Array<{ label: string; value: CardTypeKey }>

const layoutOptions = computed(() => {
  return printLayouts.value
    .filter(layout => layout.type === selectedLayoutType.value)
    .map(layout => ({
      label: `${layout.name}${layout.isBuiltin ? ' (bawaan)' : ''}${activePrintLayoutIds.value[selectedLayoutType.value] === layout.id ? ' - aktif' : ''}`,
      value: layout.id,
    }))
})

const {
  data: printLayoutState,
  status: printLayoutStatus,
  error: printLayoutError,
} = await useFetch<PrintLayoutState>('/api/admin/print-layouts', {
  default: () => createEmptyPrintLayoutState(),
})

const isLayoutLoading = computed(() => printLayoutStatus.value === 'pending' || isSaving.value)

watch(selectedLayoutType, () => syncSettingsSelection())

watch(selectedLayoutId, () => {
  const layout = printLayouts.value.find((item) => item.id === selectedLayoutId.value)
  if (layout) setEditingLayout(layout)
})

watch(printLayoutState, (state) => {
  if (state) applyPrintLayoutState(state)
}, { immediate: true })

watch(printLayoutError, (error) => {
  if (!error) return
  alertState.value = {
    type: 'error',
    title: 'Layout cetak belum bisa dimuat',
    description: getApiErrorMessage(error),
  }
}, { immediate: true })

function addPrintLayout() {
  if (!canMutate.value) return
  selectedLayoutId.value = ''
  setEditingLayout(createEmptyPrintLayout(selectedLayoutType.value))
}

function duplicateActivePrintLayout() {
  if (!canMutate.value) return
  const active = getActivePrintLayout(selectedLayoutType.value)
  setEditingLayout({
    ...active,
    id: '',
    name: `${active.name || 'Layout'} Copy`,
    isBuiltin: false,
  })
  selectedLayoutId.value = ''
}

async function savePrintLayoutForm() {
  if (!canMutate.value || isSaving.value) return
  const layout = normalizeEditingLayout()
  if (!layout) return

  isSaving.value = true
  try {
    const savedLayoutId = await savePrintLayout(layout)
    selectLayout(savedLayoutId)
    alertState.value = {
      type: 'success',
      title: 'Layout berhasil disimpan',
    }
    notify('Layout berhasil disimpan', 'success')
  } catch (error) {
    handleApiError(error, 'Layout gagal disimpan')
  } finally {
    isSaving.value = false
  }
}

async function setActivePrintLayoutFromForm() {
  if (!canMutate.value || isSaving.value) return
  const layout = normalizeEditingLayout()
  if (!layout) return

  isSaving.value = true
  try {
    const savedLayoutId = await savePrintLayout(layout)
    const result = await $fetch<PrintLayoutState>('/api/admin/print-layouts/active', {
      method: 'POST',
      body: {
        type: selectedLayoutType.value,
        id: savedLayoutId,
      },
    })

    applyPrintLayoutState(result)
    selectLayout(savedLayoutId)
    alertState.value = {
      type: 'success',
      title: 'Layout aktif berhasil diperbarui',
    }
    notify('Layout aktif berhasil diperbarui', 'success')
  } catch (error) {
    handleApiError(error, 'Layout aktif gagal diperbarui')
  } finally {
    isSaving.value = false
  }
}

async function savePrintLayout(layout: Omit<PrintLayout, 'isBuiltin'> & { isBuiltin?: boolean }) {
  const result = await $fetch<PrintLayoutState>('/api/admin/print-layouts', {
    method: 'POST',
    body: { layout },
  })

  applyPrintLayoutState(result)
  return result.savedLayoutId || layout.id
}

async function deletePrintLayoutFromForm() {
  if (!canMutate.value || isSaving.value) return
  if (!editingLayout.value.id || editingLayout.value.isBuiltin) return
  if (!window.confirm('Hapus layout custom ini?')) return

  isSaving.value = true
  try {
    const result = await $fetch<PrintLayoutState>(
      `/api/admin/print-layouts/${encodeURIComponent(editingLayout.value.id)}`,
      { method: 'DELETE' },
    )
    applyPrintLayoutState(result)
    alertState.value = {
      type: 'success',
      title: 'Layout berhasil dihapus',
    }
    notify('Layout berhasil dihapus', 'success')
  } catch (error) {
    handleApiError(error, 'Layout gagal dihapus')
  } finally {
    isSaving.value = false
  }
}

function normalizeEditingLayout() {
  const layout = {
    ...editingLayout.value,
    type: selectedLayoutType.value,
    name: String(editingLayout.value.name || '').trim(),
    offsetX: Number(editingLayout.value.offsetX || 0),
    offsetY: Number(editingLayout.value.offsetY || 0),
    gapProductModel: Number(editingLayout.value.gapProductModel || 0),
    gapModelSerial: Number(editingLayout.value.gapModelSerial || 0),
  }

  if (!layout.name) {
    showInlineError('Nama layout wajib diisi')
    return null
  }

  if (![layout.offsetX, layout.offsetY, layout.gapProductModel, layout.gapModelSerial]
    .every(Number.isFinite)) {
    showInlineError('Semua nilai posisi harus berupa angka')
    return null
  }

  return layout
}

function syncSettingsSelection(preferredId = '') {
  const activeId = activePrintLayoutIds.value[selectedLayoutType.value]
  const layouts = printLayouts.value.filter((layout) => layout.type === selectedLayoutType.value)
  const selectedId = preferredId
    && layouts.some(layout => layout.id === preferredId)
    ? preferredId
    : activeId || layouts[0]?.id || ''
  selectedLayoutId.value = selectedId

  const layout = layouts.find(item => item.id === selectedId)
  setEditingLayout(layout || createEmptyPrintLayout(selectedLayoutType.value))
}

function setEditingLayout(layout: PrintLayout) {
  editingLayout.value = {
    ...layout,
    offsetX: Number(layout.offsetX || 0),
    offsetY: Number(layout.offsetY || 0),
    gapProductModel: Number(layout.gapProductModel || 0),
    gapModelSerial: Number(layout.gapModelSerial || 0),
  }
}

function applyPrintLayoutState(data: PrintLayoutState) {
  printLayouts.value = data.layouts || []
  activePrintLayoutIds.value = data.active || {
    local: 'local-default',
    import: 'import-default',
  }
  activePrintLayouts.value = data.activeLayouts || {
    local: null,
    import: null,
  }
  syncSettingsSelection()
}

function getActivePrintLayout(type: CardTypeKey) {
  return activePrintLayouts.value[type]
    || printLayouts.value.find((layout) => layout.id === `${type}-default` && layout.type === type)
    || createEmptyPrintLayout(type)
}

function createEmptyPrintLayout(type: CardTypeKey): PrintLayout {
  return {
    id: '',
    type,
    name: '',
    offsetX: 0,
    offsetY: 0,
    gapProductModel: 0,
    gapModelSerial: 0,
    isBuiltin: false,
  }
}

function createEmptyPrintLayoutState(): PrintLayoutState {
  return {
    layouts: [],
    active: {
      local: 'local-default',
      import: 'import-default',
    },
    activeLayouts: {
      local: null,
      import: null,
    },
  }
}

function selectLayout(id: string) {
  selectedLayoutId.value = id
  const layout = printLayouts.value.find(item => item.id === id)
  if (layout) setEditingLayout(layout)
}

function showInlineError(message: string) {
  alertState.value = {
    type: 'error',
    title: message,
  }
  notify(message, 'error')
}

function notify(title: string, color: 'success' | 'error' | 'info') {
  toast.add({
    title,
    color,
    icon: color === 'success'
      ? 'i-lucide-circle-check'
      : color === 'error'
        ? 'i-lucide-circle-alert'
        : 'i-lucide-info',
  })
}

function handleApiError(error: unknown, fallback: string) {
  const message = getApiErrorMessage(error)
  alertState.value = {
    type: 'error',
    title: fallback,
    description: message
  }
  notify(message, 'error')
}

function getApiErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data as { message?: string; statusMessage?: string }
    return data.statusMessage || data.message || 'Operasi gagal diproses.'
  }

  if (error instanceof Error) return error.message
  return 'Operasi gagal diproses.'
}

function getAlertColor(type: NonNullable<AlertState>['type']) {
  return type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'
}

function getAlertIcon(type: NonNullable<AlertState>['type']) {
  return type === 'success'
    ? 'i-lucide-circle-check'
    : type === 'error'
      ? 'i-lucide-circle-alert'
      : 'i-lucide-info'
}
</script>

<template>
  <div class="space-y-6">
    <UPageCard
      title="Layout Kartu Garansi"
      description="Atur posisi field kartu garansi untuk tipe Local dan Import."
      variant="naked"
      orientation="horizontal"
    >
      <div class="flex flex-wrap gap-2 lg:ms-auto">
        <UButton
          label="Tambah Layout"
          icon="i-lucide-plus"
          color="neutral"
          variant="soft"
          :disabled="!canMutate"
          @click="addPrintLayout"
        />
        <UButton
          label="Duplikasi Aktif"
          icon="i-lucide-copy"
          color="neutral"
          variant="soft"
          :disabled="!canMutate"
          @click="duplicateActivePrintLayout"
        />
      </div>
    </UPageCard>

    <UAlert
      v-if="alertState"
      :color="getAlertColor(alertState.type)"
      :icon="getAlertIcon(alertState.type)"
      :title="alertState.title"
      :description="alertState.description"
      variant="subtle"
    />

    <UPageCard variant="subtle">
      <div class="grid gap-4 md:grid-cols-2">
        <UFormField label="Jenis Layout">
          <USelect v-model="selectedLayoutType" :items="layoutTypeItems" class="w-full" />
        </UFormField>

        <UFormField label="Layout">
          <USelect v-model="selectedLayoutId" :items="layoutOptions" class="w-full" />
        </UFormField>

        <UFormField label="Nama Layout" class="md:col-span-2">
          <UInput
            v-model="editingLayout.name"
            class="w-full"
            placeholder="Nama layout"
            :disabled="!canMutate"
          />
        </UFormField>

        <UFormField label="Offset X (mm)">
          <UInput
            v-model.number="editingLayout.offsetX"
            type="number"
            step="0.1"
            class="w-full"
            :disabled="!canMutate"
          />
        </UFormField>

        <UFormField label="Offset Y (mm)">
          <UInput
            v-model.number="editingLayout.offsetY"
            type="number"
            step="0.1"
            class="w-full"
            :disabled="!canMutate"
          />
        </UFormField>

        <UFormField label="Gap Produk ke Model (mm)">
          <UInput
            v-model.number="editingLayout.gapProductModel"
            type="number"
            step="0.1"
            class="w-full"
            :disabled="!canMutate"
          />
        </UFormField>

        <UFormField label="Gap Model ke Serial (mm)">
          <UInput
            v-model.number="editingLayout.gapModelSerial"
            type="number"
            step="0.1"
            class="w-full"
            :disabled="!canMutate"
          />
        </UFormField>
      </div>

      <USeparator class="my-5" />

      <div class="flex flex-wrap justify-end gap-2">
        <UButton
          label="Hapus"
          icon="i-lucide-trash-2"
          color="error"
          variant="soft"
          :disabled="!canMutate || !editingLayout.id || editingLayout.isBuiltin || isLayoutLoading"
          @click="deletePrintLayoutFromForm"
        />
        <UButton
          label="Jadikan Aktif"
          icon="i-lucide-check"
          color="neutral"
          variant="soft"
          :disabled="!canMutate || !editingLayout.id || isLayoutLoading"
          @click="setActivePrintLayoutFromForm"
        />
        <UButton
          label="Simpan Layout"
          icon="i-lucide-save"
          color="primary"
          :disabled="!canMutate"
          :loading="isLayoutLoading"
          @click="savePrintLayoutForm"
        />
      </div>
    </UPageCard>

    <UPageCard
      title="Panduan Offset dan Gap"
      description="Gunakan nilai kecil seperti 0.5 mm atau 1 mm, lalu cek kembali preview atau hasil cetak."
      variant="subtle"
    >
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-md border border-default bg-default/50 p-4">
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-highlighted">
            <UIcon name="i-lucide-move-horizontal" class="size-4 text-primary" />
            <span>Offset X (kanan / kiri)</span>
          </div>
          <dl class="space-y-2 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Nilai positif (+)</dt>
              <dd class="font-medium text-highlighted">geser ke kanan</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Nilai negatif (-)</dt>
              <dd class="font-medium text-highlighted">geser ke kiri</dd>
            </div>
          </dl>
        </div>

        <div class="rounded-md border border-default bg-default/50 p-4">
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-highlighted">
            <UIcon name="i-lucide-move-vertical" class="size-4 text-primary" />
            <span>Offset Y (atas / bawah)</span>
          </div>
          <dl class="space-y-2 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Nilai positif (+)</dt>
              <dd class="font-medium text-highlighted">geser ke bawah</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Nilai negatif (-)</dt>
              <dd class="font-medium text-highlighted">geser ke atas</dd>
            </div>
          </dl>
        </div>

        <div class="rounded-md border border-default bg-default/50 p-4 md:col-span-2">
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-highlighted">
            <UIcon name="i-lucide-ruler" class="size-4 text-primary" />
            <span>Gap antar field</span>
          </div>
          <dl class="grid gap-3 text-sm sm:grid-cols-2">
            <div class="rounded-md bg-muted/50 p-3">
              <dt class="font-medium text-highlighted">Gap Produk ke Model</dt>
              <dd class="mt-1 text-muted">
                Mengatur jarak dari Produk ke Model. Nilai positif memperbesar jarak, nilai negatif mempersempit jarak.
              </dd>
            </div>
            <div class="rounded-md bg-muted/50 p-3">
              <dt class="font-medium text-highlighted">Gap Model ke Serial</dt>
              <dd class="mt-1 text-muted">
                Mengatur jarak dari Model ke Serial. Nilai positif memperbesar jarak, nilai negatif mempersempit jarak.
              </dd>
            </div>
          </dl>
        </div>

        <div class="rounded-md border border-default bg-default/50 p-4 md:col-span-2">
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-highlighted">
            <UIcon name="i-lucide-list-checks" class="size-4 text-primary" />
            <span>Contoh cepat</span>
          </div>
          <div class="grid gap-2 text-sm text-muted sm:grid-cols-2">
            <p><span class="font-medium text-highlighted">X = 2</span> berarti posisi bergeser 2 mm ke kanan.</p>
            <p><span class="font-medium text-highlighted">X = -2</span> berarti posisi bergeser 2 mm ke kiri.</p>
            <p><span class="font-medium text-highlighted">Y = 2</span> berarti posisi bergeser 2 mm ke bawah.</p>
            <p><span class="font-medium text-highlighted">Y = -2</span> berarti posisi bergeser 2 mm ke atas.</p>
            <p><span class="font-medium text-highlighted">Gap = 1</span> berarti jarak antar field makin renggang 1 mm.</p>
            <p><span class="font-medium text-highlighted">Gap = -1</span> berarti jarak antar field makin rapat 1 mm.</p>
          </div>
        </div>
      </div>
    </UPageCard>
  </div>
</template>
