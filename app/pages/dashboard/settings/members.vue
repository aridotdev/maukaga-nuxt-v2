<script setup lang="ts">
import { h } from 'vue'
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { MemberRole, MemberRow, MembersResponse } from '~/types/member'

definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const toast = useToast()
const { isAdmin } = useUserProfile()
const { user: currentUser, getSession } = useCurrentSession()

if (import.meta.client) {
  await getSession()
}

const canManageMembers = computed(() => isAdmin.value)
const search = ref('')
const roleFilter = ref<'all' | MemberRole>('all')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const createOpen = ref(false)
const editOpen = ref(false)
const selectedMember = ref<MemberRow | null>(null)
const isSaving = ref(false)
const actionMemberId = ref('')

const roleValues = ['admin', 'management', 'qrcc'] as const

const createSchema = z.object({
  email: z.string('Email wajib diisi').trim().pipe(z.email('Format email tidak valid')),
  name: z.string().trim().max(120, 'Nama terlalu panjang').optional(),
  role: z.enum(roleValues),
  password: z.string().min(8, 'Password minimal 8 karakter').max(200, 'Password terlalu panjang'),
  passwordConfirmation: z.string().min(1, 'Konfirmasi password wajib diisi'),
}).refine(value => value.password === value.passwordConfirmation, {
  path: ['passwordConfirmation'],
  message: 'Konfirmasi password tidak sama',
})

const editSchema = z.object({
  name: z.string().trim().max(120, 'Nama terlalu panjang').optional(),
  role: z.enum(roleValues),
})

type CreateForm = z.output<typeof createSchema>
type EditForm = z.output<typeof editSchema>

const createState = reactive<Partial<CreateForm>>({
  email: '',
  name: '',
  role: 'qrcc',
  password: '',
  passwordConfirmation: '',
})

const editState = reactive<Partial<EditForm>>({
  name: '',
  role: 'qrcc',
})

const roleItems = [{
  label: 'Admin',
  value: 'admin',
}, {
  label: 'Management',
  value: 'management',
}, {
  label: 'QRCC',
  value: 'qrcc',
}] satisfies Array<{ label: string; value: MemberRole }>

const roleFilterItems = computed(() => [{
  label: 'Semua role',
  value: 'all',
}, ...roleItems] satisfies Array<{ label: string; value: 'all' | MemberRole }>)

const statusFilterItems = [{
  label: 'Semua status',
  value: 'all',
}, {
  label: 'Aktif',
  value: 'active',
}, {
  label: 'Nonaktif',
  value: 'inactive',
}] satisfies Array<{ label: string; value: 'all' | 'active' | 'inactive' }>

const {
  data: membersData,
  status: membersStatus,
  error: membersError,
  refresh: refreshMembers,
} = await useFetch<MembersResponse>('/api/admin/members', {
  server: false,
  default: () => ({
    rows: [],
    summary: {
      total: 0,
      active: 0,
      inactive: 0,
      admins: 0,
    },
  }),
})

const members = computed(() => membersData.value?.rows ?? [])
const isLoading = computed(() => membersStatus.value === 'pending')
const loadError = computed(() => {
  if (membersStatus.value !== 'error' || members.value.length > 0) return ''
  return getApiErrorMessage(membersError.value)
})
const filteredMembers = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return members.value.filter((member) => {
    if (roleFilter.value !== 'all' && member.role !== roleFilter.value) return false
    if (statusFilter.value === 'active' && !member.isActive) return false
    if (statusFilter.value === 'inactive' && member.isActive) return false
    if (!keyword) return true

    return [
      member.email,
      member.name,
      getRoleLabel(member.role),
      member.isActive ? 'aktif' : 'nonaktif',
    ].some(value => value.toLowerCase().includes(keyword))
  })
})

const summaryCards = computed(() => [{
  label: 'Total Anggota',
  value: membersData.value?.summary.total ?? 0,
  icon: 'i-lucide-users',
}, {
  label: 'Aktif',
  value: membersData.value?.summary.active ?? 0,
  icon: 'i-lucide-user-check',
}, {
  label: 'Nonaktif',
  value: membersData.value?.summary.inactive ?? 0,
  icon: 'i-lucide-user-x',
}, {
  label: 'Admin Aktif',
  value: membersData.value?.summary.admins ?? 0,
  icon: 'i-lucide-shield-check',
}])

