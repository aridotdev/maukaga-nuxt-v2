<script setup lang="ts">
import { h } from 'vue'
import { getPaginationRowModel, type Table } from '@tanstack/table-core'
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'

definePageMeta({
  middleware: ['auth-guard', 'role-guard']
})

type ModelProdukRow = {
  model: string
  produk: string
  origin: OriginKey
  status: string
  updatedAt: string
}

type ModelProdukResponse = {
  rows?: Array<{
    model?: string
    produk?: string
    origin?: string
    status?: string
    updatedAt?: string
  }>
}

const ORIGIN_UNSET_VALUE = '__origin_unset__'

type OriginKey = 'local' | 'import' | ''
type OriginSelectValue = Exclude<OriginKey, ''> | typeof ORIGIN_UNSET_VALUE

type ModelProdukFormState = {
  model: string
  produk: string
  origin: OriginKey
}

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const toast = useToast()
const router = useRouter()
const { callApi } = useAppsScriptApi()
const { invalidate } = useAppSheetInvalidate()

const modelProdukSchema = z.object({
  model: z
    .string()
    .trim()
    .min(1, 'Model wajib diisi')
    .max(120, 'Model terlalu panjang'),
  produk: z
    .string()
    .trim()
    .min(1, 'Nama Produk wajib diisi')
    .max(120, 'Nama Produk terlalu panjang'),
  origin: z
    .string()
    .refine((value) => ['', 'local', 'import'].includes(value), 'Origin tidak valid')
})

type ModelProdukSchema = z.output<typeof modelProdukSchema>

const adminName = ref('Admin')
const search = ref('')
const isLoading = ref(false)
const isSaving = ref(false)
const loadError = ref('')
const rows = ref<ModelProdukRow[]>([])

const formOpen = ref(false)
const editingKey = ref<string | null>(null)
const formState = reactive<ModelProdukFormState>({
  model: '',
  produk: '',
  origin: ''
})
const formError = ref('')

const originOptions: Array<{ label: string, value: OriginSelectValue }> = [{
  label: 'Belum Ditentukan',
  value: ORIGIN_UNSET_VALUE
}, {
  label: 'Local',
  value: 'local'
}, {
  label: 'Import',
  value: 'import'
}]

const originSelectValue = computed<OriginSelectValue>({
  get: () => formState.origin || ORIGIN_UNSET_VALUE,
  set: (value) => {
    formState.origin = value === ORIGIN_UNSET_VALUE ? '' : value
  }
})

const pagination = ref({
  pageIndex: 0,
  pageSize: 15
})

type ProductNameTableRef = {
  tableApi?: Table<ModelProdukRow>
}

const productTable = useTemplateRef<ProductNameTableRef>('productTable')

const tableRows = computed(() => isLoading.value ? [] : filteredRows.value)

const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return rows.value

  return rows.value.filter((row) => {
    return [
      row.model,
      row.produk,
      getOriginLabel(row.origin),
      row.status
    ].some((value) => String(value || '').toLowerCase().includes(keyword))
  })
})

const paginationTotal = computed<number>(() =>
  productTable.value?.tableApi?.getFilteredRowModel().rows.length || filteredRows.value.length
)
const currentPage = computed<number>(() =>
  (productTable.value?.tableApi?.getState().pagination.pageIndex ?? pagination.value.pageIndex) + 1
)
const itemsPerPage = computed<number>(() =>
  productTable.value?.tableApi?.getState().pagination.pageSize || pagination.value.pageSize
)

const globalFilterOptions = {
  globalFilterFn: (row: { original: ModelProdukRow }, _columnId: string, filterValue: unknown) => {
    const keyword = String(filterValue || '').trim().toLowerCase()
    if (!keyword) return true

    return [
      row.original.model,
      row.original.produk,
      getOriginLabel(row.original.origin),
      row.original.status
    ].some((value) => String(value || '').toLowerCase().includes(keyword))
  }
}

