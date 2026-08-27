<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { DetailItem, ItemDecisionStatus, PengajuanStatus } from '~/composables/usePengajuanDetail'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth-guard', 'role-guard']
})

const PENGAJUAN_STATUSES = ['Baru', 'Disetujui', 'Ditolak', 'Diprint', 'Dikirim', 'Selesai'] as const
const LIFECYCLE_ORDER = ['Baru', 'Disetujui', 'Diprint', 'Dikirim', 'Selesai'] as const
const EMPTY_ITEM_DECISION_VALUE = '__belum_diputuskan__' as const
const PENGAJUAN_SELESAI_NOTE = 'Kartu garansi sudah diterima dan pengajuan selesai.'

type StatusColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
type ItemDecisionSelectValue = ItemDecisionStatus | typeof EMPTY_ITEM_DECISION_VALUE

const PENGAJUAN_STATUS_COLORS = {
  Baru: 'info',
  Disetujui: 'success',
  Ditolak: 'error',
  Diprint: 'warning',
  Dikirim: 'primary',
  Selesai: 'neutral'
} satisfies Record<PengajuanStatus, StatusColor>

type RiwayatStatus = {
  timestamp?: string
  noItem?: number | string
  statusLama?: string
  statusBaru?: string
  catatanAdmin?: string
  user?: string
}

type ItemDecisionForm = {
  keputusanItem: ItemDecisionStatus
  catatanAdmin: string
  isSubmitting: boolean
  error: string
  notice: string
}

type PengajuanStatusForm = {
  statusBaru: PengajuanStatus
  catatanAdmin: string
  isSubmitting: boolean
  error: string
  notice: string
}

type ConfirmDialogOptions = {
  title?: string
  description: string
  confirmLabel?: string
  confirmColor?: StatusColor
  onConfirm: () => Promise<void>
}

type InfoField = {
  label: string
  value: string
  href?: string
  mono?: boolean
}