const columns = computed<TableColumn<MemberRow>[]>(() => {
  const baseColumns: TableColumn<MemberRow>[] = [{
    accessorKey: 'email',
    header: 'Anggota',
    meta: {
      class: {
        th: 'w-[34%]',
        td: 'w-[34%]',
      },
    },
    cell: ({ row }) => h('div', { class: 'min-w-0' }, [
      h('p', { class: 'truncate font-semibold text-highlighted' }, row.original.name || '-'),
      h('p', { class: 'truncate text-xs text-muted' }, row.original.email),
    ]),
  }, {
    accessorKey: 'role',
    header: 'Role',
    meta: {
      class: {
        th: 'w-[16%]',
        td: 'w-[16%]',
      },
    },
    cell: ({ row }) => h(UBadge, {
      color: getRoleColor(row.original.role),
      variant: 'subtle',
      label: getRoleLabel(row.original.role),
      class: 'font-semibold',
    }),
  }, {
    accessorKey: 'isActive',
    header: 'Status',
    meta: {
      class: {
        th: 'w-[14%]',
        td: 'w-[14%]',
      },
    },
    cell: ({ row }) => h(UBadge, {
      color: row.original.isActive ? 'success' : 'neutral',
      variant: 'subtle',
      label: row.original.isActive ? 'Aktif' : 'Nonaktif',
      class: 'font-semibold',
    }),
  }, {
    accessorKey: 'createdAt',
    header: 'Dibuat',
    meta: {
      class: {
        th: 'w-[16%]',
        td: 'w-[16%]',
      },
    },
    cell: ({ row }) => h('span', { class: 'text-muted' }, formatDate(row.original.createdAt)),
  }, {
    id: 'actions',
    header: () => h('div', { class: 'text-right' }, 'Aksi'),
    meta: {
      class: {
        th: 'w-[20%]',
        td: 'w-[20%]',
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
        label: row.original.isActive ? 'Nonaktifkan' : 'Aktifkan',
        icon: row.original.isActive ? 'i-lucide-user-x' : 'i-lucide-user-check',
        color: row.original.isActive ? 'error' : 'success',
        variant: 'soft',
        size: 'sm',
        loading: actionMemberId.value === row.original.id,
        disabled: Boolean(actionMemberId.value) || row.original.id === currentUser.value?.id,
        onClick: () => toggleMemberStatus(row.original),
      }),
    ]),
  }]

  return canManageMembers.value
    ? baseColumns
    : baseColumns.filter(column => column.id !== 'actions')
})

function openCreate() {
  if (!canManageMembers.value) return
  resetCreateForm()
  createOpen.value = true
}

function openEdit(member: MemberRow) {
  if (!canManageMembers.value) return
  selectedMember.value = member
  editState.name = member.name
  editState.role = member.role
  editOpen.value = true
}

async function submitCreate(event: FormSubmitEvent<CreateForm>) {
  if (!canManageMembers.value || isSaving.value) return

  isSaving.value = true
  try {
    await $fetch('/api/admin/members', {
      method: 'POST',
      body: {
        email: event.data.email,
        name: event.data.name || '',
        role: event.data.role,
        password: event.data.password,
      },
    })

    createOpen.value = false
    resetCreateForm()
    await refreshMembers()
    showToast('Anggota berhasil ditambahkan', 'success')
  } catch (error) {
    showToast('Anggota gagal ditambahkan', 'error', getApiErrorMessage(error))
  } finally {
    isSaving.value = false
  }
}

async function submitEdit(event: FormSubmitEvent<EditForm>) {
  if (!canManageMembers.value || !selectedMember.value || isSaving.value) return

  isSaving.value = true
  try {
    await $fetch(`/api/admin/members/${encodeURIComponent(selectedMember.value.id)}`, {
      method: 'PATCH',
      body: {
        name: event.data.name || '',
        role: event.data.role,
      },
    })

    editOpen.value = false
    selectedMember.value = null
    await refreshMembers()
    showToast('Anggota berhasil diperbarui', 'success')
  } catch (error) {
    showToast('Anggota gagal diperbarui', 'error', getApiErrorMessage(error))
  } finally {
    isSaving.value = false
  }
}

async function toggleMemberStatus(member: MemberRow) {
  if (!canManageMembers.value || actionMemberId.value || member.id === currentUser.value?.id) return

  actionMemberId.value = member.id
  try {
    await $fetch(`/api/admin/members/${encodeURIComponent(member.id)}`, {
      method: 'PATCH',
      body: {
        isActive: !member.isActive,
      },
    })

    await refreshMembers()
    showToast(
      member.isActive ? 'Anggota dinonaktifkan' : 'Anggota diaktifkan',
      'success',
    )
  } catch (error) {
    showToast('Status anggota gagal diubah', 'error', getApiErrorMessage(error))
  } finally {
    actionMemberId.value = ''
  }
}

function resetCreateForm() {
  createState.email = ''
  createState.name = ''
  createState.role = 'qrcc'
  createState.password = ''
  createState.passwordConfirmation = ''
}

function getRoleLabel(role: MemberRole) {
  return {
    admin: 'Admin',
    management: 'Management',
    qrcc: 'QRCC',
  }[role]
}

