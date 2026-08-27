<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel, type Table } from '@tanstack/table-core'
import type {
  ShippingLabel,
  WarrantyPrintQueueResponse,
  WarrantyPrintQueueRow
} from '~/types/print'
import {
  buildShippingLabels,
  chunkShippingLabels,
  getPrintGroupKey,
  getPrintRowKey,
  getAlertColor,
  getAlertIcon,
  matchesPrintRowSearch
} from '~/utils/print'
import { useWarrantyPrintQueue } from '~/composables/useWarrantyPrintQueue'

definePageMeta({
  middleware: ['auth-guard', 'role-guard']
})

type LabelTableRef = {
  tableApi?: Table<WarrantyPrintQueueRow>
}

const UBadge = resolveComponent('UBadge')
const UCheckbox = resolveComponent('UCheckbox')

const router = useRouter()
const selectedPrintKeys = ref<Set<string>>(new Set())
const {
  printQueue,
  isQueueLoading,
  queueLoadError,
  pageAlert,
  setPageAlert,
  setQueue,
  toggleVisiblePrintRows,
  withApiError,
  notify,
  callApi
} = useWarrantyPrintQueue({
  selectedKeys: selectedPrintKeys,
  fetchQueue: () => Promise.resolve({ success: true, data: { rows: [], summary: { total: 0, local: 0, import: 0, belumJenisKartu: 0, printed: 0 } } })
})

const adminName = ref('Admin')
const search = ref('')
const isActionLoading = ref(false)
const confirmShipOpen = ref(false)
const labelPrintRows = ref<ShippingLabel[]>([])
const labelPrintRef = ref<{ print: () => Promise<void> } | null>(null)
const isPrinting = ref(false)
const labelTable = useTemplateRef<LabelTableRef>('labelTable')
const labelPagination = ref({
  pageIndex: 0,
  pageSize: 15
})

const printTableGlobalFilterOptions = {
  globalFilterFn: (row: { original: WarrantyPrintQueueRow }, _columnId: string, filterValue: unknown) =>
    matchesPrintRowSearch(row.original, String(filterValue || '').trim().toLowerCase())
}

const visiblePrintRows = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return printQueue.value
    .filter((row) => {
      if (!keyword) return true
      return matchesPrintRowSearch(row, keyword)
    })
    .toSorted((a, b) =>
      String(a.bagianCabang || '').localeCompare(String(b.bagianCabang || ''), 'id-ID')
      || String(a.nama || '').localeCompare(String(b.nama || ''), 'id-ID')
      || String(a.idPengajuan).localeCompare(String(b.idPengajuan))
      || Number(a.noItem) - Number(b.noItem)
      || String(a.nomorSeri || '').localeCompare(String(b.nomorSeri || ''))
    )
})

const visibleSummary = computed(() => {
  const groups = new Set<string>()
  let belumDikirim = 0
  let dikirim = 0

  visiblePrintRows.value.forEach((row) => {
    groups.add(getPrintGroupKey(row))
    if (row.statusKirim === 'Belum Dikirim') belumDikirim += 1
    else if (row.statusKirim === 'Dikirim') dikirim += 1
  })

  return {
    totalItems: visiblePrintRows.value.length,
    totalGroups: groups.size,
    belumDikirim,
    dikirim
  }
})
const labelTableRows = computed(() => isQueueLoading.value ? [] : visiblePrintRows.value)

// Selection: hanya row yang dicentang user yang ikut diproses.
// Tidak ada ekspansi group — biar sederhana & sesuai checklist user.
const visibleKeys = computed(() => visiblePrintRows.value.map((row) => getPrintRowKey(row)))
const selectedVisibleCount = computed(() => visibleKeys.value.filter((key) => selectedPrintKeys.value.has(key)).length)
const allVisibleSelected = computed(() => visibleKeys.value.length > 0 && selectedVisibleCount.value === visibleKeys.value.length)
const someVisibleSelected = computed(() => selectedVisibleCount.value > 0 && selectedVisibleCount.value < visibleKeys.value.length)
const checkboxAllState = computed(() => someVisibleSelected.value ? 'indeterminate' : allVisibleSelected.value)
const labelPaginationTotal = computed<number>(() => labelTable.value?.tableApi?.getFilteredRowModel().rows.length || 0)
const labelCurrentPage = computed<number>(() =>
  (labelTable.value?.tableApi?.getState().pagination.pageIndex ?? labelPagination.value.pageIndex) + 1
)
const labelItemsPerPage = computed<number>(() =>
  labelTable.value?.tableApi?.getState().pagination.pageSize || labelPagination.value.pageSize
)

