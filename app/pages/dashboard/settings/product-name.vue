<script setup lang="ts">
import { h } from 'vue'
import { getPaginationRowModel } from '@tanstack/table-core'
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type {
  ModelProdukOrigin,
  ModelProdukResponse,
  ModelProdukRow,
  ModelProdukStatus,
} from '~/types/model-produk'

definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

type ProductNameFormState = {
  model: string
  produk: string
  origin: ModelProdukOrigin
}

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const toast = useToast()
const { isAdmin, isQrcc } = useUserProfile()

const canMutate = computed(() => isAdmin.value || isQrcc.value)
const search = ref('')
const statusFilter = ref<'all' | ModelProdukStatus>('all')
const pagination = ref({
  pageIndex: 0,
  pageSize: 15,
})
const formOpen = ref(false)
const editingId = ref<string | null>(null)
const isSaving = ref(false)
const formError = ref('')

const formState = reactive<ProductNameFormState>({
  model: '',
  produk: '',
  origin: 'local',
})

const modelProdukSchema = z.object({
  model: z
    .string()
    .trim()
    .min(1, 'Model wajib diisi')
    .max(120, 'Model terlalu panjang'),
  produk: z
    .string()
    .trim()
    .min(1, 'Nama produk wajib diisi')
    .max(120, 'Nama produk terlalu panjang'),
  origin: z.enum(['local', 'import']),
})

type ModelProdukForm = z.output<typeof modelProdukSchema>

const originOptions = [{
  label: 'Local',
  value: 'local',
}, {
  label: 'Import',
  value: 'import',
}] satisfies Array<{ label: string; value: ModelProdukOrigin }>

const statusOptions = [{
  label: 'Semua status',
  value: 'all',
}, {
  label: 'Verified',
  value: 'verified',
}, {
  label: 'Perlu review',
  value: 'needs_review',
}] satisfies Array<{ label: string; value: 'all' | ModelProdukStatus }>

const {
  data: modelProdukData,
  status: modelProdukStatus,
  error: modelProdukError,
  refresh: refreshModelProduk,
} = await useFetch<ModelProdukResponse>('/api/model-produk', {
  default: () => ({
    rows: [],
    summary: {
      total: 0,
      verified: 0,
      needsReview: 0,
    },
  }),
})

const rows = computed(() => modelProdukData.value?.rows ?? [])
const isLoading = computed(() => modelProdukStatus.value === 'pending')
const loadError = computed(() => getApiErrorMessage(modelProdukError.value))
const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return rows.value.filter((row) => {
    const matchesStatus = statusFilter.value === 'all' || row.status === statusFilter.value
    if (!matchesStatus) return false
    if (!keyword) return true

    return [
      row.model,
      row.produk,
      getOriginLabel(row.origin),
      getStatusLabel(row.status),
    ].some(value => value.toLowerCase().includes(keyword))
  })
})
const tableRows = computed(() => isLoading.value ? [] : filteredRows.value)
const paginationTotal = computed(() => filteredRows.value.length)
const itemsPerPage = computed(() => pagination.value.pageSize)

const columns = computed<TableColumn<ModelProdukRow>[]>(() => {
  const baseColumns: TableColumn<ModelProdukRow>[] = [{
    accessorKey: 'model',
    header: 'Model',
    meta: {
      class: {
        th: 'w-[20%]',
        td: 'w-[20%]',
      },
    },
    cell: ({ row }) => h(
      'p',
      { class: 'truncate font-semibold text-highlighted' },
      row.original.model || '-',
    ),
  }, {
    accessorKey: 'produk',
    header: 'Nama Produk',
    meta: {
      class: {
        th: 'w-[25%]',
        td: 'w-[25%]',
      },
    },
    cell: ({ row }) => h(
      'p',
      { class: 'truncate text-sm' },
      row.original.produk || '-',
    ),
  }, {
    accessorKey: 'origin',
    header: 'Origin',
    meta: {
      class: {
        th: 'w-[15%]',
        td: 'w-[15%]',
      },
    },
    cell: ({ row }) => h(UBadge, {
      color: getOriginColor(row.original.origin),
      variant: 'subtle',
      label: getOriginLabel(row.original.origin),
      class: 'font-semibold',
    }),
  }, {
    accessorKey: 'status',
    header: 'Status',
    meta: {
      class: {
        th: 'w-[15%]',
        td: 'w-[15%]',
      },
    },
    cell: ({ row }) => h(UBadge, {
      color: getStatusColor(row.original.status),
      variant: 'subtle',
      label: getStatusLabel(row.original.status),
      class: 'font-semibold',
    }),
  }, {
    accessorKey: 'updatedAt',
    header: 'Diperbarui',
    meta: {
      class: {
        th: 'w-[20%]',
        td: 'w-[20%]',
      },
    },
    cell: ({ row }) => h(
      'span',
      { class: 'text-muted' },
      formatDate(row.original.updatedAt),
    ),
  }, {
    id: 'actions',
    header: () => h('div', { class: 'text-right' }, 'Aksi'),
    meta: {
      class: {
        th: 'w-[10%]',
        td: 'w-[10%]',
      },
    },
    cell: ({ row }) => h('div', { class: 'flex justify-end' }, [
      h(UButton, {
        label: 'Edit',
        icon: 'i-lucide-pencil',
        color: 'neutral',
        variant: 'soft',
        size: 'sm',
        onClick: () => openEdit(row.original),
      }),
    ]),
  }]

  return canMutate.value
    ? baseColumns
    : baseColumns.filter(column => column.id !== 'actions')
})

