<script setup lang="ts">
import { h } from 'vue'
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { PemohonResponse, PemohonRow } from '~/types/pemohon'

definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

type PemohonFormState = {
  nama: string
  bagian: string
  cabang: string
  email: string
  nomorHp: string
}

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
const selectedPemohon = ref<PemohonRow | null>(null)
const isSaving = ref(false)
const isDeleting = ref(false)
const formError = ref('')
const deleteError = ref('')

const formState = reactive<PemohonFormState>({
  nama: '',
  bagian: '',
  cabang: '',
  email: '',
  nomorHp: '',
})

const pemohonSchema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi').max(120, 'Nama terlalu panjang'),
  bagian: z.string().trim().min(1, 'Bagian wajib diisi').max(120, 'Bagian terlalu panjang'),
  cabang: z.string().trim().min(1, 'Cabang wajib diisi').max(120, 'Cabang terlalu panjang'),
  email: z.string('Email wajib diisi').trim().pipe(z.email('Format email tidak valid')),
  nomorHp: z.string().trim().max(40, 'Nomor HP terlalu panjang'),
})

type PemohonForm = z.output<typeof pemohonSchema>

const {
  data: pemohonData,
  status: pemohonStatus,
  error: pemohonError,
  refresh: refreshPemohon,
} = await useFetch<PemohonResponse>('/api/pemohon', {
  default: () => ({
    rows: [],
  }),
})

const rows = computed(() => pemohonData.value?.rows ?? [])
const isLoading = computed(() => pemohonStatus.value === 'pending')
const loadError = computed(() => getApiErrorMessage(pemohonError.value))
const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  if (!keyword) return rows.value

  return rows.value.filter(row => [
    row.nama,
    row.bagian,
    row.cabang,
    row.email ?? '',
    row.nomorHp ?? '',
  ].some(value => value.toLowerCase().includes(keyword)))
})
const tableRows = computed(() => {
  if (isLoading.value) return []

  const start = pagination.value.pageIndex * pagination.value.pageSize
  return filteredRows.value.slice(start, start + pagination.value.pageSize)
})
const currentPageNumber = computed(() => pagination.value.pageIndex + 1)
const paginationTotal = computed(() => filteredRows.value.length)

