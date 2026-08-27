<script setup lang="ts">
import { h } from 'vue'
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'

definePageMeta({
  middleware: ['auth-guard', 'role-guard']
})

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const roleValues = ['admin', 'management', 'qrcc'] as const
type UserRole = typeof roleValues[number]

type AdminUser = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

const roleItems = [{
  label: 'Admin',
  value: 'admin'
}, {
  label: 'Management',
  value: 'management'
}, {
  label: 'QRCC',
  value: 'qrcc'
}]

const memberStatusOptions = [{
  label: 'Semua status',
  value: 'all'
}, {
  label: 'Aktif',
  value: 'active'
}, {
  label: 'Nonaktif',
  value: 'inactive'
}]

const inviteSchema = z.object({
  email: z.string('Email wajib diisi').email('Format email tidak valid'),
  full_name: z.string().optional(),
  role: z.string('Role wajib diisi').refine(value => isUserRole(value), 'Role tidak valid')
})

const editSchema = z.object({
  full_name: z.string().optional(),
  role: z.string('Role wajib diisi').refine(value => isUserRole(value), 'Role tidak valid')
})

type InviteSchema = z.output<typeof inviteSchema>
type EditSchema = z.output<typeof editSchema>

const toast = useToast()
const { callAdminAction } = useAdminApi()

const users = ref<AdminUser[]>([])
const isLoading = ref(false)
const isInviting = ref(false)
const isSaving = ref(false)
const actionUserId = ref('')
const loadError = ref('')
const search = ref('')
const roleFilter = ref<'all' | UserRole>('all')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const inviteOpen = ref(false)
const editOpen = ref(false)
const selectedUser = ref<AdminUser | null>(null)

const inviteState = reactive<Partial<InviteSchema>>({
  email: '',
  full_name: '',
  role: 'qrcc'
})

const editState = reactive<Partial<EditSchema>>({
  full_name: '',
  role: 'qrcc'
})

const columns: TableColumn<AdminUser>[] = [{
  accessorKey: 'email',
  header: 'User',
  meta: {
    class: {
      th: 'w-[34%]',
      td: 'w-[34%]'
    }
  },
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'truncate font-semibold text-highlighted' }, row.original.full_name || '-'),
    h('p', { class: 'truncate text-xs text-muted' }, row.original.email)
  ])
}, {
  accessorKey: 'role',
  header: 'Role',
  meta: {
    class: {
      th: 'w-[16%]',
      td: 'w-[16%]'
    }
  },
  cell: ({ row }) => h(UBadge, {
    color: getRoleColor(row.original.role),
    variant: 'subtle',
    label: getRoleLabel(row.original.role),
    class: 'font-semibold'
  })
}, {
  accessorKey: 'is_active',
  header: 'Status',
  meta: {
    class: {
      th: 'w-[14%]',
      td: 'w-[14%]'
    }
  },
  cell: ({ row }) => h(UBadge, {
    color: row.original.is_active ? 'success' : 'neutral',
    variant: 'subtle',
    label: row.original.is_active ? 'Aktif' : 'Nonaktif',
    class: 'font-semibold'
  })
}, {
  accessorKey: 'created_at',
  header: 'Dibuat',
  meta: {
    class: {
      th: 'w-[16%]',
      td: 'w-[16%]'
    }
  },
  cell: ({ row }) => h('span', { class: 'text-muted' }, formatDate(row.original.created_at))
}, {
  id: 'actions',
  header: () => h('div', { class: 'text-right' }, 'Aksi'),
  meta: {
    class: {
      th: 'w-[20%]',
      td: 'w-[20%]'
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
    }),
    h(UButton, {
      label: row.original.is_active ? 'Nonaktifkan' : 'Aktifkan',
      icon: row.original.is_active ? 'i-lucide-user-x' : 'i-lucide-user-check',
      color: row.original.is_active ? 'error' : 'success',
      variant: 'soft',
      size: 'sm',
      loading: actionUserId.value === row.original.id,
      disabled: Boolean(actionUserId.value),
      onClick: () => toggleUserStatus(row.original)
    })
  ])
}]

const roleFilterItems = computed(() => [{
  label: 'Semua role',
  value: 'all'
}, ...roleItems])

const filteredUsers = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return users.value.filter((user) => {
    if (roleFilter.value !== 'all' && user.role !== roleFilter.value) return false
    if (statusFilter.value === 'active' && !user.is_active) return false
    if (statusFilter.value === 'inactive' && user.is_active) return false

    if (!keyword) return true

    return [
      user.email,
      user.full_name,
      user.role,
      user.is_active ? 'aktif' : 'nonaktif'
    ].some(value => String(value || '').toLowerCase().includes(keyword))
  })
})

onMounted(() => {
  loadUsers()
})

async function loadUsers() {
  if (isLoading.value) return

  isLoading.value = true
  loadError.value = ''

  try {
    const data = await callAdminAction<AdminUser[]>('adminUsersList')
    users.value = (data || []).map(user => ({
      ...user,
      full_name: user.full_name || '',
      role: normalizeUserRole(user.role),
      is_active: user.is_active === true
    }))
  } catch (error) {
    loadError.value = getErrorMessage(error)
    users.value = []
  } finally {
    isLoading.value = false
  }
}

