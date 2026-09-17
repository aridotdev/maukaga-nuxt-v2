<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type {
  WarrantyCardTypeFilter,
  WarrantyCardTypeKey,
  WarrantyPrintBatchResult,
  WarrantyPrintQueueResponse,
  WarrantyPrintQueueRow,
} from '~/types/print'
import {
  getWarrantyCardTypeFromKey,
  getWarrantyCardTypeLabel,
  getWarrantyPrintRowKey,
  matchesWarrantyPrintSearch,
} from '~/utils/print'

definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

const UBadge = resolveComponent('UBadge')
const UCheckbox = resolveComponent('UCheckbox')

const toast = useToast()
const { isAdmin, isQrcc, isManagement } = useUserProfile()

const canMutatePrintQueue = computed(() => isAdmin.value || isQrcc.value)
const search = ref('')
const cardTypeFilter = ref<WarrantyCardTypeFilter>('all')
const currentPage = ref(1)
const pageSize = ref(15)
const selectedKeys = ref<Record<string, boolean>>({})
const isSavingCardType = ref(false)
const isSavingPrinted = ref(false)
const isPrinting = ref(false)
const confirmPrintedOpen = ref(false)
const printRows = ref<WarrantyPrintQueueRow[]>([])
const printRef = ref<{ print: () => Promise<void> } | null>(null)

const {
  data: printQueueData,
  status: printQueueStatus,
  error: printQueueError,
  refresh: refreshPrintQueue,
} = await useFetch<WarrantyPrintQueueResponse>('/api/warranty-print-queue', {
  default: () => ({
    rows: [],
    summary: {
      total: 0,
      local: 0,
      import: 0,
      unset: 0,
    },
  }),
})

const cardTypeFilterItems = [
  { label: 'Semua jenis', value: 'all' },
  { label: 'Local', value: 'local' },
  { label: 'Import', value: 'import' },
  { label: 'Belum dipilih', value: 'unset' },
]

const queueRows = computed(() => printQueueData.value?.rows ?? [])
const isQueueLoading = computed(() => printQueueStatus.value === 'pending')
const visibleRows = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return queueRows.value
    .filter(matchesCardTypeFilter)
    .filter(row => matchesWarrantyPrintSearch(row, keyword))
    .toSorted(sortPrintRows)
})
const tableRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return visibleRows.value.slice(start, start + pageSize.value)
})
const selectedRows = computed(() => visibleRows.value.filter(row => selectedKeys.value[row.key]))
const selectedRowsSorted = computed(() => selectedRows.value.toSorted(sortPrintRows))
const selectedVisibleCount = computed(() => visibleRows.value.filter(row => selectedKeys.value[row.key]).length)
const allVisibleSelected = computed(() => visibleRows.value.length > 0 && selectedVisibleCount.value === visibleRows.value.length)
const someVisibleSelected = computed(() => selectedVisibleCount.value > 0 && selectedVisibleCount.value < visibleRows.value.length)
const headerCheckboxValue = computed(() => someVisibleSelected.value ? 'indeterminate' : allVisibleSelected.value)
const queueSummary = computed(() => createVisibleSummary(visibleRows.value))

const summaryCards = computed(() => [{
  label: 'Total Antrean',
  value: queueSummary.value.total,
  icon: 'i-lucide-files',
  description: `${selectedRows.value.length} dipilih`,
}, {
  label: 'Local',
  value: queueSummary.value.local,
  icon: 'i-lucide-map-pin',
  description: 'Siap cetak',
}, {
  label: 'Import',
  value: queueSummary.value.import,
  icon: 'i-lucide-globe-2',
  description: 'Siap cetak',
}, {
  label: 'Belum Dipilih',
  value: queueSummary.value.unset,
  icon: 'i-lucide-circle-help',
  description: 'Perlu jenis kartu',
}])

const columns = computed<TableColumn<WarrantyPrintQueueRow>[]>(() => {
  const baseColumns: TableColumn<WarrantyPrintQueueRow>[] = [{
    id: 'select',
    header: () => h(UCheckbox, {
      'modelValue': headerCheckboxValue.value,
      'aria-label': 'Pilih semua item tampil',
      'disabled': !canMutatePrintQueue.value,
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => toggleVisibleRows(!!value),
    }),
    cell: ({ row }) => h(UCheckbox, {
      'modelValue': Boolean(selectedKeys.value[row.original.key]),
      'aria-label': `Pilih ${row.original.idPengajuan} item ${row.original.noItem}`,
      'disabled': !canMutatePrintQueue.value,
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => toggleRow(row.original.key, !!value),
    }),
    meta: {
      class: {
        th: 'w-12',
        td: 'w-12',
      },
    },
  }, {
    accessorKey: 'idPengajuan',
    header: 'ID Pengajuan',
  }, {
    accessorKey: 'pemohon',
    header: 'Pemohon',
  }, {
    accessorKey: 'produk',
    header: 'Produk',
  }, {
    accessorKey: 'model',
    header: 'Model',
  }, {
    accessorKey: 'nomorSeri',
    header: 'Nomor Seri',
  }, {
    accessorKey: 'jenisKartu',
    header: 'Jenis Kartu',
  }, {
    accessorKey: 'status',
    header: 'Status',
  }]

  if (canMutatePrintQueue.value) return baseColumns
  return baseColumns.filter(column => column.id !== 'select')
})

