<script setup lang="ts">
import type { AlertState, CardTypeKey, PrintLayout, PrintLayoutState } from '~/types/print'

definePageMeta({
  middleware: ['auth-guard', 'role-guard']
})

const toast = useToast()
const router = useRouter()
const { callApi } = useAppsScriptApi()

const printLayouts = ref<PrintLayout[]>([])
const activePrintLayoutIds = ref<Record<CardTypeKey, string>>({
  local: 'local-default',
  import: 'import-default'
})
const activePrintLayouts = ref<Record<CardTypeKey, PrintLayout | null>>({
  local: null,
  import: null
})
const selectedLayoutType = ref<CardTypeKey>('local')
const selectedLayoutId = ref('')
const editingLayout = ref<PrintLayout>(createEmptyPrintLayout('local'))
const isLayoutLoading = ref(false)
const alertState = ref<AlertState>(null)

const layoutTypeItems = [{
  label: 'Local',
  value: 'local'
}, {
  label: 'Import',
  value: 'import'
}]

const layoutOptions = computed(() => {
  return printLayouts.value
    .filter((layout) => layout.type === selectedLayoutType.value)
    .map((layout) => ({
      label: `${layout.name}${layout.isBuiltin ? ' (bawaan)' : ''}${activePrintLayoutIds.value[selectedLayoutType.value] === layout.id ? ' - aktif' : ''}`,
      value: layout.id
    }))
})

watch(selectedLayoutType, () => {
  syncSettingsSelection()
})

watch(selectedLayoutId, () => {
  const layout = printLayouts.value.find((item) => item.id === selectedLayoutId.value)
  if (layout) setEditingLayout(layout)
})

onMounted(() => {
  loadPrintLayouts(false)
})

async function loadPrintLayouts(showToast = true) {
  isLayoutLoading.value = true

  try {
    const result = await callApi<PrintLayoutState>('getPrintLayouts')
    if (!result.success || !result.data) throw new Error(result.error || 'Gagal memuat layout cetak')

    applyPrintLayoutState(result.data)
    alertState.value = null
    if (showToast) notify('Layout cetak dimuat', 'success')
  } catch (error) {
    await handleApiError(error, 'Layout cetak belum bisa dimuat')
  } finally {
    isLayoutLoading.value = false
  }
}

function addPrintLayout() {
  selectedLayoutId.value = ''
  setEditingLayout(createEmptyPrintLayout(selectedLayoutType.value))
}

function duplicateActivePrintLayout() {
  const active = getActivePrintLayout(selectedLayoutType.value)
  setEditingLayout({
    ...active,
    id: '',
    name: `${active.name || 'Layout'} Copy`,
    isBuiltin: false
  })
  selectedLayoutId.value = ''
}

async function savePrintLayoutForm() {
  const layout = normalizeEditingLayout()
  if (!layout) return

  isLayoutLoading.value = true
  try {
    const savedLayoutId = await savePrintLayout(layout)
    selectedLayoutId.value = savedLayoutId
    alertState.value = {
      type: 'success',
      title: 'Layout berhasil disimpan'
    }
    notify('Layout berhasil disimpan', 'success')
  } catch (error) {
    await handleApiError(error, 'Layout gagal disimpan')
  } finally {
    isLayoutLoading.value = false
  }
}

async function setActivePrintLayoutFromForm() {
  const layout = normalizeEditingLayout()
  if (!layout) return

  isLayoutLoading.value = true
  try {
    const savedLayoutId = await savePrintLayout(layout)
    const result = await callApi<PrintLayoutState>('setActivePrintLayout', {
      type: selectedLayoutType.value,
      id: savedLayoutId
    })
    if (!result.success || !result.data) throw new Error(result.error || 'Gagal mengubah layout aktif')

    applyPrintLayoutState(result.data)
    selectedLayoutId.value = savedLayoutId
    alertState.value = {
      type: 'success',
      title: 'Layout aktif berhasil diperbarui'
    }
    notify('Layout aktif berhasil diperbarui', 'success')
  } catch (error) {
    await handleApiError(error, 'Layout aktif gagal diperbarui')
  } finally {
    isLayoutLoading.value = false
  }
}

async function savePrintLayout(layout: PrintLayout) {
  const result = await callApi<PrintLayoutState>('savePrintLayout', { layout })
  if (!result.success || !result.data) throw new Error(result.error || 'Gagal menyimpan layout')

  applyPrintLayoutState(result.data)
  return result.data.savedLayoutId || layout.id
}