const columns: TableColumn<ModelProdukRow>[] = [{
  accessorKey: 'model',
  header: 'Model',
  meta: {
    class: {
      th: 'w-[20%]',
      td: 'w-[20%]'
    }
  },
  cell: ({ row }) => h('p', { class: 'truncate font-semibold text-highlighted' }, row.original.model || '-')
}, {
  accessorKey: 'produk',
  header: 'Nama Produk',
  meta: {
    class: {
      th: 'w-[25%]',
      td: 'w-[25%]'
    }
  },
  cell: ({ row }) => h('p', { class: 'truncate text-sm' }, row.original.produk || '-')
}, {
  accessorKey: 'origin',
  header: 'Origin',
  meta: {
    class: {
      th: 'w-[15%]',
      td: 'w-[15%]'
    }
  },
  cell: ({ row }) => h(UBadge, {
    color: getOriginColor(row.original.origin),
    variant: 'subtle',
    label: getOriginLabel(row.original.origin),
    class: 'font-semibold'
  })
}, {
  accessorKey: 'status',
  header: 'Status',
  meta: {
    class: {
      th: 'w-[15%]',
      td: 'w-[15%]'
    }
  },
  cell: ({ row }) => h(UBadge, {
    color: row.original.status === 'verified' ? 'success' : 'neutral',
    variant: 'subtle',
    label: row.original.status === 'verified' ? 'Verified' : row.original.status || 'Unknown',
    class: 'font-semibold'
  })
}, {
  accessorKey: 'updatedAt',
  header: 'Diperbarui',
  meta: {
    class: {
      th: 'w-[20%]',
      td: 'w-[10%]'
    }
  },
  cell: ({ row }) => h('span', { class: 'text-muted' }, formatDate(row.original.updatedAt))
}, {
  id: 'actions',
  header: () => h('div', { class: 'text-right' }, 'Aksi'),
  meta: {
    class: {
      th: 'w-[10%]',
      td: 'w-[10%]'
    }
  },
  cell: ({ row }) => h('div', { class: 'flex justify-end gap-2' }, [
    h(UButton, {
      label: 'Edit',
      icon: 'i-lucide-pencil',
      color: 'neutral',
      variant: 'soft',
      size: 'sm',
      onClick: () => openEdit(row.original)
    })
  ])
}]

onMounted(() => {
  adminName.value = sessionStorage.getItem('admin_nama') || 'Admin'
  if (!sessionStorage.getItem('admin_token')) {
    router.replace('/login')
    return
  }

  loadProducts()
})

watch([search], () => {
  productTable.value?.tableApi?.setPageIndex(0)
})

async function loadProducts() {
  isLoading.value = true
  loadError.value = ''

  try {
    const result = await callApi<ModelProdukResponse>('getModelProduk')
    if (!result.success || !result.data) throw new Error(result.error || 'Gagal memuat Model Produk')

    rows.value = (result.data.rows || [])
      .map(normalizeRow)
      .filter((row) => row.model && row.produk)
      .toSorted((a, b) => String(a.model).localeCompare(String(b.model)))
  } catch (error) {
    loadError.value = getErrorMessage(error)
    rows.value = []
    notify(loadError.value || 'Model Produk belum bisa dimuat', 'error')
    await redirectIfUnauthorized(loadError.value)
  } finally {
    isLoading.value = false
  }
}

function openCreate() {
  editingKey.value = null
  formState.model = ''
  formState.produk = ''
  formState.origin = ''
  formError.value = ''
  formOpen.value = true
}

function openEdit(row: ModelProdukRow) {
  editingKey.value = row.model
  formState.model = row.model
  formState.produk = row.produk
  formState.origin = row.origin
  formError.value = ''
  formOpen.value = true
}

async function submitForm(event: FormSubmitEvent<ModelProdukSchema>) {
  formError.value = ''

  const model = normalizeModelKey(event.data.model)
  const produk = String(event.data.produk || '').trim()
  const origin = normalizeOriginKey(event.data.origin)

  if (!model || !produk) {
    formError.value = 'Model dan Nama Produk wajib diisi'
    return
  }

  if (!editingKey.value) {
    const exists = rows.value.some((row) => normalizeModelKey(row.model) === model)
    if (exists) {
      formError.value = `Model "${model}" sudah ada. Gunakan aksi Edit.`
      return
    }
  }

  isSaving.value = true

  try {
    const result = await callApi<{ count: number }>('approveModelProduk', {
      model,
      produk,
      origin
    })
    if (!result.success) throw new Error(result.error || 'Gagal menyimpan Model Produk')

    invalidate('getProductReviewQueue')
    invalidate('getModelProduk')
    invalidate('getDashboard')

    notify(
      editingKey.value ? 'Model Produk diperbarui' : 'Model Produk ditambahkan',
      'success',
      `${model} -> ${produk}`
    )

    formOpen.value = false
    editingKey.value = null
    await loadProducts()
  } catch (error) {
    const message = getErrorMessage(error)
    formError.value = message
    notify('Gagal menyimpan Model Produk', 'error', message)
    await redirectIfUnauthorized(message)
  } finally {
    isSaving.value = false
  }
}

function setPage(page: number) {
  productTable.value?.tableApi?.setPageIndex(page - 1)
}

function normalizeRow(row: NonNullable<ModelProdukResponse['rows']>[number]): ModelProdukRow {
  return {
    model: normalizeModelKey(String(row.model || '')),
    produk: String(row.produk || '').trim(),
    origin: normalizeOriginKey(row.origin),
    status: String(row.status || 'verified').trim() || 'verified',
    updatedAt: row.updatedAt || ''
  }
}

function normalizeOriginKey(value: unknown): OriginKey {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'local' || normalized === 'lokal') return 'local'
  if (normalized === 'import' || normalized === 'impor') return 'import'
  return ''
}

