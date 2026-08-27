<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel, type Table } from '@tanstack/table-core'
import type {
  CardTypeFilter,
  CardTypeKey,
  PrintLayout,
  PrintLayoutState,
  WarrantyPrintQueueResponse,
  WarrantyPrintQueueRow
} from '~/types/print'
import { getPrintRowKey, matchesPrintRowSearch } from '~/utils/print'
import { useWarrantyPrintQueue } from '~/composables/useWarrantyPrintQueue'

definePageMeta({
  middleware: ['auth-guard', 'role-guard']
})

type WarrantyTableRef = {
  tableApi?: Table<WarrantyPrintQueueRow>
}

const UBadge = resolveComponent('UBadge')
const UCheckbox = resolveComponent('UCheckbox')

const QUEUE_RELOAD_DEBOUNCE_MS = 300
const QUEUE_LIMIT_ERROR_PATTERN = /argument too large/i

function normalizeCardTypeKey(value: unknown): CardTypeKey | '' {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'local' || normalized === 'lokal') return 'local'
  if (normalized === 'import' || normalized === 'impor') return 'import'
  return ''
}

function normalizeWarrantyPrintRow(row: WarrantyPrintQueueRow): WarrantyPrintQueueRow {
  const jenisKartuKey = normalizeCardTypeKey(row.jenisKartuKey) || normalizeCardTypeKey(row.jenisKartu)

  return {
    ...row,
    key: getPrintRowKey(row),
    jenisKartuKey,
    jenisKartu: jenisKartuKey === 'local' ? 'Local' : jenisKartuKey === 'import' ? 'Import' : ''
  }
}

const router = useRouter()
const selectedPrintKeys = ref<Set<string>>(new Set())
const {
  printQueue,
  isQueueLoading,
  queueLoadError,
  loadQueue,
  toggleVisiblePrintRows,
  withApiError,
  notify,
  callApi
} = useWarrantyPrintQueue({
  selectedKeys: selectedPrintKeys,
  fetchQueue: (params) => callApi<WarrantyPrintQueueResponse>('getWarrantyPrintQueue', params || {}),
  normalize: (rows) => rows.map(normalizeWarrantyPrintRow)
})

const adminName = ref('Admin')
const search = ref('')
const cardTypeFilter = ref<CardTypeFilter>('all')
const isActionLoading = ref(false)
const confirmPrintedOpen = ref(false)
const activePrintLayouts = ref<Record<CardTypeKey, PrintLayout | null>>({
  local: null,
  import: null
})
const warrantyPrintRows = ref<WarrantyPrintQueueRow[]>([])
const warrantyPrintRef = ref<{ print: () => Promise<void> } | null>(null)
const isPrinting = ref(false)
const warrantyTable = useTemplateRef<WarrantyTableRef>('warrantyTable')
let queueReloadTimer: ReturnType<typeof setTimeout> | null = null
const warrantyPagination = ref({
  pageIndex: 0,
  pageSize: 15
})

function endPrinting() {
  isPrinting.value = false
}

const cardTypeFilterItems = [{
  label: 'Semua Jenis',
  value: 'all'
}, {
  label: 'Local',
  value: 'local'
}, {
  label: 'Import',
  value: 'import'
}, {
  label: 'Belum Dipilih',
  value: 'unset'
}]

const printTableGlobalFilterOptions = {
  globalFilterFn: (row: { original: WarrantyPrintQueueRow }, _columnId: string, filterValue: unknown) =>
    matchesPrintRowSearch(row.original, String(filterValue || '').trim().toLowerCase())
}

const visiblePrintRows = computed(() => {
  const typeOrder: Record<string, number> = { local: 1, import: 2, '': 3 }
  const keyword = search.value.trim().toLowerCase()

  return printQueue.value
    .filter((row) => {
      if (cardTypeFilter.value === 'unset') return !row.jenisKartuKey
      if (cardTypeFilter.value === 'all') return true
      return row.jenisKartuKey === cardTypeFilter.value
    })
    .filter((row) => {
      if (!keyword) return true

      return matchesPrintRowSearch(row, keyword)
    })
    .toSorted((a, b) =>
      (typeOrder[a.jenisKartuKey || ''] || 3) - (typeOrder[b.jenisKartuKey || ''] || 3)
      || String(a.idPengajuan).localeCompare(String(b.idPengajuan))
      || Number(a.noItem) - Number(b.noItem)
    )
})