const columns = computed<TableColumn<PemohonRow>[]>(() => {
  const baseColumns: TableColumn<PemohonRow>[] = [{
    accessorKey: 'nama',
    header: 'Nama',
    meta: {
      class: {
        th: 'w-[18%]',
        td: 'w-[18%]',
      },
    },
    cell: ({ row }) => h(
      'p',
      { class: 'truncate font-semibold text-highlighted' },
      row.original.nama || '-',
    ),
  }, {
    accessorKey: 'bagian',
    header: 'Bagian',
    meta: {
      class: {
        th: 'w-[15%]',
        td: 'w-[15%]',
      },
    },
    cell: ({ row }) => h(
      'span',
      { class: 'truncate' },
      row.original.bagian || '-',
    ),
  }, {
    accessorKey: 'cabang',
    header: 'Cabang',
    meta: {
      class: {
        th: 'w-[15%]',
        td: 'w-[15%]',
      },
    },
    cell: ({ row }) => h(
      'span',
      { class: 'truncate' },
      row.original.cabang || '-',
    ),
  }, {
    accessorKey: 'email',
    header: 'Email',
    meta: {
      class: {
        th: 'w-[20%]',
        td: 'w-[20%]',
      },
    },
    cell: ({ row }) => h(
      'span',
      { class: 'truncate text-muted' },
      row.original.email || '-',
    ),
  }, {
    accessorKey: 'nomorHp',
    header: 'Nomor HP',
    meta: {
      class: {
        th: 'w-[15%]',
        td: 'w-[15%]',
      },
    },
    cell: ({ row }) => h(
      'span',
      { class: 'truncate text-muted' },
      row.original.nomorHp || '-',
    ),
  }, {
    id: 'actions',
    header: () => h('div', { class: 'text-right' }, 'Aksi'),
    meta: {
      class: {
        th: 'w-[17%]',
        td: 'w-[17%]',
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
        loading: isDeleting.value && selectedPemohon.value?.id === row.original.id,
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
  resetForm()
  formError.value = ''
  formOpen.value = true
}

function openEdit(row: PemohonRow) {
  if (!canMutate.value) return

  editingId.value = row.id
  formState.nama = row.nama
  formState.bagian = row.bagian
  formState.cabang = row.cabang
  formState.email = row.email ?? ''
  formState.nomorHp = row.nomorHp ?? ''
  formError.value = ''
  formOpen.value = true
}

function openDelete(row: PemohonRow) {
  if (!canMutate.value) return

  selectedPemohon.value = row
  deleteError.value = ''
  deleteOpen.value = true
}

async function submitForm(event: FormSubmitEvent<PemohonForm>) {
  if (!canMutate.value || isSaving.value) return

  formError.value = ''
  isSaving.value = true

  try {
    const payload = {
      nama: normalizeText(event.data.nama),
      bagian: normalizeText(event.data.bagian),
      cabang: normalizeText(event.data.cabang),
      email: event.data.email.trim().toLowerCase(),
      nomorHp: normalizeOptionalText(event.data.nomorHp),
    }

    const wasEditing = Boolean(editingId.value)

    if (editingId.value) {
      await $fetch(`/api/pemohon/${encodeURIComponent(editingId.value)}`, {
        method: 'PATCH',
        body: payload,
      })
    } else {
      await $fetch('/api/pemohon', {
        method: 'POST',
        body: payload,
      })
    }

    formOpen.value = false
    editingId.value = null
    await refreshPemohon()
    clampPagination()
    showToast(
      wasEditing ? 'Pemohon berhasil diperbarui' : 'Pemohon berhasil ditambahkan',
      'success',
    )
  } catch (error) {
    formError.value = getApiErrorMessage(error)
    showToast('Pemohon gagal disimpan', 'error', formError.value)
  } finally {
    isSaving.value = false
  }
}

async function confirmDelete() {
  if (!canMutate.value || !selectedPemohon.value || isDeleting.value) return

  deleteError.value = ''
  isDeleting.value = true

  try {
    await $fetch(`/api/pemohon/${encodeURIComponent(selectedPemohon.value.id)}`, {
      method: 'DELETE',
    })

    deleteOpen.value = false
    selectedPemohon.value = null
    await refreshPemohon()
    clampPagination()
    showToast('Pemohon berhasil dihapus', 'success')
  } catch (error) {
    deleteError.value = getApiErrorMessage(error)
    showToast('Pemohon gagal dihapus', 'error', deleteError.value)
  } finally {
    isDeleting.value = false
  }
}

async function refreshTable() {
  await refreshPemohon()
  clampPagination()
}

function resetForm() {
  formState.nama = ''
  formState.bagian = ''
  formState.cabang = ''
  formState.email = ''
  formState.nomorHp = ''
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

function normalizeOptionalText(value: string) {
  const normalized = normalizeText(value)
  return normalized || null
}

function getApiErrorMessage(error: unknown) {
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
      title="Master Pemohon"
      description="Kelola data pemohon yang digunakan saat membuat pengajuan."
      variant="naked"
      orientation="horizontal"
    >
      <UButton
        v-if="canMutate"
        label="Tambah Pemohon"
        icon="i-lucide-user-plus"
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
          placeholder="Cari nama, bagian, cabang, email, atau nomor HP"
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
            base: 'w-full min-w-250 table-fixed border-separate border-spacing-0',
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
                Memuat data pemohon...
              </p>
            </div>
          </template>

          <template #empty>
            <div class="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <UIcon
                :name="loadError ? 'i-lucide-circle-alert' : 'i-lucide-users-round'"
                class="size-8 text-muted"
              />
              <p class="text-sm font-medium text-highlighted">
                {{ loadError ? 'Data pemohon belum bisa dimuat' : 'Belum ada data pemohon' }}
              </p>
              <p v-if="!loadError" class="max-w-md text-sm text-muted">
                Tambahkan data pemohon untuk digunakan pada pengajuan.
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
          {{ filteredRows.length }} pemohon terdaftar
        </p>
        <UPagination
          :page="currentPageNumber"
          :items-per-page="pagination.pageSize"
          :total="paginationTotal"
          @update:page="setPage"
        />
      </div>
    </section>

    <UModal
      v-model:open="formOpen"
      :title="editingId ? 'Edit Pemohon' : 'Tambah Pemohon'"
      :description="editingId ? 'Perbarui data pemohon.' : 'Tambahkan data pemohon baru.'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          id="pemohon-form"
          :schema="pemohonSchema"
          :state="formState"
          class="grid gap-4 sm:grid-cols-2"
          @submit="submitForm"
        >
          <UFormField label="Nama" name="nama" required>
            <UInput v-model="formState.nama" autocomplete="name" class="w-full" />
          </UFormField>

          <UFormField label="Bagian" name="bagian" required>
            <UInput v-model="formState.bagian" class="w-full" />
          </UFormField>

          <UFormField label="Cabang" name="cabang" required>
            <UInput v-model="formState.cabang" class="w-full" />
          </UFormField>

          <UFormField label="Email" name="email" required>
            <UInput
              v-model="formState.email"
              type="email"
              autocomplete="email"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Nomor HP" name="nomorHp" hint="Opsional" class="sm:col-span-2">
            <UInput
              v-model="formState.nomorHp"
              type="tel"
              autocomplete="tel"
              class="w-full"
            />
          </UFormField>

          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="formError"
            class="sm:col-span-2"
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
          form="pemohon-form"
          :label="editingId ? 'Simpan Perubahan' : 'Tambah Pemohon'"
          icon="i-lucide-save"
          :loading="isSaving"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="deleteOpen"
      title="Hapus Pemohon?"
      :description="selectedPemohon ? `${selectedPemohon.nama} akan dihapus dari master pemohon.` : undefined"
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
          Data ini tidak dapat digunakan lagi untuk pengajuan baru setelah dihapus.
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