watch([search, cardTypeFilter], () => {
  currentPage.value = 1
})

watch(visibleRows, (rows) => {
  const visibleKeys = new Set(rows.map(row => row.key))
  selectedKeys.value = Object.fromEntries(
    Object.entries(selectedKeys.value).filter(([key, selected]) => selected && visibleKeys.has(key)),
  )
})

function matchesCardTypeFilter(row: WarrantyPrintQueueRow) {
  if (cardTypeFilter.value === 'all') return true
  if (cardTypeFilter.value === 'unset') return !row.jenisKartuKey
  return row.jenisKartuKey === cardTypeFilter.value
}

function sortPrintRows(a: WarrantyPrintQueueRow, b: WarrantyPrintQueueRow) {
  const typeOrder: Record<string, number> = { local: 1, import: 2, '': 3 }

  return (typeOrder[a.jenisKartuKey] ?? 3) - (typeOrder[b.jenisKartuKey] ?? 3)
    || a.idPengajuan.localeCompare(b.idPengajuan)
    || a.noItem - b.noItem
}

function createVisibleSummary(rows: WarrantyPrintQueueRow[]) {
  return rows.reduce((summary, row) => {
    summary.total += 1
    if (row.jenisKartuKey === 'local') summary.local += 1
    else if (row.jenisKartuKey === 'import') summary.import += 1
    else summary.unset += 1
    return summary
  }, {
    total: 0,
    local: 0,
    import: 0,
    unset: 0,
  })
}

function toggleVisibleRows(checked: boolean) {
  const visibleKeys = new Set(visibleRows.value.map(row => row.key))

  selectedKeys.value = checked
    ? {
        ...selectedKeys.value,
        ...Object.fromEntries(visibleKeys.values().map(key => [key, true])),
      }
    : Object.fromEntries(
        Object.entries(selectedKeys.value).filter(([key]) => !visibleKeys.has(key)),
      )
}

function toggleRow(key: string, checked: boolean) {
  if (checked) {
    selectedKeys.value = {
      ...selectedKeys.value,
      [key]: true,
    }
    return
  }

  selectedKeys.value = Object.fromEntries(
    Object.entries(selectedKeys.value).filter(([selectedKey]) => selectedKey !== key),
  )
}