function getRoleColor(role: MemberRole) {
  return {
    admin: 'primary',
    management: 'info',
    qrcc: 'success',
  }[role]
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
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
      title="Manajemen Anggota"
      description="Kelola akun, role, dan status akses pengguna dashboard."
      variant="naked"
      orientation="horizontal"
    >
      <UButton
        label="Tambah Anggota"
        icon="i-lucide-user-plus"
        class="lg:ms-auto"
        :disabled="!canManageMembers"
        @click="openCreate"
      />
    </UPageCard>

    <UAlert
      v-if="!canManageMembers"
      color="warning"
      icon="i-lucide-shield-alert"
      title="Akses terbatas"
      description="Manajemen anggota hanya dapat dilakukan oleh admin."
      variant="subtle"
    />

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
              {{ isLoading ? '...' : card.value }}
            </p>
          </div>
          <UIcon :name="card.icon" class="size-5 text-muted" />
        </div>
      </div>
    </div>

    <section class="overflow-hidden rounded-lg border border-muted bg-default">
      <div class="flex flex-col gap-3 border-b border-muted px-4 py-4">
        <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <UInput
            v-model="search"
            class="w-full xl:max-w-sm"
            icon="i-lucide-search"
            placeholder="Cari email, nama, role, status"
          />

          <div class="flex flex-col gap-2 sm:flex-row">
            <USelect
              v-model="roleFilter"
              :items="roleFilterItems"
              class="w-full sm:w-40"
            />
            <USelect
              v-model="statusFilter"
              :items="statusFilterItems"
              class="w-full sm:w-40"
            />
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="soft"
              :loading="isLoading"
              @click="refreshMembers()"
            >
              Refresh
            </UButton>
          </div>
        </div>
      </div>

      <UAlert
        v-if="loadError"
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
        :title="loadError"
        class="m-4"
      />

      <UTable
        :data="filteredMembers"
        :columns="columns"
        :loading="isLoading"
        class="w-full"
        :ui="{
          root: 'w-full',
          base: 'w-full min-w-190 table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/45 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          tr: 'transition-colors hover:bg-elevated/30',
          th: 'border-b border-muted px-4 py-3 text-xs font-semibold uppercase text-muted',
          td: 'border-b border-muted px-4 py-4 text-sm align-middle',
          separator: 'h-0',
        }"
      >
        <template #empty>
          <div class="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <UIcon
              :name="loadError ? 'i-lucide-circle-alert' : 'i-lucide-users'"
              class="size-8 text-muted"
            />
            <p class="text-sm font-medium text-highlighted">
              {{ loadError ? 'Anggota belum bisa dimuat' : 'Belum ada anggota' }}
            </p>
          </div>
        </template>
      </UTable>
    </section>

    <UModal
      v-model:open="createOpen"
      title="Tambah Anggota"
      description="Buat akun dashboard dengan role dan password awal."
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          id="create-member-form"
          :schema="createSchema"
          :state="createState"
          class="space-y-4"
          @submit="submitCreate"
        >
          <UFormField label="Email" name="email" required>
            <UInput v-model="createState.email" type="email" autocomplete="email" class="w-full" />
          </UFormField>

          <UFormField label="Nama" name="name">
            <UInput v-model="createState.name" autocomplete="name" class="w-full" />
          </UFormField>

          <UFormField label="Role" name="role" required>
            <USelect v-model="createState.role" :items="roleItems" class="w-full" />
          </UFormField>

          <UFormField label="Password awal" name="password" required>
            <UInput v-model="createState.password" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>

          <UFormField label="Konfirmasi password" name="passwordConfirmation" required>
            <UInput
              v-model="createState.passwordConfirmation"
              type="password"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>
        </UForm>
      </template>

      <template #footer="{ close }">
        <UButton label="Batal" color="neutral" variant="outline" @click="close" />
        <UButton
          type="submit"
          form="create-member-form"
          label="Simpan Anggota"
          icon="i-lucide-user-plus"
          :loading="isSaving"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="editOpen"
      title="Edit Anggota"
      description="Ubah nama dan role anggota."
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          id="edit-member-form"
          :schema="editSchema"
          :state="editState"
          class="space-y-4"
          @submit="submitEdit"
        >
          <UFormField label="Nama" name="name">
            <UInput v-model="editState.name" autocomplete="name" class="w-full" />
          </UFormField>

          <UFormField label="Role" name="role" required>
            <USelect v-model="editState.role" :items="roleItems" class="w-full" />
          </UFormField>
        </UForm>
      </template>

      <template #footer="{ close }">
        <UButton label="Batal" color="neutral" variant="outline" @click="close" />
        <UButton
          type="submit"
          form="edit-member-form"
          label="Simpan"
          icon="i-lucide-save"
          :loading="isSaving"
        />
      </template>
    </UModal>
  </div>
</template>