const visibleSummary = computed(() => {
  return visiblePrintRows.value.reduce(
    (summary, row) => {
      if (row.jenisKartuKey === 'local') summary.local += 1
      else if (row.jenisKartuKey === 'import') summary.import += 1
      else summary.unset += 1
      return summary
    },
    { total: visiblePrintRows.value.length, local: 0, import: 0, unset: 0 }
  )
})
const warrantyTableRows = computed(() => isQueueLoading.value ? [] : visiblePrintRows.value)

const selectedRows = computed(() => {
  return Array.from(selectedPrintKeys.value)
    .map((key) => printQueue.value.find((row) => getPrintRowKey(row) === key))
    .filter(Boolean) as WarrantyPrintQueueRow[]
})

const selectedRowsSorted = computed(() => {
  const typeOrder: Record<string, number> = { local: 1, import: 2, '': 3 }

  return [...selectedRows.value].sort((a, b) =>
    (typeOrder[a.jenisKartuKey || ''] || 3) - (typeOrder[b.jenisKartuKey || ''] || 3)
    || String(a.idPengajuan).localeCompare(String(b.idPengajuan))
    || Number(a.noItem) - Number(b.noItem)
  )
})

const visibleKeys = computed(() => visiblePrintRows.value.map((row) => getPrintRowKey(row)))
const selectedVisibleCount = computed(() => visibleKeys.value.filter((key) => selectedPrintKeys.value.has(key)).length)
const allVisibleSelected = computed(() => visibleKeys.value.length > 0 && selectedVisibleCount.value === visibleKeys.value.length)
const someVisibleSelected = computed(() => selectedVisibleCount.value > 0 && selectedVisibleCount.value < visibleKeys.value.length)
const checkboxAllState = computed(() => someVisibleSelected.value ? 'indeterminate' : allVisibleSelected.value)
const warrantyPaginationTotal = computed<number>(() => warrantyTable.value?.tableApi?.getFilteredRowModel().rows.length || 0)
const warrantyCurrentPage = computed<number>(() =>
  (warrantyTable.value?.tableApi?.getState().pagination.pageIndex ?? warrantyPagination.value.pageIndex) + 1
)
const warrantyItemsPerPage = computed<number>(() =>
  warrantyTable.value?.tableApi?.getState().pagination.pageSize || warrantyPagination.value.pageSize
)
const queueLoadErrorMessage = computed(() => {
  if (!QUEUE_LIMIT_ERROR_PATTERN.test(queueLoadError.value)) return queueLoadError.value

  return 'Antrean terlalu besar untuk dimuat sekaligus. Gunakan pencarian spesifik atau filter Local/Import, lalu refresh.'
})

const warrantyColumns: TableColumn<WarrantyPrintQueueRow>[] = [{
  id: 'select',
  header: () => h(UCheckbox, {
    modelValue: checkboxAllState.value,
    'aria-label': 'Pilih semua item tampil',
    'onUpdate:modelValue': (value: boolean | 'indeterminate') => toggleVisiblePrintRows(visibleKeys.value, !!value)
  }),
  cell: ({ row }) => h(UCheckbox, {
    modelValue: selectedPrintKeys.value.has(getPrintRowKey(row.original)),
    'aria-label': `Pilih ${row.original.idPengajuan} item ${row.original.noItem}`,
    'onUpdate:modelValue': (value: boolean | 'indeterminate') => handlePrintRowCheck(getPrintRowKey(row.original), !!value)
  }),
  meta: {
    class: {
      th: 'w-12',
      td: 'w-12'
    }
  }
}, {
  accessorKey: 'idPengajuan',
  header: 'ID',
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'font-mono text-sm font-bold text-highlighted' }, row.original.idPengajuan),
  ])
}, {
  accessorKey: 'noItem',
  header: 'Item',
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'mt-1 text-xs text-muted' }, `Item #${row.original.noItem}`)
  ])
}, {
  accessorKey: 'bagianCabang',
  header: 'Cabang',
  cell: ({ row }) => h('div', [
    h('p', { class: 'text-sm' }, row.original.bagianCabang || '-'),
  ])
}, {
  accessorKey: 'nama',
  header: 'Nama',
  cell: ({ row }) => h('div', [
    h('p', { class: 'text-sm' }, row.original.nama || '-')
  ])
}, {
  accessorKey: 'produk',
  header: 'Detail Produk',
  cell: ({ row }) => h('div', [
    h('p', { class: 'text-sm' }, row.original.produk || '-'),
  ])
}, {
  accessorKey: 'model',
  header: 'Name Model',
  cell: ({ row }) => h('div', [
    h('p', { class: 'text-sm' }, row.original.model || '-'),
  ])
}, {
  accessorKey: 'nomorSeri',
  header: 'Nomor Seri',
  cell: ({ row }) => h('div', [
    h('p', { class: 'text-sm' }, row.original.nomorSeri || '-'),
  ])
}, {
  accessorKey: 'jenisKartu',
  header: 'Jenis Kartu',
  cell: ({ row }) => h('div', [
    h(UBadge, {
      color: row.original.jenisKartuKey === 'local' ? 'info' : row.original.jenisKartuKey === 'import' ? 'warning' : 'neutral',
      variant: 'subtle',
      label: row.original.jenisKartuKey === 'local' ? 'Local' : row.original.jenisKartuKey === 'import' ? 'Import' : 'Belum Dipilih',
      class: 'w-fit text-xs text-muted'
    }),
  ])
}, {
  accessorKey: 'statusCetak',
  header: 'Status',
  cell: ({ row }) => h('div', { class: 'flex flex-col gap-1' }, [
    h(UBadge, {
      color: row.original.statusCetak === 'Printed' ? 'success' : 'error',
      variant: 'subtle',
      label: row.original.statusCetak === 'Printed' ? 'Printed' : 'Belum Dicetak',
      class: 'w-fit text-xs text-muted'
    }),
    row.original.reprintCount
      ? h('span', { class: 'text-xs text-muted' }, `Reprint ${row.original.reprintCount}x`)
      : null
  ])
}]