async function setSelectedCardType(type: WarrantyCardTypeKey) {
  if (!selectedRows.value.length || isSavingCardType.value) return

  const jenisKartu = getWarrantyCardTypeFromKey(type)
  isSavingCardType.value = true

  try {
    const result = await $fetch<{ count: number }>('/api/warranty-print-queue/types', {
      method: 'POST',
      body: {
        items: selectedRows.value.map(row => ({
          idPengajuan: row.idPengajuan,
          noItem: row.noItem,
          jenisKartu,
        })),
      },
    })

    await refreshPrintQueue()
    toast.add({
      title: `Jenis kartu disimpan sebagai ${jenisKartu}`,
      description: `${result.count} item antrean diperbarui.`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
  } catch (error) {
    showErrorToast('Jenis kartu gagal disimpan', error)
  } finally {
    isSavingCardType.value = false
  }
}

async function printSelectedCards() {
  if (isPrinting.value) return

  const rows = selectedRowsSorted.value
  if (!rows.length) {
    showActionToast('Pilih item yang ingin dicetak')
    return
  }

  if (!ensureRowsHaveCardType(rows)) return

  isPrinting.value = true
  printRows.value = rows

  toast.add({
    title: `${rows.length} kartu siap dicetak`,
    description: 'Dialog print browser akan terbuka. Status belum berubah sampai ditandai dicetak.',
    color: 'info',
    icon: 'i-lucide-printer',
  })

  try {
    await printRef.value?.print()
  } finally {
    isPrinting.value = false
  }
}

function openConfirmPrinted() {
  const rows = selectedRowsSorted.value
  if (!rows.length) {
    showActionToast('Pilih item yang sudah dicetak')
    return
  }

  if (!ensureRowsHaveCardType(rows)) return
  confirmPrintedOpen.value = true
}

async function markSelectedCardsPrinted() {
  const rows = selectedRowsSorted.value
  if (!rows.length || isSavingPrinted.value) return

  isSavingPrinted.value = true

  try {
    const result = await $fetch<WarrantyPrintBatchResult>('/api/warranty-print-queue/print', {
      method: 'POST',
      body: {
        items: rows.map(row => ({
          idPengajuan: row.idPengajuan,
          noItem: row.noItem,
          jenisKartu: row.jenisKartu,
        })),
      },
    })

    confirmPrintedOpen.value = false
    selectedKeys.value = {}
    await refreshPrintQueue()
    toast.add({
      title: `Batch ${result.batchId} tersimpan`,
      description: `${result.count} kartu berhasil ditandai Dicetak.`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
  } catch (error) {
    showErrorToast('Status cetak gagal disimpan', error)
  } finally {
    isSavingPrinted.value = false
  }
}

function ensureRowsHaveCardType(rows: WarrantyPrintQueueRow[]) {
  const missing = rows.filter(row => !row.jenisKartu)
  if (!missing.length) return true

  showActionToast(`${missing.length} item belum dipilih jenis kartunya`)
  return false
}

function showActionToast(message: string) {
  toast.add({
    title: message,
    color: 'error',
    icon: 'i-lucide-circle-alert',
  })
}

function showErrorToast(title: string, error: unknown) {
  toast.add({
    title,
    description: getApiErrorMessage(error),
    color: 'error',
    icon: 'i-lucide-circle-alert',
  })
}

function getApiErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data as { message?: string; statusMessage?: string }
    return data.statusMessage || data.message || 'Operasi gagal diproses.'
  }

  if (error instanceof Error) return error.message
  return 'Operasi gagal diproses.'
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
</script>

<template>
  <UDashboardPanel id="cetak-kartu">
    <template #header>
      <UDashboardNavbar title="Cetak Kartu Garansi">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UContainer>
        <div class="space-y-4">
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div
              v-for="card in summaryCards"
              :key="card.label"
              class="rounded-lg border border-muted bg-default px-4 py-3"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-medium uppercase text-muted">
                    {{ card.label }}
                  </p>
                  <p class="mt-1 text-2xl font-semibold text-highlighted">
                    {{ isQueueLoading ? '...' : card.value }}
                  </p>
                </div>
                <UIcon :name="card.icon" class="size-5 text-muted" />
              </div>
              <p class="mt-2 text-xs text-muted">
                {{ card.description }}
              </p>
            </div>
          </div>

          <section class="overflow-hidden rounded-lg border border-muted bg-default">
            <div class="flex flex-col gap-3 border-b border-muted px-4 py-4">
              <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <UInput
                  v-model="search"
                  class="w-full xl:max-w-sm"
                  icon="i-lucide-search"
                  placeholder="Cari ID, cabang, nama, produk, model, serial"
                />

                <div class="flex flex-wrap gap-2 xl:justify-end">
                  <USelect
                    v-model="cardTypeFilter"
                    :items="cardTypeFilterItems"
                    class="w-full sm:w-44"
                  />
                  <UButton
                    icon="i-lucide-refresh-cw"
                    color="neutral"
                    variant="soft"
                    :loading="isQueueLoading"
                    @click="refreshPrintQueue()"
                  >
                    Refresh
                  </UButton>
                </div>
              </div>

              <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p class="text-xs text-muted">
                  {{ selectedRows.length }} dari {{ visibleRows.length }} item antrean dipilih.
                </p>

                <div
                  v-if="canMutatePrintQueue"
                  class="flex flex-wrap gap-2"
                >
                  <UButton
                    color="neutral"
                    variant="soft"
                    size="sm"
                    :disabled="!selectedRows.length || isSavingCardType"
                    :loading="isSavingCardType"
                    @click="setSelectedCardType('local')"
                  >
                    Set Local
                  </UButton>
                  <UButton
                    color="neutral"
                    variant="soft"
                    size="sm"
                    :disabled="!selectedRows.length || isSavingCardType"
                    :loading="isSavingCardType"
                    @click="setSelectedCardType('import')"
                  >
                    Set Import
                  </UButton>
                  <UButton
                    icon="i-lucide-printer"
                    size="sm"
                    :disabled="!selectedRows.length || isPrinting"
                    :loading="isPrinting"
                    @click="printSelectedCards"
                  >
                    Cetak
                  </UButton>
                  <UButton
                    icon="i-lucide-circle-check"
                    color="success"
                    variant="soft"
                    size="sm"
                    :disabled="!selectedRows.length || isSavingPrinted"
                    :loading="isSavingPrinted"
                    @click="openConfirmPrinted"
                  >
                    Tandai Dicetak
                  </UButton>
                </div>

                <p
                  v-else-if="isManagement"
                  class="text-xs text-muted"
                >
                  Mode baca antrean.
                </p>
              </div>
            </div>

            <UTable
              :data="tableRows"
              :columns="columns"
              :loading="isQueueLoading"
              :get-row-id="getWarrantyPrintRowKey"
              class="w-full"
              :ui="{
                root: 'w-full',
                base: 'w-full min-w-250 table-auto border-separate border-spacing-0',
                th: 'border-b border-muted px-4 py-3 text-xs font-semibold uppercase text-muted',
                td: 'border-b border-muted px-4 py-3 align-top',
                tr: 'transition-colors hover:bg-elevated/40'
              }"
            >
              <template #idPengajuan-cell="{ row }">
                <div class="min-w-0">
                  <p class="font-mono text-sm font-semibold text-highlighted">
                    {{ row.original.idPengajuan }}
                  </p>
                  <p class="mt-1 text-xs text-muted">
                    Item #{{ row.original.noItem }} - {{ formatDateTime(row.original.submittedAt) }}
                  </p>
                </div>
              </template>

              <template #pemohon-cell="{ row }">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-highlighted">
                    {{ row.original.nama }}
                  </p>
                  <p class="mt-1 text-xs text-muted">
                    {{ row.original.bagianCabang }}
                  </p>
                </div>
              </template>

              <template #produk-cell="{ row }">
                <p class="text-sm text-highlighted">
                  {{ row.original.produk || '-' }}
                </p>
              </template>

              <template #model-cell="{ row }">
                <p class="text-sm text-highlighted">
                  {{ row.original.model }}
                </p>
              </template>

              <template #nomorSeri-cell="{ row }">
                <p class="font-mono text-xs text-highlighted">
                  {{ row.original.nomorSeri }}
                </p>
              </template>

              <template #jenisKartu-cell="{ row }">
                <UBadge
                  :color="row.original.jenisKartuKey === 'local' ? 'info' : row.original.jenisKartuKey === 'import' ? 'warning' : 'neutral'"
                  variant="subtle"
                  :label="getWarrantyCardTypeLabel(row.original.jenisKartu)"
                />
              </template>

              <template #status-cell="{ row }">
                <UBadge
                  color="neutral"
                  variant="soft"
                  :label="row.original.statusCetak"
                />
              </template>

              <template #empty>
                <div class="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <UIcon
                    :name="printQueueError ? 'i-lucide-circle-alert' : 'i-lucide-inbox'"
                    class="size-8 text-muted"
                  />
                  <p class="text-sm font-medium text-highlighted">
                    {{ printQueueError ? 'Antrean cetak gagal dimuat' : 'Tidak ada item siap cetak' }}
                  </p>
                  <p class="max-w-md text-sm text-muted">
                    {{ printQueueError ? getApiErrorMessage(printQueueError) : 'Item yang disetujui dan belum dicetak akan muncul di sini.' }}
                  </p>
                </div>
              </template>
            </UTable>

            <div
              v-if="visibleRows.length"
              class="flex flex-col gap-3 border-t border-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <p class="text-xs text-muted">
                Halaman {{ currentPage }} menampilkan {{ tableRows.length }} dari {{ visibleRows.length }} item.
              </p>
              <UPagination
                v-model:page="currentPage"
                :items-per-page="pageSize"
                :total="visibleRows.length"
              />
            </div>
          </section>
        </div>

        <UModal
          v-model:open="confirmPrintedOpen"
          title="Tandai kartu sudah dicetak?"
          :description="`${selectedRowsSorted.length} item akan disimpan ke batch cetak.`"
          :ui="{ footer: 'justify-end' }"
        >
          <template #body>
            <p class="text-sm text-muted">
              Pastikan proses cetak fisik sudah selesai sebelum menyimpan status Dicetak.
            </p>
          </template>

          <template #footer="{ close }">
            <UButton
              label="Batal"
              color="neutral"
              variant="outline"
              :disabled="isSavingPrinted"
              @click="close"
            />
            <UButton
              label="Tandai Dicetak"
              icon="i-lucide-circle-check"
              color="success"
              :loading="isSavingPrinted"
              @click="markSelectedCardsPrinted"
            />
          </template>
        </UModal>

        <PrintKartuGaransi
          ref="printRef"
          :rows="printRows"
        />
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