const selectedRows = computed(() => {
  return Array.from(selectedPrintKeys.value)
    .map((key) => printQueue.value.find((row) => getPrintRowKey(row) === key))
    .filter(Boolean) as WarrantyPrintQueueRow[]
})

const itemsForBulkAction = computed(() => selectedRows.value)

const selectedGroupCount = computed(() => {
  const groups = new Set<string>()
  selectedRows.value.forEach((row) => groups.add(getPrintGroupKey(row)))
  return groups.size
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
    h('p', { class: 'font-mono text-sm font-bold text-highlighted' }, row.original.idPengajuan)
  ]),
  meta: {
    class: {
      th: 'w-36',
      td: 'w-36'
    }
  }
}, {
  accessorKey: 'noItem',
  header: 'Item',
  cell: ({ row }) => h('p', { class: 'mt-1 text-xs text-muted' }, `Item #${row.original.noItem}`),
  meta: {
    class: {
      th: 'w-24',
      td: 'w-24'
    }
  }
}, {
  accessorKey: 'bagianCabang',
  header: 'Cabang',
  cell: ({ row }) => h('p', { class: 'text-sm' }, row.original.bagianCabang || '-'),
  meta: {
    class: {
      th: 'w-32',
      td: 'w-32'
    }
  }
}, {
  accessorKey: 'produk',
  header: 'Produk',
  cell: ({ row }) => h('p', { class: 'text-sm' }, row.original.produk || '-')
}, {
  accessorKey: 'nomorSeri',
  header: 'Nomor Seri',
  cell: ({ row }) => h('p', { class: 'text-sm' }, row.original.nomorSeri || '-')
}, {
  accessorKey: 'model',
  header: 'Model',
  cell: ({ row }) => h('p', { class: 'text-sm' }, row.original.model || '-')
}, {
  accessorKey: 'nama',
  header: 'Nama',
  cell: ({ row }) => h('p', { class: 'text-sm' }, row.original.nama || '-')
}, {
  accessorKey: 'statusKirim',
  header: 'Status Kirim',
  cell: ({ row }) => h(UBadge, {
    color: row.original.statusKirim === 'Dikirim' ? 'success' : 'warning',
    variant: 'subtle',
    label: row.original.statusKirim === 'Dikirim' ? 'Dikirim' : 'Belum Dikirim',
    class: 'w-fit text-xs text-muted'
  })
}]

onMounted(async () => {
  adminName.value = sessionStorage.getItem('admin_nama') || 'Admin'
  if (!sessionStorage.getItem('admin_token')) {
    await router.replace('/login')
    return
  }

  window.addEventListener('afterprint', onAfterPrint)
  await loadPrintQueue(false)
})

onBeforeUnmount(() => {
  window.removeEventListener('afterprint', onAfterPrint)
})

watch(search, () => {
  labelTable.value?.tableApi?.setPageIndex(0)
})