onMounted(async () => {
  adminName.value = sessionStorage.getItem('admin_nama') || 'Admin'
  if (!sessionStorage.getItem('admin_token')) {
    await router.replace('/login')
    return
  }

  await Promise.all([
    loadPrintLayouts(),
    loadWarrantyPrintQueue(false)
  ])
})

onBeforeUnmount(() => {
  clearScheduledQueueReload()
})

watch([search, cardTypeFilter], () => {
  warrantyTable.value?.tableApi?.setPageIndex(0)
  scheduleWarrantyPrintQueueLoad()
})

async function loadPrintLayouts() {
  await withApiError(async () => {
    const result = await callApi<PrintLayoutState>('getPrintLayouts')
    if (!result.success || !result.data) throw new Error(result.error || 'Gagal memuat layout cetak')

    activePrintLayouts.value = result.data.activeLayouts || {
      local: null,
      import: null
    }
  }, 'Layout cetak belum bisa dimuat')
}

function getWarrantyPrintQueueParams() {
  const params: Record<string, unknown> = {}
  const keyword = search.value.trim()

  if (keyword) params.search = keyword
  if (cardTypeFilter.value === 'local' || cardTypeFilter.value === 'import') {
    params.jenisKartu = cardTypeFilter.value
  }

  return params
}

function clearScheduledQueueReload() {
  if (queueReloadTimer) clearTimeout(queueReloadTimer)
  queueReloadTimer = null
}

function scheduleWarrantyPrintQueueLoad() {
  clearScheduledQueueReload()

  queueReloadTimer = setTimeout(() => {
    queueReloadTimer = null
    void loadWarrantyPrintQueue()
  }, QUEUE_RELOAD_DEBOUNCE_MS)
}

async function loadWarrantyPrintQueue(showLoading = true) {
  clearScheduledQueueReload()
  await loadQueue(getWarrantyPrintQueueParams(), showLoading)
}

async function saveWarrantyCardTypes(items: Array<{ idPengajuan: string, noItem: string | number, jenisKartu: string }>, successMessage: string) {
  isActionLoading.value = true

  try {
    const result = await callApi<{ count: number }>('saveWarrantyCardTypes', { items })
    if (!result.success) throw new Error(result.error || 'Gagal menyimpan jenis kartu')

    notify(successMessage, 'success', `${result.data?.count || items.length} item berhasil diperbarui.`)
  } catch (error) {
    notify('Jenis kartu gagal disimpan', 'error', String(error instanceof Error ? error.message : error))
    throw error
  } finally {
    isActionLoading.value = false
  }
}

async function setSelectedCardType(jenisKartu: CardTypeKey) {
  const rows = selectedRows.value
  if (!rows.length) {
    showActionError('Pilih item terlebih dahulu')
    return
  }

  await saveWarrantyCardTypes(rows.map((row) => ({
    idPengajuan: row.idPengajuan,
    noItem: row.noItem,
    jenisKartu
  })), `Jenis kartu batch disimpan sebagai ${jenisKartu === 'local' ? 'Local' : 'Import'}`)

  updateRowsCardType(rows.map((row) => getPrintRowKey(row)), jenisKartu)
}