async function submitInvite(event: FormSubmitEvent<InviteSchema>) {
  isInviting.value = true

  try {
    await callAdminAction('adminUsersInvite', {
      email: event.data.email,
      full_name: event.data.full_name || '',
      role: normalizeUserRole(event.data.role)
    })

    toast.add({
      title: 'Undangan terkirim',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    inviteOpen.value = false
    resetInviteForm()
    await loadUsers()
  } catch (error) {
    toast.add({
      title: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isInviting.value = false
  }
}

function openEdit(user: AdminUser) {
  selectedUser.value = user
  editState.full_name = user.full_name || ''
  editState.role = user.role
  editOpen.value = true
}

async function submitEdit(event: FormSubmitEvent<EditSchema>) {
  if (!selectedUser.value) return

  isSaving.value = true

  try {
    await callAdminAction('adminUsersUpdate', {
      targetUserId: selectedUser.value.id,
      full_name: event.data.full_name || '',
      role: normalizeUserRole(event.data.role)
    })

    toast.add({
      title: 'User diperbarui',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    editOpen.value = false
    selectedUser.value = null
    await loadUsers()
  } catch (error) {
    toast.add({
      title: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isSaving.value = false
  }
}

async function toggleUserStatus(user: AdminUser) {
  const action = user.is_active ? 'adminUsersDeactivate' : 'adminUsersReactivate'

  actionUserId.value = user.id

  try {
    await callAdminAction(action, { targetUserId: user.id })

    toast.add({
      title: user.is_active ? 'User dinonaktifkan' : 'User diaktifkan',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    await loadUsers()
  } catch (error) {
    toast.add({
      title: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    actionUserId.value = ''
  }
}

function resetInviteForm() {
  inviteState.email = ''
  inviteState.full_name = ''
  inviteState.role = 'qrcc'
}

function isUserRole(value: unknown): value is UserRole {
  return roleValues.includes(String(value || '') as UserRole)
}

function normalizeUserRole(value: unknown): UserRole {
  const role = String(value || '').toLowerCase()
  return isUserRole(role) ? role : 'qrcc'
}

function getRoleLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    admin: 'Admin',
    management: 'Management',
    qrcc: 'QRCC'
  }

  return labels[role]
}

function getRoleColor(role: UserRole) {
  const colors = {
    admin: 'primary',
    management: 'info',
    qrcc: 'success'
  } as const

  return colors[role] || 'neutral'
}

function formatDate(value: string) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <div class="contents">
  <UDashboardPanel id="members">  
    <template #body>
      <div class="flex items-center justify-end gap-2">
        <UButton
        label="Invite User"
        icon="i-lucide-user-plus"
        @click="inviteOpen = true"
        />
      </div>
      <section class="relative rounded-lg border border-muted bg-default/45 shadow-sm backdrop-blur-xl">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-accented px-4 py-3.5">
          <UInput
            v-model="search"
            class="w-full max-w-sm"
            icon="i-lucide-search"
            placeholder="Cari user..."
          />

          <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <USelect
              v-model="roleFilter"
              :items="roleFilterItems"
              class="w-full sm:w-40"
            />
            <USelect
              v-model="statusFilter"
              :items="memberStatusOptions"
              class="w-full sm:w-40"
            />
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="soft"
              :loading="isLoading"
              @click="loadUsers"
            />
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

        <div class="min-h-0 w-full overflow-x-auto">
          <UTable
            :data="filteredUsers"
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
              separator: 'h-0'
            }"
          >
            <template #empty>
              <div class="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <UIcon
                  :name="loadError ? 'i-lucide-circle-alert' : 'i-lucide-users'"
                  class="size-8 text-muted"
                />
                <p class="text-sm font-medium text-highlighted">
                  {{ loadError ? 'User belum bisa dimuat' : 'Belum ada user' }}
                </p>
              </div>
            </template>
          </UTable>
        </div>
      </section>
    </template>
  </UDashboardPanel>

  <UModal
    v-model:open="inviteOpen"
    title="Invite User"
    description="Kirim undangan aktivasi dashboard"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <UForm
        id="invite-user-form"
        :schema="inviteSchema"
        :state="inviteState"
        class="space-y-4"
        @submit="submitInvite"
      >
        <UFormField label="Email" name="email" required>
          <UInput
            v-model="inviteState.email"
            type="email"
            autocomplete="email"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Nama" name="full_name">
          <UInput
            v-model="inviteState.full_name"
            autocomplete="name"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Role" name="role" required>
          <USelect
            v-model="inviteState.role"
            :items="roleItems"
            class="w-full"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer="{ close }">
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="close"
      />
      <UButton
        type="submit"
        form="invite-user-form"
        label="Kirim Invite"
        icon="i-lucide-send"
        :loading="isInviting"
      />
    </template>
  </UModal>

  <UModal
    v-model:open="editOpen"
    title="Edit User"
    description="Ubah nama dan role dashboard"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <UForm
        id="edit-user-form"
        :schema="editSchema"
        :state="editState"
        class="space-y-4"
        @submit="submitEdit"
      >
        <UFormField label="Nama" name="full_name">
          <UInput
            v-model="editState.full_name"
            autocomplete="name"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Role" name="role" required>
          <USelect
            v-model="editState.role"
            :items="roleItems"
            class="w-full"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer="{ close }">
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="close"
      />
      <UButton
        type="submit"
        form="edit-user-form"
        label="Simpan"
        icon="i-lucide-save"
        :loading="isSaving"
      />
    </template>
  </UModal>
  </div>
</template>
