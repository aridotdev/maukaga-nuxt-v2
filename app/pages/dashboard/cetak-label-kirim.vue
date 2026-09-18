<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type {
  ShippingBatchResult,
  ShippingLabel,
  ShippingLabelQueueResponse,
  ShippingLabelQueueRow,
} from '~/types/print'
import {
  buildShippingLabels,
  getShippingLabelGroupKey,
  getShippingLabelRowKey,
  matchesShippingLabelSearch,
} from '~/utils/print'

definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

const UBadge = resolveComponent('UBadge')
const UCheckbox = resolveComponent('UCheckbox')

const toast = useToast()
const { isAdmin, isQrcc, isManagement } = useUserProfile()

const canMutate = computed(() => isAdmin.value || isQrcc.value)
const search = ref('')
const currentPage = ref(1)
const pageSize = ref(15)
const selectedKeys = ref<Record<string, boolean>>({})
const isPrinting = ref(false)
const isSavingShipped = ref(false)
const confirmShippedOpen = ref(false)
const printLabels = ref<ShippingLabel[]>([])
const printRef = ref<{ print: () => Promise<void> } | null>(null)

const {
  data: queueData,
  status: queueStatus,
  error: queueError,
  refresh: refreshQueue,
} = await useFetch<ShippingLabelQueueResponse>('/api/shipping-label-queue', {
  default: () => ({
    rows: [],
    summary: {
      total: 0,
      groups: 0,
    },
  }),
})

const queueRows = computed(() => queueData.value?.rows ?? [])
const isQueueLoading = computed(() => queueStatus.value === 'pending')
const visibleRows = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return queueRows.value
    .filter(row => matchesShippingLabelSearch(row, keyword))
    .toSorted(sortQueueRows)
})
const tableRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return visibleRows.value.slice(start, start + pageSize.value)
})
const selectedRows = computed(() => visibleRows.value
  .filter(row => selectedKeys.value[row.key])
  .toSorted(sortQueueRows))
const selectedLabels = computed(() => buildShippingLabels(selectedRows.value))
const selectedItemCount = computed(() => selectedRows.value.length)
const selectedGroupCount = computed(() => selectedLabels.value.length)
const selectedVisibleCount = computed(() => visibleRows.value
  .filter(row => selectedKeys.value[row.key]).length)
const allVisibleSelected = computed(() =>
  canMutate.value
  && visibleRows.value.length > 0
  && selectedVisibleCount.value === visibleRows.value.length)
const someVisibleSelected = computed(() =>
  canMutate.value
  && selectedVisibleCount.value > 0
  && selectedVisibleCount.value < visibleRows.value.length)
const headerCheckboxValue = computed(() =>
  someVisibleSelected.value ? 'indeterminate' : allVisibleSelected.value)

const summaryCards = computed(() => [{
  label: 'Item Siap Dikirim',
  value: visibleRows.value.length,
  description: 'Lolos keputusan dan sudah dicetak',
  icon: 'i-lucide-package-check',
}, {
  label: 'Grup Label',
  value: countGroups(visibleRows.value),
  description: 'Nama + bagian/cabang',
  icon: 'i-lucide-tags',
}, {
  label: 'Item Dipilih',
  value: selectedItemCount.value,
  description: `${selectedGroupCount.value} label akan diproses`,
  icon: 'i-lucide-list-checks',
}])

