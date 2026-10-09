<script setup lang="ts">
import { h } from 'vue'
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { PemilikBarangResponse, PemilikBarangRow } from '~/types/pemilik-barang'

definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

const UButton = resolveComponent('UButton')

const toast = useToast()
const { isAdmin, isQrcc } = useUserProfile()

const canMutate = computed(() => isAdmin.value || isQrcc.value)
const search = ref('')
const pagination = ref({
  pageIndex: 0,
  pageSize: 15,
})
const formOpen = ref(false)
const deleteOpen = ref(false)
const editingId = ref<string | null>(null)
const selectedDealer = ref<PemilikBarangRow | null>(null)
const isSaving = ref(false)
const isDeleting = ref(false)
const formError = ref('')
const deleteError = ref('')

const formState = reactive({
  nama: '',
})

const dealerSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(1, 'Nama Dealer/Toko wajib diisi')
    .max(160, 'Nama Dealer/Toko terlalu panjang'),
})

type DealerForm = z.output<typeof dealerSchema>

const {
  data: dealerData,
  status: dealerStatus,
  error: dealerError,
  refresh: refreshDealers,
} = await useFetch<PemilikBarangResponse>('/api/pemilik-barang', {
  default: () => ({
    rows: [],
  }),
})

const rows = computed(() => dealerData.value?.rows ?? [])
const isLoading = computed(() => dealerStatus.value === 'pending')
const loadError = computed(() => getApiErrorMessage(dealerError.value))
const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  if (!keyword) return rows.value
  return rows.value.filter(row => row.nama.toLowerCase().includes(keyword))
})
const tableRows = computed(() => {
  if (isLoading.value) return []

  const start = pagination.value.pageIndex * pagination.value.pageSize
  return filteredRows.value.slice(start, start + pagination.value.pageSize)
})
const currentPageNumber = computed(() => pagination.value.pageIndex + 1)

const columns = computed<TableColumn<PemilikBarangRow>[]>(() => {
  const baseColumns: TableColumn<PemilikBarangRow>[] = [{
    accessorKey: 'nama',
    header: 'Nama Dealer/Toko',
    meta: {
      class: {
        th: 'w-[60%]',
        td: 'w-[60%]',
      },
    },
    cell: ({ row }) => h(
      'p',
      { class: 'truncate font-semibold text-highlighted' },
      row.original.nama || '-',
    ),
  }, {
    accessorKey: 'updatedAt',
    header: 'Diperbarui',
    meta: {
      class: {
        th: 'w-[25%]',
        td: 'w-[25%]',
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
        th: 'w-[15%]',
        td: 'w-[15%]',
      },
    },
    cell: ({ row }) => h('div', { class: 'flex justify-end gap-2' }, [
      h(UButton, {
        label: 'Edit',
        icon: 'i-lucide-pencil',
        color: 'neutral',
        variant: 'soft',
        size: 'sm',
        onClick: () => openEdit(row.original),
      }),
      h(UButton, {
        label: 'Hapus',
        icon: 'i-lucide-trash-2',
        color: 'error',
        variant: 'soft',
        size: 'sm',
        loading: isDeleting.value && selectedDealer.value?.id === row.original.id,
        disabled: isDeleting.value,
        onClick: () => openDelete(row.original),
      }),
    ]),
  }]

  return canMutate.value
    ? baseColumns
    : baseColumns.filter(column => column.id !== 'actions')
})

watch(search, () => {
  pagination.value.pageIndex = 0
})

function openCreate() {
  if (!canMutate.value) return

  editingId.value = null
  formState.nama = ''
  formError.value = ''
  formOpen.value = true
}

function openEdit(row: PemilikBarangRow) {
  if (!canMutate.value) return

  editingId.value = row.id
  formState.nama = row.nama
  formError.value = ''
  formOpen.value = true
}

function openDelete(row: PemilikBarangRow) {
  if (!canMutate.value) return

  selectedDealer.value = row
  deleteError.value = ''
  deleteOpen.value = true
}

async function submitForm(event: FormSubmitEvent<DealerForm>) {
  if (!canMutate.value || isSaving.value) return

  formError.value = ''
  isSaving.value = true

  try {
    const payload = {
      nama: normalizeText(event.data.nama),
    }
    const wasEditing = Boolean(editingId.value)

    if (editingId.value) {
      await $fetch(`/api/pemilik-barang/${encodeURIComponent(editingId.value)}`, {
        method: 'PATCH',
        body: payload,
      })
    } else {
      await $fetch('/api/pemilik-barang', {
        method: 'POST',
        body: payload,
      })
    }

    formOpen.value = false
    editingId.value = null
    await refreshDealers()
    clampPagination()
    showToast(
      wasEditing ? 'Dealer/Toko berhasil diperbarui' : 'Dealer/Toko berhasil ditambahkan',
      'success',
    )
  } catch (error) {
    formError.value = getApiErrorMessage(error)
    showToast('Dealer/Toko gagal disimpan', 'error', formError.value)
  } finally {
    isSaving.value = false
  }
}

async function confirmDelete() {
  if (!canMutate.value || !selectedDealer.value || isDeleting.value) return

  deleteError.value = ''
  isDeleting.value = true

  try {
    await $fetch(`/api/pemilik-barang/${encodeURIComponent(selectedDealer.value.id)}`, {
      method: 'DELETE',
    })

    deleteOpen.value = false
    selectedDealer.value = null
    await refreshDealers()
    clampPagination()
    showToast('Dealer/Toko berhasil dihapus', 'success')
  } catch (error) {
    deleteError.value = getApiErrorMessage(error)
    showToast('Dealer/Toko gagal dihapus', 'error', deleteError.value)
  } finally {
    isDeleting.value = false
  }
}