async function printSelectedWarrantyCards() {
  if (isPrinting.value) return

  const rows = selectedRowsSorted.value
  if (!rows.length) {
    showActionError('Pilih item yang ingin dicetak')
    return
  }

  if (!ensureRowsHaveCardType(rows)) return

  // Set guard sebelum await apa pun agar klik beruntun yang
  // jatuh sebelum `print()` siap tetap ditolak. Reset dilakukan
  // oleh prop `onAfterPrint` saat dialog print ditutup.
  isPrinting.value = true

  await loadPrintLayouts()
  warrantyPrintRows.value = rows
  notify(
    `${rows.length} kartu siap dicetak`,
    'info',
    'Dialog print browser akan terbuka. Status printed belum disimpan sampai Anda menandainya.'
  )
  // Fire-and-forget: tombol tetap loading sampai dialog ditutup.
  warrantyPrintRef.value?.print().catch(() => endPrinting())
}

function openConfirmPrinted() {
  const rows = selectedRowsSorted.value
  if (!rows.length) {
    showActionError('Pilih item yang sudah dicetak')
    return
  }

  if (!ensureRowsHaveCardType(rows)) return
  confirmPrintedOpen.value = true
}

async function markSelectedWarrantyCardsPrinted() {
  const rows = selectedRowsSorted.value
  if (!rows.length) return

  confirmPrintedOpen.value = false
  isActionLoading.value = true

  await withApiError(async () => {
    const result = await callApi<{ batchId: string, count: number }>('markWarrantyCardsPrinted', {
      items: rows.map((row) => ({
        idPengajuan: row.idPengajuan,
        noItem: row.noItem,
        jenisKartu: row.jenisKartuKey
      }))
    })
    if (!result.success || !result.data) throw new Error(result.error || 'Gagal menandai kartu tercetak')

    selectedPrintKeys.value = new Set()
    await loadWarrantyPrintQueue(false)
    notify(
      `Batch ${result.data.batchId} tersimpan`,
      'success',
      `${result.data.count} kartu berhasil ditandai Printed.`
    )
  }, 'Status cetak gagal disimpan')

  isActionLoading.value = false
}

function handlePrintRowCheck(key: string, checked: boolean) {
  const next = new Set(selectedPrintKeys.value)
  if (checked) next.add(key)
  else next.delete(key)
  selectedPrintKeys.value = next
}

function setWarrantyPage(page: number) {
  warrantyTable.value?.tableApi?.setPageIndex(page - 1)
}

function updateRowsCardType(keys: string[], jenisKartu: CardTypeKey) {
  const keySet = new Set(keys)
  printQueue.value = printQueue.value.map((row) => {
    if (!keySet.has(getPrintRowKey(row))) return row

    return {
      ...row,
      jenisKartuKey: jenisKartu,
      jenisKartu: jenisKartu === 'local' ? 'Local' : 'Import'
    }
  })
}

function ensureRowsHaveCardType(rows: WarrantyPrintQueueRow[]) {
  const missing = rows.filter((row) => !row.jenisKartuKey)
  if (missing.length) {
    showActionError(`${missing.length} item belum dipilih jenis kartunya`)
    return false
  }

  return true
}

function showActionError(message: string) {
  notify(message, 'error')
}
</script>