const currentPageNumber = computed(() => pagination.value.pageIndex + 1)

watch([search, statusFilter], () => {
  pagination.value.pageIndex = 0
})

function openCreate() {
  editingId.value = null
  formState.model = ''
  formState.produk = ''
  formState.origin = 'local'
  formError.value = ''
  formOpen.value = true
}

function openEdit(row: ModelProdukRow) {
  if (!canMutate.value) return

  editingId.value = row.id
  formState.model = row.model
  formState.produk = row.produk
  formState.origin = row.origin
  formError.value = ''
  formOpen.value = true
}

async function submitForm(event: FormSubmitEvent<ModelProdukForm>) {
  if (!canMutate.value || isSaving.value) return

  formError.value = ''
  isSaving.value = true

  try {
    const payload = {
      model: normalizeModel(event.data.model),
      produk: normalizeText(event.data.produk),
      origin: event.data.origin,
    }
    const wasEditing = Boolean(editingId.value)

    if (editingId.value) {
      await $fetch(`/api/model-produk/${encodeURIComponent(editingId.value)}`, {
        method: 'PATCH',
        body: {
          produk: payload.produk,
          origin: payload.origin,
        },
      })
    } else {
      await $fetch('/api/model-produk', {
        method: 'POST',
        body: payload,
      })
    }

    formOpen.value = false
    editingId.value = null
    await refreshModelProduk()
    showToast(
      wasEditing ? 'Model produk diperbarui' : 'Model produk ditambahkan',
      'success',
    )
  } catch (error) {
    formError.value = getApiErrorMessage(error)
    showToast('Model produk gagal disimpan', 'error', formError.value)
  } finally {
    isSaving.value = false
  }
}

async function refreshTable() {
  await refreshModelProduk()
}

function setPage(page: number) {
  pagination.value.pageIndex = page - 1
}

function normalizeModel(value: string) {
  return normalizeText(value).toUpperCase()
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function getOriginLabel(origin: ModelProdukOrigin) {
  return origin === 'local' ? 'Local' : 'Import'
}

function getOriginColor(origin: ModelProdukOrigin) {
  return origin === 'local' ? 'info' : 'warning'
}

function getStatusLabel(status: ModelProdukStatus) {
  return status === 'verified' ? 'Verified' : 'Perlu review'
}

function getStatusColor(status: ModelProdukStatus) {
  return status === 'verified' ? 'success' : 'warning'
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getApiErrorMessage(error: unknown) {
  if (!error) return ''

  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data as { message?: string; statusMessage?: string }
    return data.statusMessage || data.message || 'Operasi gagal diproses.'
  }

  if (error instanceof Error) return error.message
  return 'Operasi gagal diproses.'
}

function showToast(
  title: string,
  color: 'success' | 'error',
  description?: string,
) {
  toast.add({
    title,
    description,
    color,
    icon: color === 'success' ? 'i-lucide-circle-check' : 'i-lucide-circle-alert',
  })
}
</script>

<template>
  <div class="contents">
    <UDashboardPanel id="product-name">
      <template #body>
        <div class="flex items-center justify-end gap-2">
          <UButton
            v-if="canMutate"
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
              placeholder="Cari model, nama produk, origin, atau status..."
            />

            <div class="flex flex-wrap items-center gap-2">
              <USelect
                v-model="statusFilter"
                :items="statusOptions"
                class="w-full sm:w-40"
              />
              <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="soft"
                aria-label="Muat ulang model produk"
                :loading="isLoading"
                @click="refreshTable"
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
              v-model:pagination="pagination"
              :data="tableRows"
              :columns="columns"
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
                separator: 'h-0',
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
                    Memuat model produk...
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
                    {{ loadError ? 'Model produk belum bisa dimuat' : 'Belum ada model produk' }}
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
              :page="currentPageNumber"
              :items-per-page="itemsPerPage"
              :total="paginationTotal"
              @update:page="setPage"
            />
          </div>
        </section>
      </template>
    </UDashboardPanel>

    <UModal
      v-model:open="formOpen"
      :title="editingId ? 'Edit Model Produk' : 'Tambah Model Produk'"
      :description="editingId ? 'Perbarui nama produk dan origin model' : 'Petakan model ke nama produk'"
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
              :disabled="Boolean(editingId) || isSaving"
              autocomplete="off"
              class="w-full"
              placeholder="Contoh: ABC-123"
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
              placeholder="Nama produk"
            />
          </UFormField>

          <UFormField
            label="Origin"
            name="origin"
            required
          >
            <USelect
              v-model="formState.origin"
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
          :disabled="isSaving"
          @click="close()"
        />
        <UButton
          type="submit"
          form="product-name-form"
          :label="editingId ? 'Simpan Perubahan' : 'Tambah Model'"
          icon="i-lucide-save"
          :loading="isSaving"
        />
      </template>
    </UModal>
  </div>
</template>