async function refreshTable() {
  await refreshDealers()
  clampPagination()
}

function setPage(page: number) {
  pagination.value.pageIndex = page - 1
}

function clampPagination() {
  const lastPage = Math.max(
    0,
    Math.ceil(filteredRows.value.length / pagination.value.pageSize) - 1,
  )

  pagination.value.pageIndex = Math.min(pagination.value.pageIndex, lastPage)
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
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

  if (error && typeof error === 'object') {
    const value = error as {
      data?: unknown
      message?: unknown
      statusMessage?: unknown
      statusText?: unknown
    }

    if (value.data && typeof value.data === 'object') {
      const data = value.data as { message?: unknown; statusMessage?: unknown }
      if (typeof data.statusMessage === 'string') return data.statusMessage
      if (typeof data.message === 'string') return data.message
    }

    if (typeof value.statusMessage === 'string') return value.statusMessage
    if (typeof value.statusText === 'string') return value.statusText
    if (typeof value.message === 'string') return value.message
  }

  if (error instanceof Error) return error.message
  return 'Operasi gagal diproses.'
}

function showToast(title: string, color: 'success' | 'error', description?: string) {
  toast.add({
    title,
    description,
    color,
    icon: color === 'success' ? 'i-lucide-circle-check' : 'i-lucide-circle-alert',
  })
}
</script>

<template>
  <div class="space-y-6">
    <UPageCard
      title="Master Dealer/Toko"
      description="Kelola pemilik barang yang tersedia untuk pengajuan."
      variant="naked"
      orientation="horizontal"
    >
      <UButton
        v-if="canMutate"
        label="Tambah Dealer/Toko"
        icon="i-lucide-store"
        class="lg:ms-auto"
        @click="openCreate"
      />
    </UPageCard>

    <section class="overflow-hidden rounded-lg border border-muted bg-default">
      <div class="flex flex-col gap-3 border-b border-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <UInput
          v-model="search"
          class="w-full sm:max-w-md"
          icon="i-lucide-search"
          placeholder="Cari nama Dealer/Toko"
        />

        <UButton
          label="Refresh"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="soft"
          :loading="isLoading"
          @click="refreshTable"
        />
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
          :data="tableRows"
          :columns="columns"
          :loading="isLoading"
          loading-color="primary"
          loading-animation="carousel"
          class="w-full"
          :ui="{
            root: 'w-full',
            base: 'w-full min-w-160 table-fixed border-separate border-spacing-0',
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
                Memuat data Dealer/Toko...
              </p>
            </div>
          </template>

          <template #empty>
            <div class="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <UIcon
                :name="loadError ? 'i-lucide-circle-alert' : 'i-lucide-store'"
                class="size-8 text-muted"
              />
              <p class="text-sm font-medium text-highlighted">
                {{ loadError ? 'Data Dealer/Toko belum bisa dimuat' : 'Belum ada Dealer/Toko' }}
              </p>
              <p v-if="!loadError" class="max-w-md text-sm text-muted">
                Tambahkan Dealer/Toko untuk digunakan sebagai pemilik barang.
              </p>
            </div>
          </template>
        </UTable>
      </div>

      <div
        v-if="!isLoading && filteredRows.length"
        class="flex flex-col gap-3 border-t border-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-sm text-muted">
          {{ filteredRows.length }} Dealer/Toko terdaftar
        </p>
        <UPagination
          :page="currentPageNumber"
          :items-per-page="pagination.pageSize"
          :total="filteredRows.length"
          @update:page="setPage"
        />
      </div>
    </section>

    <UModal
      v-model:open="formOpen"
      :title="editingId ? 'Edit Dealer/Toko' : 'Tambah Dealer/Toko'"
      :description="editingId ? 'Perbarui nama Dealer/Toko.' : 'Tambahkan Dealer/Toko baru.'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          id="dealer-toko-form"
          :schema="dealerSchema"
          :state="formState"
          class="space-y-4"
          @submit="submitForm"
        >
          <UFormField label="Nama Dealer/Toko" name="nama" required>
            <UInput
              v-model="formState.nama"
              autocomplete="organization"
              class="w-full"
              placeholder="Contoh: PT Maukaga Jaya"
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
          @click="close"
        />
        <UButton
          type="submit"
          form="dealer-toko-form"
          :label="editingId ? 'Simpan Perubahan' : 'Tambah Dealer/Toko'"
          icon="i-lucide-save"
          :loading="isSaving"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="deleteOpen"
      title="Hapus Dealer/Toko?"
      :description="selectedDealer ? `${selectedDealer.nama} akan dihapus dari master Dealer/Toko.` : undefined"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UAlert
          v-if="deleteError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="deleteError"
          class="mb-4"
        />
        <p class="text-sm text-muted">
          Data ini tidak dapat dipilih untuk pengajuan baru setelah dihapus.
        </p>
      </template>

      <template #footer="{ close }">
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          :disabled="isDeleting"
          @click="close"
        />
        <UButton
          label="Hapus"
          icon="i-lucide-trash-2"
          color="error"
          :loading="isDeleting"
          @click="confirmDelete"
        />
      </template>
    </UModal>
  </div>
</template>