const columns = computed<TableColumn<ShippingLabelQueueRow>[]>(() => {
  const baseColumns: TableColumn<ShippingLabelQueueRow>[] = [{
    id: 'select',
    header: () => h(UCheckbox, {
      modelValue: headerCheckboxValue.value,
      'aria-label': 'Pilih semua item tampil',
      disabled: !canMutate.value,
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => toggleVisibleRows(!!value),
    }),
    cell: ({ row }) => h(UCheckbox, {
      modelValue: Boolean(selectedKeys.value[row.original.key]),
      'aria-label': `Pilih ${row.original.idPengajuan} item ${row.original.noItem}`,
      disabled: !canMutate.value,
      'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
        toggleRow(row.original.key, !!value),
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
    accessorKey: 'noItem',
    header: 'Item',
  }, {
    accessorKey: 'pemohon',
    header: 'Pemohon',
  }, {
    id: 'cabang',
    header: 'Cabang',
  }, {
    accessorKey: 'model',
    header: 'Model',
  }, {
    accessorKey: 'nomorSeri',
    header: 'Nomor Seri',
  }, {
    accessorKey: 'statusKirim',
    header: 'Status Kirim',
  }]

  return canMutate.value ? baseColumns : baseColumns.filter(column => column.id !== 'select')
})

watch(search, () => {
  currentPage.value = 1
})

watch(visibleRows, (rows) => {
  const visibleKeys = new Set(rows.map(row => row.key))
  selectedKeys.value = Object.fromEntries(
    Object.entries(selectedKeys.value)
      .filter(([key, selected]) => selected && visibleKeys.has(key)),
  )
})

function sortQueueRows(a: ShippingLabelQueueRow, b: ShippingLabelQueueRow) {
  return a.bagianCabang.localeCompare(b.bagianCabang, 'id-ID')
    || a.nama.localeCompare(b.nama, 'id-ID')
    || a.idPengajuan.localeCompare(b.idPengajuan)
    || a.noItem - b.noItem
}

function countGroups(rows: ShippingLabelQueueRow[]) {
  return new Set(rows.map(getShippingLabelGroupKey)).size
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

async function printSelectedLabels() {
  if (isPrinting.value) return

  const rows = selectedRows.value
  if (!rows.length) {
    showActionToast('Pilih item yang ingin dicetak labelnya')
    return
  }

  const labels = buildShippingLabels(rows)
  if (!labels.length) {
    showActionToast('Tidak ada label untuk dicetak')
    return
  }

  isPrinting.value = true
  printLabels.value = labels

  try {
    await printRef.value?.print()
  } finally {
    isPrinting.value = false
  }
}

function openConfirmShipped() {
  if (!selectedRows.value.length) {
    showActionToast('Pilih item yang sudah dikirim')
    return
  }

  confirmShippedOpen.value = true
}

async function markSelectedShipped() {
  const rows = selectedRows.value
  if (!rows.length || isSavingShipped.value) return

  isSavingShipped.value = true

  try {
    const result = await $fetch<ShippingBatchResult>('/api/shipping-label-queue/ship', {
      method: 'POST',
      body: {
        items: rows.map(row => ({
          idPengajuan: row.idPengajuan,
          noItem: row.noItem,
        })),
      },
    })

    confirmShippedOpen.value = false
    selectedKeys.value = {}
    await refreshQueue()
    toast.add({
      title: `Batch ${result.batchId} tersimpan`,
      description: `${result.count} item berhasil ditandai Dikirim.`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
  } catch (error) {
    showErrorToast('Status pengiriman gagal disimpan', error)
  } finally {
    isSavingShipped.value = false
  }
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

</script>

<template>
  <UDashboardPanel id="cetak-label-kirim">
    <template #header>
      <UDashboardNavbar title="Cetak Label Pengiriman">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            aria-label="Muat ulang antrean"
            :loading="isQueueLoading"
            @click="refreshQueue()"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UContainer>
        <div class="space-y-4">
          <div>
            <h1 class="text-lg font-semibold text-highlighted">
              Antrean label pengiriman
            </h1>
            <p class="mt-1 text-sm text-muted">
              Item yang sudah dicetak dan siap dikirim secara manual.
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
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
                  placeholder="Cari ID, item, nama, cabang, model, serial"
                />

                <div class="flex items-center gap-2 text-xs text-muted">
                  <span>{{ visibleRows.length }} item</span>
                  <span aria-hidden="true">•</span>
                  <span>{{ countGroups(visibleRows) }} label</span>
                </div>
              </div>

              <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p class="text-xs text-muted">
                  {{ selectedItemCount }} item dipilih dari {{ visibleRows.length }} item tampil.
                </p>

                <div
                  v-if="canMutate"
                  class="flex flex-wrap gap-2"
                >
                  <UButton
                    icon="i-lucide-printer"
                    size="sm"
                    :disabled="!selectedItemCount || isPrinting"
                    :loading="isPrinting"
                    @click="printSelectedLabels"
                  >
                    Cetak Label
                  </UButton>
                  <UButton
                    icon="i-lucide-send"
                    color="success"
                    variant="soft"
                    size="sm"
                    :disabled="!selectedItemCount || isSavingShipped"
                    :loading="isSavingShipped"
                    @click="openConfirmShipped"
                  >
                    Tandai Dikirim
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
              :get-row-id="getShippingLabelRowKey"
              class="w-full"
              :ui="{
                root: 'w-full',
                base: 'w-full min-w-200 table-auto border-separate border-spacing-0',
                th: 'border-b border-muted px-4 py-3 text-xs font-semibold uppercase text-muted',
                td: 'border-b border-muted px-4 py-3 align-top',
                tr: 'transition-colors hover:bg-elevated/40'
              }"
            >
              <template #idPengajuan-cell="{ row }">
                <p class="font-mono text-sm font-semibold text-highlighted">
                  {{ row.original.idPengajuan }}
                </p>
              </template>

              <template #noItem-cell="{ row }">
                <p class="text-sm text-highlighted">
                  Item #{{ row.original.noItem }}
                </p>
              </template>

              <template #pemohon-cell="{ row }">
                <p class="text-sm font-medium text-highlighted">
                  {{ row.original.nama }}
                </p>
              </template>

              <template #cabang-cell="{ row }">
                <p class="text-sm text-highlighted">
                  {{ row.original.bagianCabang }}
                </p>
              </template>

              <template #model-cell="{ row }">
                <p class="text-sm text-highlighted">
                  {{ row.original.model }}
                </p>
              </template>

              <template #nomorSeri-cell="{ row }">
                <p class="font-mono text-sm text-highlighted">
                  {{ row.original.nomorSeri }}
                </p>
              </template>

              <template #statusKirim-cell="{ row }">
                <UBadge
                  color="warning"
                  variant="subtle"
                  :label="row.original.statusKirim"
                />
              </template>

              <template #empty>
                <div class="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <UIcon
                    :name="queueError ? 'i-lucide-circle-alert' : 'i-lucide-inbox'"
                    class="size-8 text-muted"
                  />
                  <p class="text-sm font-medium text-highlighted">
                    {{ queueError ? 'Antrean label gagal dimuat' : 'Tidak ada label yang perlu dikirim' }}
                  </p>
                  <p class="max-w-md text-sm text-muted">
                    {{ queueError ? getApiErrorMessage(queueError) : 'Item akan muncul setelah kartu garansinya ditandai Dicetak.' }}
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
          v-model:open="confirmShippedOpen"
          title="Tandai item sudah dikirim?"
          :description="`${selectedItemCount} item dalam ${selectedGroupCount} label akan disimpan ke batch pengiriman.`"
          :ui="{ footer: 'justify-end' }"
        >
          <template #body>
            <p class="text-sm text-muted">
              Pastikan paket sudah diserahkan secara manual sebelum menyimpan status Dikirim.
            </p>
          </template>

          <template #footer="{ close }">
            <UButton
              label="Batal"
              color="neutral"
              variant="outline"
              :disabled="isSavingShipped"
              @click="close"
            />
            <UButton
              label="Tandai Dikirim"
              icon="i-lucide-send"
              color="success"
              :loading="isSavingShipped"
              @click="markSelectedShipped"
            />
          </template>
        </UModal>

        <PrintLabelPengiriman
          ref="printRef"
          :labels="printLabels"
        />
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