<template>
  <div class="contents">
    <UDashboardPanel id="cetak-kartu">
      <template #header>
        <UDashboardNavbar title="Cetak Kartu Garansi" :description="`Halo, ${adminName}`">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="space-y-6">
          <PrintCetakKartuStats
            :summary="visibleSummary"
            :selected-count="selectedPrintKeys.size"
            :loading="isQueueLoading"
          />

          <section class="relative rounded-lg border border-muted bg-default/45 shadow-sm backdrop-blur-xl">
            <div class="min-h-0 w-full overflow-x-auto">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-accented px-4 py-3.5">
                <UInput
                  v-model="search"
                  class="w-full max-w-sm"
                  icon="i-lucide-search"
                  placeholder="Cari ID, cabang, nama, produk, model, atau serial..."
                />

                <div class="flex flex-wrap items-center gap-2">
                  <USelect
                    v-model="cardTypeFilter"
                    :items="cardTypeFilterItems"
                    class="w-full sm:w-44"
                    :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
                  />

                  <UButton
                    label="Refresh"
                    icon="i-lucide-refresh-cw"
                    color="neutral"
                    variant="soft"
                    :loading="isQueueLoading"
                    @click="loadWarrantyPrintQueue()"
                  />
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-accented px-4 py-3">
                <p class="text-sm text-muted">
                  {{ selectedRows.length }} dari {{ visiblePrintRows.length }} item tampil dipilih.
                </p>

                <div class="flex flex-wrap items-center gap-2">
                  <UButton
                    label="Set Local"
                    color="neutral"
                    variant="soft"
                    size="sm"
                    :disabled="!selectedRows.length || isActionLoading"
                    @click="setSelectedCardType('local')"
                  />
                  <UButton
                    label="Set Import"
                    color="neutral"
                    variant="soft"
                    size="sm"
                    :disabled="!selectedRows.length || isActionLoading"
                    @click="setSelectedCardType('import')"
                  />
                  <UButton
                    label="Cetak"
                    icon="i-lucide-printer"
                    color="primary"
                    size="sm"
                    :loading="isPrinting"
                    :disabled="!selectedRows.length || isPrinting"
                    @click="printSelectedWarrantyCards"
                  />
                  <UButton
                    label="Tandai Printed"
                    icon="i-lucide-circle-check"
                    color="success"
                    variant="soft"
                    size="sm"
                    :disabled="!selectedRows.length || isActionLoading"
                    @click="openConfirmPrinted"
                  />
                </div>
              </div>

              

              <UTable
                ref="warrantyTable"
                v-model:pagination="warrantyPagination"
                v-model:global-filter="search"
                :get-row-id="getPrintRowKey"
                :data="warrantyTableRows"
                :columns="warrantyColumns"
                :global-filter-options="printTableGlobalFilterOptions"
                :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
                :loading="isQueueLoading"
                loading-color="primary"
                loading-animation="carousel"
                class="w-full"
                :ui="{
                  root: 'w-full',
                  base: 'w-full min-w-190 table-fixed border-separate border-spacing-0',
                  thead: '[&>tr]:bg-elevated/45 [&>tr]:after:content-none',
                  tbody: '[&>tr]:last:[&>td]:border-b-0',
                  tr: 'transition-colors hover:bg-elevated/30',
                  th: 'border-b border-muted px-4 py-3 text-xs font-semibold uppercase text-muted',
                  td: 'border-b border-muted px-4 py-4 text-sm align-middle',
                  separator: 'h-0'
                }"
              >
                <template #loading>
                  <div
                    class="flex flex-col items-center justify-center gap-2 py-8 text-center text-primary"
                    role="status"
                    aria-live="polite"
                  >
                    <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
                    <p class="text-sm font-medium">
                      Loading ...
                    </p>
                  </div>
                </template>

                <template #empty>
                  <div class="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <UIcon
                      :name="queueLoadError ? 'i-lucide-circle-alert' : 'i-lucide-inbox'"
                      class="size-8 text-muted"
                    />
                    <p class="text-sm font-medium text-highlighted">
                      {{ queueLoadError ? 'Antrean cetak belum bisa dimuat' : 'Tidak ada item siap cetak' }}
                    </p>
                    <p v-if="queueLoadError" class="max-w-md text-sm text-muted">
                      {{ queueLoadErrorMessage }}
                    </p>
                  </div>
                </template>
              </UTable>

              <div v-if="!isQueueLoading && visiblePrintRows.length" class="flex justify-end border-t border-accented px-4 py-3">
                <UPagination
                  :page="warrantyCurrentPage"
                  :items-per-page="warrantyItemsPerPage"
                  :total="warrantyPaginationTotal"
                  @update:page="setWarrantyPage"
                />
              </div>
            </div>
          </section>
        </div>
      </template>
    </UDashboardPanel>

    <UModal v-model:open="confirmPrintedOpen" title="Tandai kartu sudah dicetak?" description="Item terpilih akan disimpan sebagai Printed dan dibuatkan batch cetak.">
      <template #body>
        <p class="text-sm text-muted">
          {{ selectedRowsSorted.length }} kartu akan ditandai sudah dicetak. Pastikan proses cetak fisik sudah selesai.
        </p>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Batal" color="neutral" variant="ghost" @click="confirmPrintedOpen = false" />
          <UButton label="Tandai Printed" color="success" :loading="isActionLoading" @click="markSelectedWarrantyCardsPrinted" />
        </div>
      </template>
    </UModal>

    <PrintKartuGaransi
      ref="warrantyPrintRef"
      :rows="warrantyPrintRows"
      :active-layouts="activePrintLayouts"
      :on-after-print="endPrinting"
    />
  </div>
</template>