function getOriginLabel(origin: OriginKey) {
  if (origin === 'local') return 'Local'
  if (origin === 'import') return 'Import'
  return 'Belum Ditentukan'
}

function getOriginColor(origin: OriginKey) {
  if (origin === 'local') return 'info'
  if (origin === 'import') return 'warning'
  return 'neutral'
}

function normalizeModelKey(value: string) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase()
}

function formatDate(value: string) {
  if (!value) return '-'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(parsed)
}

function notify(title: string, color: 'success' | 'error' | 'info', description?: string) {
  toast.add({
    title,
    description,
    color,
    icon: color === 'success' ? 'i-lucide-circle-check' : color === 'error' ? 'i-lucide-circle-alert' : 'i-lucide-info'
  })
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '')
}

async function redirectIfUnauthorized(message: string) {
  if (!message || !message.includes('Unauthorized')) return

  sessionStorage.removeItem('admin_token')
  sessionStorage.removeItem('admin_nama')
  sessionStorage.removeItem('admin_username')
  await router.push('/login')
}
</script>

<template>
  <div class="contents">
    <UDashboardPanel id="product-name">      
      <template #body>
        <div class="flex items-center justify-end gap-2">
          <UButton
            label="Tambah Model"
            icon="i-lucide-plus"
            :loading="isSaving"
            @click="openCreate"
          />
        </div>
        <section class="relative rounded-lg border border-muted bg-default/45 shadow-sm backdrop-blur-xl">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-accented px-4 py-3.5">
            <UInput
              v-model="search"
              class="w-full max-w-sm"
              icon="i-lucide-search"
              placeholder="Cari model, nama produk, atau origin..."
            />

            <div class="flex flex-wrap items-center gap-2">
              <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="soft"
                :loading="isLoading"
                @click="loadProducts"
              />
            </div>
          </div>

          <UAlert
            v-if="loadError && !isLoading"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="loadError"
            class="m-4"
          />

          <div class="min-h-0 w-full overflow-x-auto">
            <UTable
              ref="productTable"
              v-model:pagination="pagination"
              v-model:global-filter="search"
              :data="tableRows"
              :columns="columns"
              :global-filter-options="globalFilterOptions"
              :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
              :loading="isLoading"
              loading-color="primary"
              loading-animation="carousel"
              class="w-full"
              :ui="{
                root: 'w-full',
                base: 'w-full min-w-170 table-fixed border-separate border-spacing-0',
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
                    :name="loadError ? 'i-lucide-circle-alert' : 'i-lucide-package'"
                    class="size-8 text-muted"
                  />
                  <p class="text-sm font-medium text-highlighted">
                    {{ loadError ? 'Model Produk belum bisa dimuat' : 'Belum ada Model Produk' }}
                  </p>
                  <p v-if="!loadError" class="text-sm text-muted">
                    Tambahkan model untuk memetakan nama produk otomatis.
                  </p>
                </div>
              </template>
            </UTable>
          </div>

          <div
            v-if="!isLoading && filteredRows.length"
            class="flex flex-wrap items-center justify-between gap-3 border-t border-accented px-4 py-3"
          >
            <p class="text-sm text-muted">
              {{ filteredRows.length }} model terdaftar
            </p>
            <UPagination
              :page="currentPage"
              :items-per-page="itemsPerPage"
              :total="paginationTotal"
              @update:page="setPage"
            />
          </div>
        </section>
      </template>
    </UDashboardPanel>

    <UModal
      v-if="formOpen"
      v-model:open="formOpen"
      :title="editingKey ? 'Edit Model Produk' : 'Tambah Model Produk'"
      :description="editingKey ? 'Perbarui model dan nama produk' : 'Petakan model ke nama produk'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          id="product-name-form"
          :schema="modelProdukSchema"
          :state="formState"
          class="space-y-4"
          @submit="submitForm"
        >
          <UFormField
            label="Model"
            name="model"
            required
          >
            <UInput
              v-model="formState.model"
              :disabled="Boolean(editingKey) || isSaving"
              autocomplete="off"
              class="w-full"
              placeholder="Model"
            />
          </UFormField>

          <UFormField
            label="Nama Produk"
            name="produk"
            required
          >
            <UInput
              v-model="formState.produk"
              :disabled="isSaving"
              autocomplete="off"
              class="w-full"
              placeholder="Nama Produk"
            />
          </UFormField>

          <UFormField
            label="Origin"
            name="origin"
          >
            <USelect
              v-model="originSelectValue"
              :items="originOptions"
              :disabled="isSaving"
              class="w-full"
            />
          </UFormField>

          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="formError"
          />
        </UForm>
      </template>

      <template #footer="{ close }">
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="close()"
        />
        <UButton
          type="submit"
          form="product-name-form"
          :label="editingKey ? 'Simpan Perubahan' : 'Tambah Model'"
          icon="i-lucide-save"
          :loading="isSaving"
        />
      </template>
    </UModal>
  </div>
</template>