async function loadPrintQueue(showLoading = true) {
  isQueueLoading.value = true
  queueLoadError.value = ''

  if (showLoading) {
    setPageAlert({
      type: 'loading',
      title: 'Memuat data label',
      description: 'Mengambil kandidat label dengan status Belum Dikirim.'
    })
  }

  try {
    // Sumber utama: sheet ShippingLabels (sudah terisi otomatis saat kartu ditandai Printed).
    const labelResult = await callApi<WarrantyPrintQueueResponse>('getShippingLabelQueue', {
      statusKirim: 'Belum Dikirim'
    })
    if (!labelResult.success || !labelResult.data) throw new Error(labelResult.error || 'Gagal memuat data label')

    const unsentKey = new Set<string>()
    const shippingRows = (labelResult.data.rows || []).map((row) => {
      const key = getPrintRowKey(row)
      unsentKey.add(key)
      return { ...row, key }
    })

    // Sumber fallback: kartu Printed dengan statusKirim='Belum Dikirim' (filter di server)
    // yang belum masuk ShippingLabels (mis. data lama sebelum insert otomatis diterapkan).
    let fallbackRows: WarrantyPrintQueueRow[] = []
    try {
      const printedResult = await callApi<WarrantyPrintQueueResponse>('getWarrantyPrintQueue', {
        includePrinted: true,
        onlyUnsent: true
      })
      if (printedResult.success && printedResult.data?.rows) {
        fallbackRows = printedResult.data.rows
          .filter((row) => !unsentKey.has(getPrintRowKey(row)))
          .map((row) => ({ ...row, key: getPrintRowKey(row) }))
      }
    } catch (fallbackError) {
      // Fallback gagal bukan hal kritis — sumber utama tetap dipakai.
      console.warn('Fallback getWarrantyPrintQueue gagal:', fallbackError)
    }

    setQueue([...shippingRows, ...fallbackRows])

    if (showLoading && pageAlert.value?.type === 'loading') {
      setPageAlert(null)
    }

    if (!printQueue.value.length && showLoading) {
      setPageAlert({
        type: 'info',
        title: 'Belum ada label yang perlu dikirim',
        description: 'Belum ada kartu Printed yang siap dikirim.'
      })
    } else if (printQueue.value.length && pageAlert.value?.type === 'info') {
      setPageAlert(null)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Label pengiriman belum bisa dimuat')
    queueLoadError.value = message
    setPageAlert({ type: 'error', title: 'Label pengiriman belum bisa dimuat', description: message })
  } finally {
    isQueueLoading.value = false
  }
}

function handlePrintRowCheck(key: string, checked: boolean) {
  const next = new Set(selectedPrintKeys.value)
  if (checked) next.add(key)
  else next.delete(key)
  selectedPrintKeys.value = next
}

function setLabelPage(page: number) {
  labelTable.value?.tableApi?.setPageIndex(page - 1)
}

function openConfirmShip() {
  if (!itemsForBulkAction.value.length) {
    showInlineError('Pilih item yang akan ditandai Dikirim')
    return
  }
  confirmShipOpen.value = true
}

async function markSelectedShippingLabelsShipped() {
  const items = itemsForBulkAction.value
  if (!items.length) {
    confirmShipOpen.value = false
    return
  }

  confirmShipOpen.value = false
  isActionLoading.value = true
  setPageAlert({
    type: 'loading',
    title: 'Menyimpan status kirim',
    description: `Menandai ${items.length} item (${selectedGroupCount.value} group cabang+nama) sebagai Dikirim.`
  })

  await withApiError(async () => {
    const result = await callApi<{ batchId: string, count: number }>('markShippingLabelsShipped', {
      items: items.map((row) => ({
        idPengajuan: row.idPengajuan,
        noItem: row.noItem
      }))
    })
    if (!result.success || !result.data) throw new Error(result.error || 'Gagal menandai label terkirim')

    selectedPrintKeys.value = new Set()
    await loadPrintQueue(false)
    setPageAlert(null)
    notify(`Batch ${result.data.batchId} tersimpan`, 'success', `${result.data.count} item ditandai Dikirim.` )
  }, 'Status kirim gagal disimpan')

  isActionLoading.value = false
}

async function printSelectedShippingLabels() {
  if (isPrinting.value) return
  const items = itemsForBulkAction.value
  if (!items.length) {
    showInlineError('Pilih item yang ingin dicetak labelnya')
    return
  }

  isPrinting.value = true
  const labels = buildShippingLabels(items)
  labelPrintRows.value = labels
  setPageAlert({
    type: 'info',
    title: `${labels.length} label siap dicetak`,
    description: `Mencakup ${items.length} item (${selectedGroupCount.value} group cabang+nama). Dialog print browser akan terbuka.`
  })
  await labelPrintRef.value?.print().catch(() => { isPrinting.value = false })
}

function endPrinting() {
  isPrinting.value = false
}

function onAfterPrint() {
  endPrinting()
}

function showInlineError(message: string) {
  setPageAlert({
    type: 'error',
    title: message
  })
  notify(message, 'error')
}

// Hitung halaman label di-cache agar tidak rebuild tiap render template.
const labelPagesForVisible = computed(() => chunkShippingLabels(buildShippingLabels(visiblePrintRows.value)))
const totalPages = computed(() => labelPagesForVisible.value.length)
const totalLabelsForVisible = computed(() => labelPagesForVisible.value.flat().length)
</script>

<template>
  <div class="contents">
    <UDashboardPanel id="cetak-label-pengiriman">
      <template #header>
        <UDashboardNavbar title="Cetak Label Pengiriman" :description="`Halo, ${adminName}`">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="space-y-6">
          <PrintLabelPengirimanStats
            :summary="visibleSummary"
            :selected-count="itemsForBulkAction.length"
            :loading="isQueueLoading"
          />

          <UAlert
            v-if="pageAlert"
            :color="getAlertColor(pageAlert.type)"
            :icon="getAlertIcon(pageAlert.type)"
            :title="pageAlert.title"
            :description="pageAlert.description"
            variant="subtle"
          >
            <template v-if="pageAlert.type !== 'loading'" #actions>
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="sm"
                aria-label="Tutup pesan"
                @click="pageAlert = null"
              />
            </template>
          </UAlert>

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
                  <UButton
                    label="Refresh"
                    icon="i-lucide-refresh-cw"
                    color="neutral"
                    variant="soft"
                    :loading="isQueueLoading"
                    @click="loadPrintQueue()"
                  />
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-accented px-4 py-3">
                <p class="text-sm text-muted">
                  <template v-if="selectedPrintKeys.size">
                    {{ itemsForBulkAction.length }} item (dalam {{ selectedGroupCount }} group cabang+nama) akan diproses dari {{ visiblePrintRows.length }} item tampil.
                  </template>
                  <template v-else>
                    {{ visiblePrintRows.length }} item tampil.
                  </template>
                </p>

                <div class="flex flex-wrap items-center gap-2">
                  <UButton
                    label="Tandai Dikirim"
                    icon="i-lucide-truck"
                    color="success"
                    variant="soft"
                    size="sm"
                    :disabled="!itemsForBulkAction.length || isActionLoading"
                    @click="openConfirmShip"
                  />
                  <UButton
                    label="Cetak Label"
                    icon="i-lucide-printer"
                    color="primary"
                    size="sm"
                    :loading="isPrinting"
                    :disabled="!itemsForBulkAction.length || isPrinting"
                    @click="printSelectedShippingLabels"
                  />
                </div>
              </div>

              <UTable
                ref="labelTable"
                v-model:pagination="labelPagination"
                v-model:global-filter="search"
                :get-row-id="getPrintRowKey"
                :data="labelTableRows"
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
                      :name="queueLoadError ? 'i-lucide-circle-alert' : 'i-lucide-tags'"
                      class="size-8 text-muted"
                    />
                    <p class="text-sm font-medium text-highlighted">
                      {{ queueLoadError ? 'Label pengiriman belum bisa dimuat' : 'Belum ada label yang perlu dikirim' }}
                    </p>
                    <p v-if="queueLoadError" class="max-w-md text-sm text-muted">
                      {{ queueLoadError }}
                    </p>
                  </div>
                </template>
              </UTable>

              <div v-if="!isQueueLoading && visiblePrintRows.length" class="flex flex-wrap items-center justify-between gap-3 border-t border-accented px-4 py-3">
                <p class="text-xs text-muted">
                  {{ totalPages }} halaman label ({{ totalLabelsForVisible }} label) untuk {{ visibleSummary.totalItems }} item / {{ visibleSummary.totalGroups }} group.
                </p>
                <UPagination
                  :page="labelCurrentPage"
                  :items-per-page="labelItemsPerPage"
                  :total="labelPaginationTotal"
                  @update:page="setLabelPage"
                />
              </div>
            </div>
          </section>
        </div>
      </template>
    </UDashboardPanel>

    <PrintLabelPengiriman ref="labelPrintRef" :labels="labelPrintRows" />

    <UModal v-model:open="confirmShipOpen" title="Tandai label sudah dikirim?" description="Hanya item yang Anda centang akan disimpan sebagai Dikirim. Pastikan barang sudah benar-benar dikirim ke cabang tujuan.">
      <template #body>
        <p class="text-sm text-muted">
          {{ itemsForBulkAction.length }} item (dalam {{ selectedGroupCount }} group cabang+nama) akan ditandai Dikirim.
        </p>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Batal" color="neutral" variant="ghost" :disabled="isActionLoading" @click="confirmShipOpen = false" />
          <UButton label="Tandai Dikirim" color="success" :loading="isActionLoading" @click="markSelectedShippingLabelsShipped" />
        </div>
      </template>
    </UModal>
  </div>
</template>