type EvidenceAttachmentLink = {
  id: string
  url: string
  label: string
  thumbnailUrl: string
  previewUrl: string
  downloadUrl: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { isAdmin, isQrcc } = useUserProfile()

const idPengajuan = computed(() => normalizeRouteParam(route.params.idPengajuan))

// Detail data + cache via composable. Reaktif terhadap perubahan route param.
const {
  detail,
  error: queryError,
  isLoading,
  load,
  setItemDecision,
  setPengajuanStatus
} = usePengajuanDetail(() => idPengajuan.value)

const loadError = computed(() => queryError.value || '')

const itemForms = ref<Record<string, ItemDecisionForm>>({})
const pengajuanForm = reactive<PengajuanStatusForm>({
  statusBaru: 'Baru',
  catatanAdmin: '',
  isSubmitting: false,
  error: '',
  notice: ''
})
const showConfirmDialog = ref(false)
const confirmDialog = reactive({
  title: 'Konfirmasi',
  description: '',
  confirmLabel: 'Ya, Lanjutkan',
  confirmColor: 'primary' as StatusColor,
  isSubmitting: false
})
const pendingConfirmAction = ref<(() => Promise<void>) | null>(null)
const selectedEvidenceAttachment = ref<EvidenceAttachmentLink | null>(null)
const showEvidencePreview = ref(false)

const pengajuanStatusOptions = PENGAJUAN_STATUSES.map((status) => ({
  label: status,
  value: status
}))

const itemDecisionItems: Array<{ label: string, value: ItemDecisionSelectValue }> = [{
  label: 'Belum Diputuskan',
  value: EMPTY_ITEM_DECISION_VALUE
}, {
  label: 'Disetujui',
  value: 'Disetujui'
}, {
  label: 'Ditolak',
  value: 'Ditolak'
}]

const canReviewItems = computed(() => isAdmin.value || isQrcc.value)

const hasUnverifiedItems = computed(() => {
  return (detail.value?.items || []).some((item) => !isProductVerified(item.produkStatus))
})

const evidenceAttachmentLinks = computed<EvidenceAttachmentLink[]>(() => {
  const ids = detail.value?.evidenceAttachmentIds || []

  return (detail.value?.evidenceAttachmentUrls || []).map((url, index) => {
    const id = ids[index] || extractDriveFileId(url)

    return {
      id,
      url,
      label: `Foto Bukti ${index + 1}`,
      thumbnailUrl: getEvidenceImageUrl(url, id, 480),
      previewUrl: getEvidenceImageUrl(url, id, 1600),
      downloadUrl: id ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}` : url
    }
  })
})

const infoFields = computed<InfoField[]>(() => {
  if (!detail.value) return []

  return [{
    label: 'Nama',
    value: detail.value.nama || '-'
  }, {
    label: 'Bagian/Cabang',
    value: detail.value.bagianCabang || '-'
  }, {
    label: 'Pemilik',
    value: detail.value.pemilik || '-'
  }, {
    label: 'Alasan Pengajuan',
    value: detail.value.alasanPengajuan || '-'
  }, {
    label: 'Catatan Tambahan',
    value: detail.value.catatanTambahan || '-'
  }]
})

const historyColumns: TableColumn<RiwayatStatus>[] = [{
  accessorKey: 'timestamp',
  header: 'Waktu',
  cell: ({ row }) => h('span', { class: 'text-muted' }, formatDateTime(row.original.timestamp))
}, {
  accessorKey: 'noItem',
  header: 'No Item',
  cell: ({ row }) => h('span', { class: 'font-medium text-muted' }, row.original.noItem ? `#${row.original.noItem}` : '-')
}, {
  id: 'transition',
  header: 'Status Lama → Baru',
  cell: ({ row }) => h('span', { class: 'font-medium text-highlighted' }, `${row.original.statusLama || '-'} → ${row.original.statusBaru || '-'}`)
}, {
  accessorKey: 'catatanAdmin',
  header: 'Catatan',
  cell: ({ row }) => h('span', { class: 'text-toned' }, row.original.catatanAdmin || '-')
}, {
  accessorKey: 'user',
  header: 'Admin',
  cell: ({ row }) => h('span', { class: 'text-toned' }, row.original.user || '-')
}]

// Inisialisasi form per-item ketika detail pertama kali dimuat (atau berubah).
watch(detail, (next) => {
  if (!next) return
  pengajuanForm.statusBaru = isPengajuanStatus(next.status) ? next.status : 'Baru'
  pengajuanForm.catatanAdmin = next.catatanAdmin || ''
  pengajuanForm.error = ''
  pengajuanForm.notice = ''
  if (next.items) initItemForms(next.items)
}, { immediate: true })

watch(() => pengajuanForm.statusBaru, (next) => {
  if (next !== 'Selesai') return
  if (detail.value?.status === 'Selesai') return

  pengajuanForm.catatanAdmin = PENGAJUAN_SELESAI_NOTE
})

onMounted(() => {
  load()
})

// Pantau error dari composable untuk handle 401.
watch(queryError, async (msg) => {
  if (msg && (msg.includes('Unauthorized') || msg.includes('Token admin'))) {
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_nama')
    sessionStorage.removeItem('admin_username')
    await router.push('/login')
  }
})

watch(showConfirmDialog, (open) => {
  if (!open && !confirmDialog.isSubmitting) {
    pendingConfirmAction.value = null
  }
})

function initItemForms(items: DetailItem[]) {
  const nextForms: Record<string, ItemDecisionForm> = {}

  items.forEach((item) => {
    const key = getItemKey(item)
    nextForms[key] = {
      keputusanItem: getItemDecision(item),
      catatanAdmin: item.catatanAdminItem || '',
      isSubmitting: false,
      error: '',
      notice: ''
    }
  })

  itemForms.value = nextForms
}

async function submitItemDecision(item: DetailItem) {
  if (!detail.value) return

  const key = getItemKey(item)
  const form = itemForms.value[key]
  if (!form) return
  const statusForm = form

  statusForm.error = ''
  statusForm.notice = ''

  const keputusanBaru = statusForm.keputusanItem
  const catatanAdmin = statusForm.catatanAdmin.trim()
  const keputusanLama = getItemDecision(item)
  const catatanLama = String(item.catatanAdminItem || '').trim()
  const noItem = item.noItem

  if (!noItem) {
    statusForm.error = 'No Item tidak valid.'
    return
  }
  const itemNo = noItem

  if (!isItemDecisionStatus(keputusanBaru)) {
    statusForm.error = 'Keputusan item tidak valid.'
    return
  }

  if (keputusanBaru === keputusanLama && catatanAdmin === catatanLama) {
    toast.add({
        title: 'Keputusan item tidak berubah',
        description: 'Tidak ada perubahan untuk disimpan.',
        color: 'info',
        icon: 'i-lucide-info'
      })
    return
  }

  if (keputusanBaru === 'Ditolak' && !catatanAdmin) {
    statusForm.error = 'Catatan Admin wajib diisi jika keputusan Ditolak.'
    return
  }

  async function saveItemDecision() {
    statusForm.isSubmitting = true

    try {
      await setItemDecision(itemNo, keputusanBaru, catatanAdmin)

      toast.add({
        title: 'Keputusan item berhasil disimpan',
        description: `Item #${itemNo} diperbarui menjadi ${getItemDecisionLabel(keputusanBaru)}.`,
        color: 'success',
        icon: 'i-lucide-circle-check'
      })

      statusForm.notice = 'Tersimpan.'
    } catch (err) {
      statusForm.error = err instanceof Error ? err.message : String(err)
    } finally {
      statusForm.isSubmitting = false
    }
  }

  const confirmMessage = getDecisionConfirmMessage(keputusanLama, keputusanBaru, itemNo)
  if (confirmMessage) {
    openConfirmDialog({
      title: 'Konfirmasi Keputusan Item',
      description: confirmMessage,
      confirmColor: keputusanBaru === 'Ditolak' ? 'error' : 'primary',
      onConfirm: saveItemDecision
    })
    return
  }

  await saveItemDecision()
}

async function submitPengajuanStatus() {
  if (!detail.value) return

  pengajuanForm.error = ''
  pengajuanForm.notice = ''

  const statusBaru = pengajuanForm.statusBaru
  const catatanAdmin = pengajuanForm.catatanAdmin.trim()
  const statusLama = detail.value.status

  if (!isPengajuanStatus(statusBaru)) {
    pengajuanForm.error = 'Status pengajuan tidak valid.'
    return
  }

  if (statusBaru === statusLama) {
    pengajuanForm.notice = 'Tidak ada perubahan status pengajuan untuk disimpan.'
    return
  }

  if (requiresPengajuanStatusNote(statusLama, statusBaru) && !catatanAdmin) {
    pengajuanForm.error = 'Catatan Admin wajib diisi untuk perubahan status ini.'
    return
  }

  async function savePengajuanStatus() {
    try {
      pengajuanForm.isSubmitting = true
      await setPengajuanStatus(statusBaru, catatanAdmin)
      toast.add({
        title: 'Status pengajuan berhasil disimpan',
        description: `Pengajuan diperbarui menjadi ${statusBaru}.`,
        color: 'success',
        icon: 'i-lucide-circle-check'
      })
      pengajuanForm.notice = 'Tersimpan.'
    } catch (err) {
      pengajuanForm.error = err instanceof Error ? err.message : String(err)
    } finally {
      pengajuanForm.isSubmitting = false
    }
  }

  const confirmMessage = getPengajuanTransitionConfirmMessage(statusLama, statusBaru)
  if (confirmMessage) {
    openConfirmDialog({
      title: 'Konfirmasi Status Pengajuan',
      description: confirmMessage,
      confirmColor: statusBaru === 'Ditolak' ? 'error' : 'primary',
      onConfirm: savePengajuanStatus
    })
    return
  }

  await savePengajuanStatus()
}

function openConfirmDialog(options: ConfirmDialogOptions) {
  confirmDialog.title = options.title || 'Konfirmasi'
  confirmDialog.description = options.description
  confirmDialog.confirmLabel = options.confirmLabel || 'Ya, Lanjutkan'
  confirmDialog.confirmColor = options.confirmColor || 'primary'
  pendingConfirmAction.value = options.onConfirm
  showConfirmDialog.value = true
}

function cancelConfirmDialog() {
  if (confirmDialog.isSubmitting) return
  showConfirmDialog.value = false
  pendingConfirmAction.value = null
}

function openEvidencePreview(attachment: EvidenceAttachmentLink) {
  selectedEvidenceAttachment.value = attachment
  showEvidencePreview.value = true
}

async function confirmPendingAction() {
  const action = pendingConfirmAction.value
  if (!action) {
    cancelConfirmDialog()
    return
  }

  confirmDialog.isSubmitting = true
  try {
    await action()
    showConfirmDialog.value = false
    pendingConfirmAction.value = null
  } finally {
    confirmDialog.isSubmitting = false
  }
}

function getItemKey(item: DetailItem) {
  return String(item.noItem || '')
}

function getItemForm(item: DetailItem) {
  const key = getItemKey(item)
  if (!itemForms.value[key]) {
    itemForms.value[key] = {
      keputusanItem: getItemDecision(item),
      catatanAdmin: item.catatanAdminItem || '',
      isSubmitting: false,
      error: '',
      notice: ''
    }
  }

  return itemForms.value[key] as ItemDecisionForm
}

function getItemDecision(item: DetailItem): ItemDecisionStatus {
  const decision = String(item.keputusanItem || '').trim()
  if (decision === 'Disetujui' || decision === 'Ditolak') return decision
  return ''
}

function getItemDecisionLabel(decision: ItemDecisionStatus) {
  return decision || 'Belum Diputuskan'
}

function getItemDecisionSelectValue(decision: ItemDecisionStatus): ItemDecisionSelectValue {
  return decision || EMPTY_ITEM_DECISION_VALUE
}

function setItemDecisionSelectValue(item: DetailItem, value: unknown) {
  const selectedValue = typeof value === 'string' ? value : ''
  const decision = selectedValue === EMPTY_ITEM_DECISION_VALUE ? '' : selectedValue
  getItemForm(item).keputusanItem = isItemDecisionStatus(decision) ? decision : ''
}

function getItemDecisionColor(decision: ItemDecisionStatus): StatusColor {
  if (decision === 'Disetujui') return 'success'
  if (decision === 'Ditolak') return 'error'
  return 'neutral'
}

function getDecisionConfirmMessage(currentDecision: ItemDecisionStatus, nextDecision: ItemDecisionStatus, noItem: number | string) {
  if (currentDecision === 'Disetujui' && nextDecision === 'Ditolak') {
    return `Item #${noItem} sudah disetujui. Yakin ingin mengubah keputusannya menjadi Ditolak?`
  }

  if (currentDecision === 'Ditolak' && nextDecision === 'Disetujui') {
    return `Item #${noItem} sebelumnya ditolak. Yakin ingin menyetujuinya?`
  }

  if (currentDecision && !nextDecision) {
    return `Kosongkan keputusan item #${noItem}? Item akan kembali ke Menunggu Review.`
  }

  if (nextDecision === 'Ditolak') {
    return `Tolak item #${noItem}? Pastikan catatan admin sudah menjelaskan alasannya.`
  }

  return ''
}

function normalizeRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function isPengajuanStatus(status: string): status is PengajuanStatus {
  return PENGAJUAN_STATUSES.includes(status as PengajuanStatus)
}

function isItemDecisionStatus(status: string): status is ItemDecisionStatus {
  return status === '' || status === 'Disetujui' || status === 'Ditolak'
}

function isProductVerified(status: string | undefined) {
  return String(status || '').trim().toLowerCase() === 'verified'
}

function getStatusColor(status: string): StatusColor {
  return isPengajuanStatus(status) ? PENGAJUAN_STATUS_COLORS[status] : 'neutral'
}

function getLifecycleRank(status: string) {
  return LIFECYCLE_ORDER.indexOf(status as typeof LIFECYCLE_ORDER[number])
}

function isBackwardPengajuanTransition(currentStatus: string, nextStatus: string) {
  const currentRank = getLifecycleRank(currentStatus)
  const nextRank = getLifecycleRank(nextStatus)
  return currentRank !== -1 && nextRank !== -1 && nextRank < currentRank
}

function requiresPengajuanStatusNote(currentStatus: string, nextStatus: string) {
  return nextStatus === 'Ditolak'
    || isBackwardPengajuanTransition(currentStatus, nextStatus)
    || (nextStatus === 'Selesai' && currentStatus !== 'Dikirim')
}

function getPengajuanTransitionConfirmMessage(currentStatus: string, nextStatus: string) {
  if (isBackwardPengajuanTransition(currentStatus, nextStatus)) {
    return `Status akan mundur dari ${currentStatus} ke ${nextStatus}. Lanjutkan?`
  }
  if (nextStatus === 'Ditolak') return 'Tolak pengajuan ini? Pastikan catatan admin sudah menjelaskan alasannya.'
  if (nextStatus === 'Selesai') return 'Tandai kartu garansi sudah diterima dan proses selesai?'
  return ''
}

function getEvidenceImageUrl(url: string, fileId: string, size: number) {
  if (!fileId) return url

  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`
}

function extractDriveFileId(url: string) {
  const match = String(url || '').match(/\/d\/([^/]+)|[?&]id=([^&]+)/)
  return match?.[1] || match?.[2] || ''
}

function formatDateTime(value: string | undefined) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

</script>

<template>
  <UDashboardPanel id="pengajuan-detail">
    <template #header>
      <UDashboardNavbar :title="detail ? `Detail ${detail.idPengajuan}` : 'Detail Pengajuan'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Kembali ke Home"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/dashboard"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-7xl px-2 py-4">

        <!-- Error state -->
        <UAlert
          v-if="loadError && !isLoading"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Gagal Memuat Data"
          :description="loadError"
          class="mb-6 rounded-xl"
        />

        <!-- Loading skeleton -->
        <div v-if="isLoading && !detail" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-8 space-y-6">
            <USkeleton class="h-32 rounded-2xl" />
            <USkeleton class="h-64 rounded-2xl" />
          </div>
          <div class="lg:col-span-4 space-y-6">
            <USkeleton class="h-48 rounded-2xl" />
            <USkeleton class="h-96 rounded-2xl" />
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="!detail"
          class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-muted bg-elevated/10 px-4 py-24 text-center"
        >
          <UIcon name="i-lucide-search-x" class="mb-4 size-12 text-muted" />
          <h3 class="text-lg font-semibold text-highlighted">Data Tidak Ditemukan</h3>
          <p class="mt-2 text-sm text-muted">ID Pengajuan mungkin salah atau telah dihapus.</p>
          <UButton label="Kembali" icon="i-lucide-arrow-left" color="primary" variant="soft" to="/dashboard" class="mt-6" />
        </div>

        <!-- Main Layout (Split Sidebar) -->
        <div v-else class="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          
          <!-- KIRI: Konten Utama (Hero, Items, History) -->
          <div class="space-y-6 lg:col-span-8">
            
            <!-- Hero Section -->
            <div class="rounded-2xl border border-primary/20 bg-green-50 px-6 py-5 shadow-sm">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div class="flex items-center gap-3">
                    <h1 class="font-mono text-2xl font-bold tracking-tight text-highlighted">
                      {{ detail.idPengajuan }}
                    </h1>
                    <UBadge
                      :color="getStatusColor(detail.status)"
                      variant="soft"
                      :label="detail.status"
                      class="px-2.5 py-1 text-xs font-bold uppercase tracking-wider"
                    />
                  </div>
                  <p class="mt-1 text-sm text-muted">
                    Disubmit oleh <span class="font-medium text-highlighted">{{ detail.nama || '-' }}</span> pada {{ formatDateTime(detail.timestampSubmit) }}
                  </p>
                </div>
                <div v-if="detail.fileHardCopyUrl">
                  <UButton
                    label="Buka File"
                    icon="i-lucide-file-text"
                    trailing-icon="i-lucide-arrow-up-right"
                    color="primary"
                    variant="solid"
                    :to="detail.fileHardCopyUrl"
                    target="_blank"
                  />
                </div>
              </div>
            </div>

            <!-- Daftar Item -->
            <UCard class="rounded-2xl shadow-sm" :ui="{ body: 'p-0 sm:p-0' }">
              <template #header>
                <div class="flex items-center justify-between px-2">
                  <h2 class="text-base font-semibold text-highlighted flex items-center gap-2">
                    <UIcon name="i-lucide-package" class="text-primary" />
                    Daftar Item Pengajuan
                  </h2>
                  <span class="text-sm font-medium text-muted bg-muted/20 px-2 py-1 rounded-md">
                    Total: {{ detail.jumlahItem || 0 }}
                  </span>
                </div>
              </template>

              <div class="p-4">
                <UAlert
                  v-if="hasUnverifiedItems"
                  color="warning"
                  variant="soft"
                  icon="i-lucide-triangle-alert"
                  title="Perhatian"
                  description="Beberapa item belum diverifikasi dan tidak akan masuk antrean cetak."
                />
              </div>

              <div class="space-y-4 border-t border-muted/50 p-4">
                <div v-if="!(detail.items || []).length" class="flex flex-col items-center py-12 text-center">
                  <UIcon name="i-lucide-box" class="mb-3 size-10 text-muted/50" />
                  <p class="text-sm text-muted">Tidak ada data item.</p>
                </div>

                <div
                  v-for="item in detail.items || []"
                  :key="getItemKey(item)"
                  class="rounded-2xl border border-muted/60 bg-default p-4 shadow-sm"
                >
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-mono text-sm font-semibold text-muted">Item #{{ item.noItem || '-' }}</span>
                        <UBadge
                          :color="getItemDecisionColor(getItemDecision(item))"
                          variant="outline"
                          :label="`Keputusan: ${getItemDecisionLabel(getItemDecision(item))}`"
                          class="font-semibold"
                        />
                        <UBadge
                          :color="isProductVerified(item.produkStatus) ? 'success' : 'warning'"
                          variant="subtle"
                          :label="isProductVerified(item.produkStatus) ? 'Verified' : 'Belum Verified'"
                          class="font-semibold"
                        />
                      </div>
                      <p class="mt-2 text-sm font-semibold text-highlighted">{{ item.produk || '-' }}</p>
                      <p class="text-sm text-toned">Model: {{ item.model || '-' }}</p>
                      <p class="font-mono text-sm text-toned">Nomor Seri: {{ item.nomorSeri || '-' }}</p>
                    </div>

                    <div v-if="item.tanggalUpdateKeputusanItem" class="text-xs text-muted sm:text-right">
                      <div>Update terakhir: {{ formatDateTime(item.tanggalUpdateKeputusanItem) }}</div>
                      <div>oleh {{ item.userUpdateKeputusanItem || '-' }}</div>
                    </div>
                  </div>

                  <UAlert
                    v-if="!isProductVerified(item.produkStatus)"
                    color="warning"
                    variant="soft"
                    icon="i-lucide-triangle-alert"
                    description="Item ini belum terverifikasi dan belum masuk antrean cetak."
                    class="mt-4"
                  />

                  <UAlert
                    v-if="getItemForm(item).notice"
                    color="info"
                    variant="subtle"
                    :description="getItemForm(item).notice"
                    class="mt-4 text-xs"
                  />
                  <UAlert
                    v-if="getItemForm(item).error"
                    color="error"
                    variant="subtle"
                    :description="getItemForm(item).error"
                    class="mt-4 text-xs"
                  />

                  <form
                    v-if="canReviewItems"
                    class="mt-4 flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:gap-6"
                    @submit.prevent="submitItemDecision(item)"
                  >
                    <UFormField label="Keputusan Item" :name="`keputusan-${getItemKey(item)}`" class="w-full lg:w-44">
                      <USelect
                        :model-value="getItemDecisionSelectValue(getItemForm(item).keputusanItem)"
                        :items="itemDecisionItems"
                        class="w-full"
                        :disabled="getItemForm(item).isSubmitting"
                        @update:model-value="setItemDecisionSelectValue(item, $event)"
                      />
                    </UFormField>

                    <UFormField label="Catatan Admin" :name="`catatan-${getItemKey(item)}`" class="w-full flex-1">
                      <UTextarea
                        v-model="getItemForm(item).catatanAdmin"
                        :rows="2"
                        placeholder="Alasan penolakan / catatan item..."
                        class="w-full"
                      />
                    </UFormField>

                    <UButton
                      type="submit"
                      label="Simpan Keputusan"
                      icon="i-lucide-check"
                      color="primary"
                      class="h-8 w-full flex-none self-start lg:mt-6 lg:w-auto"
                      :loading="getItemForm(item).isSubmitting"
                      :disabled="getItemForm(item).isSubmitting"
                    />
                  </form>
                </div>
              </div>
            </UCard>

            <!-- Lampiran Foto Bukti -->
            <UCard v-if="evidenceAttachmentLinks.length" class="rounded-2xl">
              <template #header>
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 class="flex items-center gap-2 text-base font-semibold text-highlighted">
                    <UIcon name="i-lucide-images" class="text-primary" />
                    Lampiran Foto Bukti
                  </h2>
                  <UBadge
                    color="info"
                    variant="soft"
                    :label="`${evidenceAttachmentLinks.length} foto`"
                    class="w-fit font-semibold"
                  />
                </div>
              </template>

              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                <button
                  v-for="link in evidenceAttachmentLinks"
                  :key="link.url"
                  type="button"
                  class="group relative overflow-hidden rounded-xl border border-muted/60 bg-muted/20 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30"
                  @click="openEvidencePreview(link)"
                >
                  <div class="aspect-square overflow-hidden bg-muted/40">
                    <img
                      :src="link.thumbnailUrl"
                      :alt="link.label"
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    >
                  </div>
                  <div class="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                    <UIcon name="i-lucide-zoom-in" class="size-7 text-white" />
                  </div>
                  <div class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-2">
                    <span class="block truncate text-xs font-semibold text-white">{{ link.label }}</span>
                  </div>
                </button>
              </div>
            </UCard>


            <!-- Riwayat Status -->
            <UCard class="rounded-2xl shadow-sm" :ui="{ body: 'p-0 sm:p-0' }">
              <template #header>
                <h2 class="text-base font-semibold text-highlighted flex items-center gap-2 px-2">
                  <UIcon name="i-lucide-history" class="text-primary" />
                  Riwayat Perubahan Status
                </h2>
              </template>
              
              <UTable
                :data="detail.riwayat || []"
                :columns="historyColumns"
                class="w-full border-t border-muted/50"
              >
                <template #empty>
                  <div class="p-8 text-center text-sm text-muted">
                    Belum ada riwayat perubahan status tercatat.
                  </div>
                </template>
              </UTable>
            </UCard>

           
          </div>

          <!-- KANAN: Form Aksi & Info Detail (Sidebar) -->
          <div class="space-y-6 lg:col-span-4 lg:sticky lg:top-4">
            
            <!-- Ringkasan Status Panel -->
            <UCard class="rounded-2xl border-primary/20 bg-primary/5 shadow-sm ring-1 ring-primary/20">
              <template #header>
                <h2 class="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <UIcon name="i-lucide-zap" />
                  Ringkasan Status
                </h2>
              </template>

              <div class="space-y-4 text-sm">
                <div>
                  <span class="text-muted block mb-1">Status Pengajuan:</span>
                  <UBadge
                    :color="getStatusColor(detail.status)"
                    variant="soft"
                    :label="detail.status"
                    class="font-semibold"
                  />
                  <p class="mt-2 text-xs text-muted">
                    Status ini adalah lifecycle utama pengajuan. Keputusan pada daftar item khusus untuk approval item.
                  </p>
                </div>

                <form class="space-y-3 border-t border-muted/40 pt-3" @submit.prevent="submitPengajuanStatus">
                  <UAlert
                    v-if="pengajuanForm.notice"
                    color="info"
                    variant="subtle"
                    :description="pengajuanForm.notice"
                    class="text-xs"
                  />
                  <UAlert
                    v-if="pengajuanForm.error"
                    color="error"
                    variant="subtle"
                    :description="pengajuanForm.error"
                    class="text-xs"
                  />

                  <UFormField label="Ubah Status Pengajuan" name="status-pengajuan">
                    <USelect
                      v-model="pengajuanForm.statusBaru"
                      :items="pengajuanStatusOptions"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Catatan Admin" name="catatan-pengajuan">
                    <UTextarea
                      v-model="pengajuanForm.catatanAdmin"
                      :rows="3"
                      placeholder="Wajib untuk Ditolak, transisi mundur, atau pengecualian alur..."
                      class="w-full"
                    />
                  </UFormField>

                  <UButton
                    type="submit"
                    label="Simpan Pengajuan"
                    icon="i-lucide-save"
                    color="primary"
                    class="w-full justify-center"
                    :loading="pengajuanForm.isSubmitting"
                    :disabled="pengajuanForm.isSubmitting"
                  />
                </form>

                <div class="border-t border-muted/40 pt-3">
                  <span class="text-muted block mb-1">Update Terakhir:</span>
                  <div class="font-medium text-highlighted">
                    {{ formatDateTime(detail.tanggalUpdateStatusTerakhir) }}
                    <span class="text-muted font-normal block text-xs mt-0.5">oleh {{ detail.userUpdateStatus || '-' }}</span>
                  </div>
                </div>
              </div>
            </UCard>

            <!-- Informasi Lengkap List -->
            <UCard class="rounded-2xl shadow-sm">
              <template #header>
                <h2 class="text-base font-semibold text-highlighted flex items-center gap-2">
                  <UIcon name="i-lucide-info" class="text-primary" />
                  Informasi Detail
                </h2>
              </template>
              
              <div class="divide-y divide-muted/40">
                <div 
                  v-for="field in infoFields" 
                  :key="field.label" 
                  class="py-3 first:pt-0 last:pb-0 flex flex-col gap-1"
                >
                  <span class="text-xs font-medium text-muted uppercase tracking-wide">{{ field.label }}</span>
                  
                  <UButton
                    v-if="field.href"
                    :to="field.href"
                    target="_blank"
                    color="primary"
                    variant="link"
                    class="p-0 justify-start h-auto font-medium"
                  >
                    {{ field.value }} <UIcon name="i-lucide-external-link" class="ml-1 size-3" />
                  </UButton>
                  
                  <span 
                    v-else 
                    class="text-sm text-highlighted"
                    :class="field.mono ? 'font-mono' : 'font-medium'"
                  >
                    {{ field.value }}
                  </span>
                </div>
              </div>
            </UCard>

          </div>
        </div>
      </div>

      <UModal
        v-model:open="showEvidencePreview"
        :title="selectedEvidenceAttachment?.label || 'Foto Bukti'"
        fullscreen
        :ui="{ body: 'p-0 sm:p-0', footer: 'justify-end' }"
      >
        <template #body>
          <div class="flex min-h-[70vh] items-center justify-center bg-black p-4 sm:p-6">
            <img
              v-if="selectedEvidenceAttachment"
              :src="selectedEvidenceAttachment.previewUrl"
              :alt="selectedEvidenceAttachment.label"
              class="max-h-[calc(100vh-12rem)] max-w-full rounded-lg object-contain shadow-2xl"
            >
          </div>
        </template>

        <template #footer>
          <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <UButton
              v-if="selectedEvidenceAttachment"
              label="Unduh"
              icon="i-lucide-download"
              color="primary"
              :to="selectedEvidenceAttachment.downloadUrl"
              target="_blank"
            />
            <UButton
              v-if="selectedEvidenceAttachment"
              label="Buka File"
              icon="i-lucide-external-link"
              color="neutral"
              variant="outline"
              :to="selectedEvidenceAttachment.url"
              target="_blank"
            />
          </div>
        </template>
      </UModal>

      <UModal
        v-model:open="showConfirmDialog"
        :title="confirmDialog.title"
        :description="confirmDialog.description"
        :ui="{ footer: 'justify-end' }"
      >
        <template #footer>
          <UButton
            type="button"
            label="Cancel"
            color="neutral"
            variant="outline"
            :disabled="confirmDialog.isSubmitting"
            @click="cancelConfirmDialog"
          />
          <UButton
            type="button"
            :label="confirmDialog.confirmLabel"
            :color="confirmDialog.confirmColor"
            :loading="confirmDialog.isSubmitting"
            @click="confirmPendingAction"
          />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