async function deletePrintLayoutFromForm() {
  if (!editingLayout.value.id || editingLayout.value.isBuiltin) return
  if (!window.confirm('Hapus layout custom ini?')) return

  isLayoutLoading.value = true
  try {
    const result = await callApi<PrintLayoutState>('deletePrintLayout', { id: editingLayout.value.id })
    if (!result.success || !result.data) throw new Error(result.error || 'Gagal menghapus layout')

    applyPrintLayoutState(result.data)
    syncSettingsSelection()
    alertState.value = {
      type: 'success',
      title: 'Layout berhasil dihapus'
    }
    notify('Layout berhasil dihapus', 'success')
  } catch (error) {
    await handleApiError(error, 'Layout gagal dihapus')
  } finally {
    isLayoutLoading.value = false
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
    gapModelSerial: Number(editingLayout.value.gapModelSerial || 0)
  }

  if (!layout.name) {
    showInlineError('Nama layout wajib diisi')
    return null
  }

  if (![layout.offsetX, layout.offsetY, layout.gapProductModel, layout.gapModelSerial].every(Number.isFinite)) {
    showInlineError('Semua nilai posisi harus berupa angka')
    return null
  }

  return layout
}

function syncSettingsSelection() {
  const activeId = activePrintLayoutIds.value[selectedLayoutType.value]
  const layouts = printLayouts.value.filter((layout) => layout.type === selectedLayoutType.value)
  const fallbackId = layouts[0]?.id || ''
  selectedLayoutId.value = activeId || fallbackId

  const layout = layouts.find((item) => item.id === selectedLayoutId.value)
  setEditingLayout(layout || createEmptyPrintLayout(selectedLayoutType.value))
}

function setEditingLayout(layout: PrintLayout) {
  editingLayout.value = {
    ...layout,
    offsetX: Number(layout.offsetX || 0),
    offsetY: Number(layout.offsetY || 0),
    gapProductModel: Number(layout.gapProductModel || 0),
    gapModelSerial: Number(layout.gapModelSerial || 0)
  }
}

function applyPrintLayoutState(data: PrintLayoutState) {
  printLayouts.value = data.layouts || []
  activePrintLayoutIds.value = data.active || {
    local: 'local-default',
    import: 'import-default'
  }
  activePrintLayouts.value = data.activeLayouts || {
    local: null,
    import: null
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
    isBuiltin: false
  }
}

function showInlineError(message: string) {
  alertState.value = {
    type: 'error',
    title: message
  }
  notify(message, 'error')
}

function notify(title: string, color: 'success' | 'error' | 'info') {
  toast.add({
    title,
    color,
    icon: color === 'success' ? 'i-lucide-circle-check' : color === 'error' ? 'i-lucide-circle-alert' : 'i-lucide-info'
  })
}

async function handleApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error || fallback)
  alertState.value = {
    type: 'error',
    title: fallback,
    description: message
  }
  notify(message, 'error')

  if (message.includes('Unauthorized')) {
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_nama')
    sessionStorage.removeItem('admin_username')
    await router.push('/login')
  }
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
          @click="addPrintLayout"
        />
        <UButton
          label="Duplikasi Aktif"
          icon="i-lucide-copy"
          color="neutral"
          variant="soft"
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
          <UInput v-model="editingLayout.name" class="w-full" placeholder="Nama layout" />
        </UFormField>

        <UFormField label="Offset X (mm)">
          <UInput v-model.number="editingLayout.offsetX" type="number" step="0.1" class="w-full" />
        </UFormField>

        <UFormField label="Offset Y (mm)">
          <UInput v-model.number="editingLayout.offsetY" type="number" step="0.1" class="w-full" />
        </UFormField>

        <UFormField label="Gap Produk ke Model (mm)">
          <UInput v-model.number="editingLayout.gapProductModel" type="number" step="0.1" class="w-full" />
        </UFormField>

        <UFormField label="Gap Model ke Serial (mm)">
          <UInput v-model.number="editingLayout.gapModelSerial" type="number" step="0.1" class="w-full" />
        </UFormField>
      </div>

      <USeparator class="my-5" />

      <div class="flex flex-wrap justify-end gap-2">
        <UButton
          label="Hapus"
          icon="i-lucide-trash-2"
          color="error"
          variant="soft"
          :disabled="!editingLayout.id || editingLayout.isBuiltin || isLayoutLoading"
          @click="deletePrintLayoutFromForm"
        />
        <UButton
          label="Jadikan Aktif"
          icon="i-lucide-check"
          color="neutral"
          variant="soft"
          :disabled="!editingLayout.id || isLayoutLoading"
          @click="setActivePrintLayoutFromForm"
        />
        <UButton
          label="Simpan Layout"
          icon="i-lucide-save"
          color="primary"
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
