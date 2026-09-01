<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { AdminPengajuanPatch, DetailPengajuan } from '~/composables/usePengajuanDetail'

definePageMeta({
  middleware: ['auth-guard', 'role-guard']
})

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UCheckbox = resolveComponent('UCheckbox')

type DashboardStatus = 'Baru' | 'Disetujui' | 'Ditolak' | 'Diprint' | 'Dikirim' | 'Selesai'
type DashboardItemDecision = 'Disetujui' | 'Ditolak' | ''
type DashboardItemDecisionFilter = 'all' | 'pending' | Exclude<DashboardItemDecision, ''>

type DashboardPengajuanSourceRow = {
  idPengajuan: string
  timestampSubmit: string
  nama: string
  bagianCabang: string
  pemilik?: string
  alasanPengajuan?: string
  tanggalForm?: string
  catatanTambahan?: string
  jumlahItem: number | string
  status: DashboardStatus | string
  items?: Array<{
    noItem: number | string
    model?: string
    nomorSeri?: string
    keputusanItem?: DashboardItemDecision | string
  }>
}

type DashboardPengajuanRow = {
  key: string
  nomor?: number
  idPengajuan: string
  noItem: number | string
  timestampSubmit: string
  nama: string
  model: string
  nomorSeri: string
  bagianCabang: string
  jumlahItem: number | string
  keputusanItem: DashboardItemDecision | string
  pengajuanStatus: DashboardStatus | string
}

type EditPengajuanForm = AdminPengajuanPatch

const PENGAJUAN_SELESAI_NOTE = 'Kartu garansi sudah diterima dan pengajuan selesai.'

const router = useRouter()
const toast = useToast()
const { callAdminBff } = useAdminBffApi()
const { isAdmin } = useUserProfile()
const { updatePengajuan, deletePengajuan, completePengajuanBulk } = usePengajuanAdminMutations()
const { source: dashboardSource } = useDashboardDataSource()
const isArchiveView = computed(() => dashboardSource.value === 'archive')
const canMutatePengajuan = computed(() => isAdmin.value && !isArchiveView.value)
const currentPage = ref(1)
const itemsPerPage = ref(15)
const globalFilter = ref('')
const serverSearch = ref('')
const decisionFilter = ref<DashboardItemDecisionFilter>('all')
const rowSelection = ref<Record<string, boolean>>({})
const isLoadAllMode = ref(false)
const selectedPengajuan = ref<DashboardPengajuanSourceRow | null>(null)
const editPengajuanOpen = ref(false)
const deletePengajuanOpen = ref(false)
const completePengajuanOpen = ref(false)
const isEditPrefillLoading = ref(false)
const isSavingPengajuan = ref(false)
const isDeletingPengajuan = ref(false)
const isCompletingPengajuan = ref(false)
const editPengajuanError = ref('')
const deletePengajuanError = ref('')
const completePengajuanError = ref('')
const completePengajuanTargetIds = ref<string[]>([])
const completePengajuanNote = ref(PENGAJUAN_SELESAI_NOTE)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const editPengajuanForm = reactive<EditPengajuanForm>({
  nama: '',
  bagianCabang: '',
  pemilik: '',
  alasanPengajuan: '',
  tanggalForm: '',
  catatanTambahan: ''
})

const listParams = computed(() => ({
  page: currentPage.value,
  pageSize: itemsPerPage.value,
  search: serverSearch.value,
  itemDecision: decisionFilter.value,
  sortBy: 'timestampSubmit',
  sortDirection: 'desc' as const
}))

const {
  rows: serverRows,
  isLoading: isServerLoading,
  isRefreshing: isServerRefreshing,
  error: serverError,
  ensureLoaded,
  refresh,
  loadedRows: serverLoadedRows,
  totalRows: serverTotalRows,
  pageSize: serverPageSize
} = usePengajuanListData(listParams, dashboardSource)
const {
  rows: loadAllRows,
  isLoading: isLoadAllLoading,
  isRefreshing: isLoadAllRefreshing,
  error: loadAllError,
  ensureLoaded: ensureLoadAllLoaded,
  refresh: refreshLoadAll,
  loadedRows: loadedLoadAllRows,
  totalRows: totalLoadAllRows
} = useDashboardData({ loadAll: true, source: dashboardSource })

const loadAllBusy = computed(() => isLoadAllLoading.value || isLoadAllRefreshing.value)
const filteredLoadAllRows = computed<DashboardPengajuanSourceRow[]>(() => (loadAllRows.value as DashboardPengajuanSourceRow[])
  .filter((row) => matchesLoadAllSearch(row, globalFilter.value))
  .filter((row) => parentMatchesDecisionFilter(row, decisionFilter.value)))
const visibleLoadAllRows = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredLoadAllRows.value.slice(start, start + itemsPerPage.value)
})
const rows = computed<DashboardPengajuanSourceRow[]>(() => {
  if (isLoadAllMode.value) return visibleLoadAllRows.value
  return serverRows.value as DashboardPengajuanSourceRow[]
})
const isLoading = computed(() => {
  if (isLoadAllMode.value) return isLoadAllLoading.value
  return isServerLoading.value
})
const isRefreshing = computed(() => {
  if (isLoadAllMode.value) return isLoadAllRefreshing.value
  return isServerRefreshing.value
})
const error = computed(() => {
  if (isLoadAllMode.value) return loadAllError.value
  return serverError.value
})
const loadedRows = computed(() => {
  if (isLoadAllMode.value) return loadedLoadAllRows.value
  return serverLoadedRows.value
})
const totalRows = computed(() => {
  if (isLoadAllMode.value) return filteredLoadAllRows.value.length
  return serverTotalRows.value
})
const pageSize = computed(() => {
  if (isLoadAllMode.value) return itemsPerPage.value
  return serverPageSize.value
})
const loadAllProgress = computed(() => {
  if (!totalLoadAllRows.value) return 0
  return Math.min(Math.round((loadedLoadAllRows.value / totalLoadAllRows.value) * 100), 100)
})
const loadError = computed(() => error.value || '')

const decisionFilterItems = [{
  label: 'Semua',
  value: 'all'
}, {
  label: 'Menunggu Review',
  value: 'pending'
}, {
  label: 'Disetujui',
  value: 'Disetujui'
}, {
  label: 'Ditolak',
  value: 'Ditolak'
}]

const explodedRows = computed<DashboardPengajuanRow[]>(() => {
  const out: DashboardPengajuanRow[] = []
  const source = rows.value as DashboardPengajuanSourceRow[]

  source.forEach((parent) => {
    for (const item of getDashboardItems(parent)) {
      out.push({
        key: getRowKey(parent.idPengajuan, item.noItem),
        idPengajuan: parent.idPengajuan,
        noItem: item.noItem,
        timestampSubmit: parent.timestampSubmit,
        nama: parent.nama,
        model: item.model,
        nomorSeri: item.nomorSeri,
        bagianCabang: parent.bagianCabang,
        jumlahItem: parent.jumlahItem,
        keputusanItem: item.keputusanItem,
        pengajuanStatus: parent.status
      })
    }
  })
  return out
    .filter((row) => matchesDecisionFilter(row, decisionFilter.value))
    .filter((row) => !isLoadAllMode.value || matchesLoadAllRowSearch(row, globalFilter.value))
})

const filteredPengajuanCount = computed(() => new Set(explodedRows.value.map(row => row.idPengajuan)).size)

// Tabel di-pause saat loading awal agar skeleton loading tampil utuh.
const tableRows = computed<DashboardPengajuanRow[]>(() => isLoading.value ? [] : explodedRows.value)
const selectedRows = computed(() => tableRows.value.filter(row => rowSelection.value[row.key]))
const selectedCompletePengajuanIds = computed(() => getUniquePendingPengajuanIds(selectedRows.value))
const selectedCompletedPengajuanCount = computed(() => {
  const selectedIds = new Set(selectedRows.value.map(row => row.idPengajuan).filter(Boolean))
  return Math.max(selectedIds.size - selectedCompletePengajuanIds.value.length, 0)
})
const completePengajuanTargetPreview = computed(() => {
  const ids = completePengajuanTargetIds.value
  const preview = ids.slice(0, 8).join(', ')
  return ids.length > 8 ? `${preview}, +${ids.length - 8} lainnya` : preview
})

const baseColumns: TableColumn<DashboardPengajuanRow>[] = [{
  id: 'select',
  header: ({ table }) => h(UCheckbox, {
    'modelValue': table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
    'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
    'aria-label': 'Pilih semua baris'
  }),
  cell: ({ row }) => h(UCheckbox, {
    'modelValue': row.getIsSelected(),
    'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
    'aria-label': `Pilih ${row.original.idPengajuan}`
  }),
  meta: { class: { th: 'w-12', td: 'w-12' } }
}, {
  accessorKey: 'idPengajuan',
  header: 'ID Pengajuan',
  meta: { class: { th: 'w-[16%]', td: 'w-[16%]' } },
  cell: ({ row }) => h('span', { class: 'font-mono text-sm font-semibold' }, row.original.idPengajuan)
}, {
  accessorKey: 'noItem',
  header: 'Item',
  meta: { class: { th: 'w-20', td: 'w-20' } },
  cell: ({ row }) => h('p', { class: 'text-sm' }, `Item #${row.original.noItem}`)
}, {
  accessorKey: 'timestampSubmit',
  header: 'Waktu Submit',
  meta: { class: { th: 'w-[15%]', td: 'w-[15%]' } },
  cell: ({ row }) => h('span', { class: '' }, formatSubmitTime(row.original.timestampSubmit))
}, {
  accessorKey: 'nama',
  header: 'Nama',
  meta: { class: { th: 'w-[16%]', td: 'w-[16%]' } },
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'uppercase' }, row.original.nama || '-')
  ])
}, {
  accessorKey: 'model',
  header: 'Model',
  meta: { class: { th: 'w-[14%]', td: 'w-[14%]' } },
  cell: ({ row }) => h('p', { class: '' }, row.original.model || '-')
}, {
  accessorKey: 'nomorSeri',
  header: 'Nomor Seri',
  meta: { class: { th: 'w-[16%]', td: 'w-[16%]' } },
  cell: ({ row }) => h('p', { class: '' }, row.original.nomorSeri || '-')
}, {
  accessorKey: 'bagianCabang',
  header: 'Cabang',
  meta: { class: { th: 'w-[15%]', td: 'w-[15%]' } },
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'uppercase' }, row.original.bagianCabang || '-')
  ])
}, {
  accessorKey: 'pengajuanStatus',
  header: 'Proses Kartu',
  meta: { class: { th: 'w-[12%]', td: 'w-[12%]' } },
  cell: ({ row }) => renderPengajuanProcess(row.original.pengajuanStatus)
}, {
  accessorKey: 'keputusanItem',
  header: 'Keputusan Item',
  meta: { class: { th: 'w-[12%]', td: 'w-[12%]' } },
  cell: ({ row }) => renderItemDecision(row.original.keputusanItem)
}, {
  id: 'actions',
  header: () => h('div', { class: 'text-right' }, 'Aksi'),
  meta: { class: { th: 'w-[16%]', td: 'w-[16%]' } },
  cell: ({ row }) => {
    const UTooltip = resolveComponent('UTooltip')

    const buttons = [
      h(UTooltip, {text: "View detail"}, () => 
       h(UButton, {
        icon: 'i-lucide-eye',
        color: 'neutral',
        variant: 'soft',
        size: 'sm',
        onClick: () => showDetail(row.original)
      })
    )]

    if (canMutatePengajuan.value) {
      buttons.push(
        h(UTooltip, {text: "Edit"}, () =>
          h(UButton, {
            icon: 'i-lucide-pencil',
            color: 'primary',
            variant: 'soft',
            size: 'sm',
            onClick: () => openEditPengajuan(row.original)
          })
        ),
        h(UTooltip, {text: "Delete"}, () =>
          h(UButton, {
            icon: 'i-lucide-trash-2',
            color: 'error',
            variant: 'soft',
            size: 'sm',
            onClick: () => openDeletePengajuan(row.original)
          })
        )
      )
    }

    if (canMutatePengajuan.value && row.original.pengajuanStatus === 'Dikirim') {
      buttons.push(
        h(UTooltip, {text: "Completed"}, () =>
          h(UButton, {
            icon: 'i-lucide-check-check',
            color: 'success',
            variant: 'soft',
            size: 'sm',
            disabled: isCompletingPengajuan.value,
            onClick: () => openCompletePengajuan(row.original)
          })
        )
      )
    }

    return h('div', { class: 'flex flex-wrap justify-end gap-2' }, buttons)
  }
}]

const columns = computed<TableColumn<DashboardPengajuanRow>[]>(() => {
  if (canMutatePengajuan.value) return baseColumns
  return baseColumns.filter(column => column.id !== 'select')
})

onMounted(() => {
  ensureLoaded()
})

watch(listParams, () => {
  if (isLoadAllMode.value) return
  void refresh()
})

watch(isAdmin, (allowed) => {
  if (!allowed) isLoadAllMode.value = false
}, { immediate: true })

watch(dashboardSource, () => {
  currentPage.value = 1
  rowSelection.value = {}
  selectedPengajuan.value = null
  editPengajuanOpen.value = false
  deletePengajuanOpen.value = false
  completePengajuanOpen.value = false

  if (isLoadAllMode.value) {
    ensureLoadAllLoaded()
  } else {
    ensureLoaded()
  }
})

watch(error, async (msg) => {
  if (msg && (msg.includes('Unauthorized') || msg.includes('Token admin'))) {
    await router.push('/login')
  }
})

watch(globalFilter, (value) => {
  if (isLoadAllMode.value) currentPage.value = 1
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    serverSearch.value = value
  }, 350)
})
watch(decisionFilter, () => {
  currentPage.value = 1
})

watch(tableRows, (next) => {
  const visibleKeys = new Set(next.map(row => row.key))
  rowSelection.value = Object.fromEntries(
    Object.entries(rowSelection.value).filter(([key, selected]) => selected && visibleKeys.has(key))
  )
})

function setPengajuanPage(page: number) {
  currentPage.value = page
}

function toggleLoadAllMode() {
  if (!isAdmin.value) return

  isLoadAllMode.value = !isLoadAllMode.value
  currentPage.value = 1

  if (isLoadAllMode.value) {
    ensureLoadAllLoaded()
  } else {
    void refresh()
  }
}

async function reloadLoadAll() {
  if (!isAdmin.value) return
  isLoadAllMode.value = true
  currentPage.value = 1
  await refreshLoadAll()
}

onUnmounted(() => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
})

function showDetail(row: DashboardPengajuanRow) {
  if (!row.idPengajuan) return
  const url = router.resolve({
    path: `/dashboard/pengajuan/${encodeURIComponent(row.idPengajuan)}`,
    query: dashboardSource.value === 'archive' ? { source: 'local' } : {}
  }).href
  window.open(url, '_blank')
}

async function openEditPengajuan(row: DashboardPengajuanRow) {
  if (!canMutatePengajuan.value || !row.idPengajuan) return

  const source = findPengajuanSource(row.idPengajuan)
  selectedPengajuan.value = source
  fillEditPengajuanForm(source)
  editPengajuanError.value = ''
  editPengajuanOpen.value = true
  isEditPrefillLoading.value = true

  try {
    const result = await callAdminBff<DetailPengajuan>(`/api/active/pengajuan/${encodeURIComponent(row.idPengajuan)}`)
    if (selectedPengajuan.value?.idPengajuan !== row.idPengajuan) return
    if (result) fillEditPengajuanForm(result)
  } catch (err) {
    editPengajuanError.value = err instanceof Error ? err.message : String(err)
  } finally {
    isEditPrefillLoading.value = false
  }
}

function openDeletePengajuan(row: DashboardPengajuanRow) {
  if (!canMutatePengajuan.value || !row.idPengajuan) return

  selectedPengajuan.value = findPengajuanSource(row.idPengajuan)
  deletePengajuanError.value = ''
  deletePengajuanOpen.value = true
}

function openCompletePengajuan(row: DashboardPengajuanRow) {
  if (!canMutatePengajuan.value || !row.idPengajuan || isPengajuanSelesai(row.pengajuanStatus)) return
  openCompletePengajuanByIds([row.idPengajuan])
}

function openSelectedCompletePengajuan() {
  if (!canMutatePengajuan.value || !selectedCompletePengajuanIds.value.length) return
  openCompletePengajuanByIds(selectedCompletePengajuanIds.value)
}

function openCompletePengajuanByIds(ids: string[]) {
  completePengajuanTargetIds.value = Array.from(new Set(ids.map(id => String(id || '').trim()).filter(Boolean)))
  completePengajuanNote.value = PENGAJUAN_SELESAI_NOTE
  completePengajuanError.value = ''
  completePengajuanOpen.value = true
}

async function submitEditPengajuan() {
  const idPengajuan = selectedPengajuan.value?.idPengajuan
  if (!idPengajuan || isSavingPengajuan.value || isEditPrefillLoading.value) return

  editPengajuanError.value = ''
  const payload = normalizeEditPengajuanPayload(editPengajuanForm)
  const validationError = validateEditPengajuanPayload(payload)

  if (validationError) {
    editPengajuanError.value = validationError
    return
  }

  isSavingPengajuan.value = true

  try {
    const result = await updatePengajuan(idPengajuan, payload)
    if (result?.row) selectedPengajuan.value = result.row as DashboardPengajuanSourceRow
    editPengajuanOpen.value = false
    toast.add({
      title: 'Pengajuan berhasil diperbarui',
      description: `${idPengajuan} sudah disimpan.`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (err) {
    editPengajuanError.value = err instanceof Error ? err.message : String(err)
  } finally {
    isSavingPengajuan.value = false
  }
}

async function confirmDeletePengajuan() {
  const idPengajuan = selectedPengajuan.value?.idPengajuan
  if (!idPengajuan || isDeletingPengajuan.value) return

  deletePengajuanError.value = ''
  isDeletingPengajuan.value = true

  try {
    await deletePengajuan(idPengajuan)
    deletePengajuanOpen.value = false
    toast.add({
      title: 'Pengajuan berhasil dihapus',
      description: `${idPengajuan} sudah dihapus dari daftar.`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (err) {
    deletePengajuanError.value = err instanceof Error ? err.message : String(err)
  } finally {
    isDeletingPengajuan.value = false
  }
}

async function confirmCompletePengajuan() {
  const ids = completePengajuanTargetIds.value
  if (!ids.length || isCompletingPengajuan.value) return

  completePengajuanError.value = ''
  isCompletingPengajuan.value = true

  try {
    const result = await completePengajuanBulk(ids, completePengajuanNote.value.trim() || PENGAJUAN_SELESAI_NOTE)
    const successIds = new Set((result.results || [])
      .filter(item => item.success)
      .map(item => item.idPengajuan))
    const failedIds = (result.results || [])
      .filter(item => !item.success)
      .map(item => item.idPengajuan)

    clearCompletedSelection(successIds)

    if (result.failed > 0) {
      completePengajuanTargetIds.value = failedIds
      completePengajuanError.value = `${result.updated} berhasil, ${result.failed} gagal.`
      toast.add({
        title: 'Sebagian pengajuan gagal diperbarui',
        description: completePengajuanError.value,
        color: 'warning',
        icon: 'i-lucide-triangle-alert'
      })
      return
    }

    completePengajuanOpen.value = false
    toast.add({
      title: 'Status pengajuan berhasil diperbarui',
      description: `${result.updated} pengajuan ditandai Selesai.`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (err) {
    completePengajuanError.value = err instanceof Error ? err.message : String(err)
  } finally {
    isCompletingPengajuan.value = false
  }
}

function findPengajuanSource(idPengajuan: string): DashboardPengajuanSourceRow {
  const candidates = [
    ...rows.value,
    ...(serverRows.value as DashboardPengajuanSourceRow[]),
    ...(loadAllRows.value as DashboardPengajuanSourceRow[])
  ]
  const found = candidates.find((row) => String(row.idPengajuan) === String(idPengajuan))

  return found || {
    idPengajuan,
    timestampSubmit: '',
    nama: '',
    bagianCabang: '',
    jumlahItem: 0,
    status: 'Baru',
    items: []
  }
}

function fillEditPengajuanForm(row: Partial<DashboardPengajuanSourceRow | DetailPengajuan>) {
  editPengajuanForm.nama = String(row.nama || '')
  editPengajuanForm.bagianCabang = String(row.bagianCabang || '')
  editPengajuanForm.pemilik = String(row.pemilik || '')
  editPengajuanForm.alasanPengajuan = String(row.alasanPengajuan || '')
  editPengajuanForm.tanggalForm = normalizeDateInput(row.tanggalForm)
  editPengajuanForm.catatanTambahan = String(row.catatanTambahan || '')
}

function normalizeEditPengajuanPayload(form: EditPengajuanForm): AdminPengajuanPatch {
  return {
    nama: form.nama.trim(),
    bagianCabang: form.bagianCabang.trim(),
    pemilik: form.pemilik.trim(),
    alasanPengajuan: form.alasanPengajuan.trim(),
    tanggalForm: form.tanggalForm.trim(),
    catatanTambahan: String(form.catatanTambahan || '').trim()
  }
}

function validateEditPengajuanPayload(payload: AdminPengajuanPatch) {
  if (!payload.nama) return 'Nama wajib diisi.'
  if (!payload.bagianCabang) return 'Cabang wajib diisi.'
  if (!payload.pemilik) return 'Pemilik wajib diisi.'
  if (!payload.alasanPengajuan) return 'Alasan Pengajuan wajib diisi.'
  if (!payload.tanggalForm || Number.isNaN(new Date(`${payload.tanggalForm}T00:00:00`).getTime())) {
    return 'Tanggal Form tidak valid.'
  }
  return ''
}

function normalizeDateInput(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toISOString().slice(0, 10)
}

function formatSubmitTime(value: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function renderPengajuanProcess(status: string) {
  const meta = getPengajuanProcessMeta(status)

  return h('div', { class: 'min-w-0' }, [
    h(UBadge, {
      color: meta.color,
      variant: meta.isDone ? 'solid' : 'subtle',
      label: meta.label,
      class: 'font-normal'
    })
  ])
}

function getPengajuanProcessMeta(status: string) {
  const value = String(status || '').trim()
  const meta: Record<string, {
    label: string
    description: string
    color: string
    isDone?: boolean
  }> = {
    Baru: {
      label: 'Baru',
      description: 'Belum selesai',
      color: 'info'
    },
    Disetujui: {
      label: 'Disetujui',
      description: 'Menunggu cetak',
      color: 'primary'
    },
    Ditolak: {
      label: 'Ditolak',
      description: 'Tidak diproses',
      color: 'error'
    },
    Diprint: {
      label: 'Diprint',
      description: 'Menunggu kirim',
      color: 'warning'
    },
    Dikirim: {
      label: 'Dikirim',
      description: 'Menunggu diterima',
      color: 'primary'
    },
    Selesai: {
      label: 'Selesai',
      description: 'Proses selesai',
      color: 'success',
      isDone: true
    }
  }

  return meta[value] || {
    label: value || '-',
    description: 'Belum selesai',
    color: 'neutral'
  }
}

function renderItemDecision(decision: string) {
  const normalizedDecision = normalizeItemDecision(decision)

  return h(UBadge, {
    color: getItemDecisionColor(normalizedDecision),
    variant: normalizedDecision ? 'solid' : 'subtle',
    label: getItemDecisionLabel(normalizedDecision),
    class: 'font-semibold'
  })
}

function getItemDecisionLabel(decision: string | undefined) {
  return normalizeItemDecision(decision) || 'Menunggu Review'
}

function getItemDecisionColor(decision: string) {
  const colors: Record<string, string> = {
    Disetujui: 'success',
    Ditolak: 'error',
  }
  return colors[decision] || 'neutral'
}

function matchesDecisionFilter(row: DashboardPengajuanRow, filter: DashboardItemDecisionFilter) {
  if (filter === 'all') return true
  if (filter === 'pending') return !row.keputusanItem
  return row.keputusanItem === filter
}

function parentMatchesDecisionFilter(row: DashboardPengajuanSourceRow, filter: DashboardItemDecisionFilter) {
  if (filter === 'all') return true
  return getDashboardItems(row).some((item) => {
    if (filter === 'pending') return !item.keputusanItem
    return item.keputusanItem === filter
  })
}

function matchesLoadAllSearch(row: DashboardPengajuanSourceRow, search: string) {
  const needle = normalizeSearchValue(search)
  if (!needle) return true

  const itemText = getDashboardItems(row)
    .map((item) => [
      item.noItem,
      item.model,
      item.nomorSeri,
      item.keputusanItem
    ].join(' '))
    .join(' ')

  return normalizeSearchValue([
    row.idPengajuan,
    row.timestampSubmit,
    row.nama,
    row.bagianCabang,
    row.jumlahItem,
    row.status,
    itemText
  ].join(' ')).includes(needle)
}

function matchesLoadAllRowSearch(row: DashboardPengajuanRow, search: string) {
  const needle = normalizeSearchValue(search)
  if (!needle) return true

  return normalizeSearchValue([
    row.idPengajuan,
    row.noItem,
    row.timestampSubmit,
    row.nama,
    row.model,
    row.nomorSeri,
    row.bagianCabang,
    row.jumlahItem,
    row.keputusanItem,
    row.pengajuanStatus
  ].join(' ')).includes(needle)
}

function normalizeSearchValue(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function getDashboardItems(row: DashboardPengajuanSourceRow) {
  const items = row.items || []
  if (items.length) {
    return [...items]
      .map((item, index) => ({
        noItem: item.noItem || index + 1,
        model: String(item.model || '').trim(),
        nomorSeri: String(item.nomorSeri || '').trim(),
        keputusanItem: normalizeItemDecision(item.keputusanItem)
      }))
      .sort((a, b) => Number(a.noItem) - Number(b.noItem))
  }

  const total = clampItemCount(row.jumlahItem)
  return Array.from({ length: total }, (_, index) => ({
    noItem: index + 1,
    model: '',
    nomorSeri: '',
    keputusanItem: normalizeItemDecision('')
  }))
}

function getUniquePendingPengajuanIds(sourceRows: DashboardPengajuanRow[]) {
  return Array.from(new Set(sourceRows
    .filter(row => !isPengajuanSelesai(row.pengajuanStatus))
    .map(row => row.idPengajuan)
    .filter(Boolean)))
}

function clearCompletedSelection(successIds: Set<string>) {
  rowSelection.value = Object.fromEntries(
    Object.entries(rowSelection.value).filter(([key]) => {
      const row = tableRows.value.find(item => item.key === key)
      return row && !successIds.has(row.idPengajuan)
    })
  )
}

function isPengajuanSelesai(status: string) {
  return String(status || '').trim() === 'Selesai'
}

function normalizeItemDecision(decision: string | undefined): DashboardItemDecision {
  const value = String(decision || '').trim()
  if (value === 'Disetujui' || value === 'Ditolak') return value
  return ''
}

function clampItemCount(value: number | string): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.min(Math.floor(n), 999)
}

function getRowKey(idPengajuan: string, noItem: number | string) {
  return `${idPengajuan}::${noItem}`
}
</script>

<template>
  <UDashboardPanel id="pengajuan">
    <template #header>
      <UDashboardNavbar title="Pengajuan Kartu Garansi" description="Daftar pengajuan admin" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <DashboardSourceSwitcher />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <section class="relative rounded-lg border border-muted bg-default/45 shadow-sm backdrop-blur-xl">

        <div class="min-h-0 w-full overflow-x-auto">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-accented px-4 py-3.5">
            <UInput
              v-model="globalFilter"
              class="w-full max-w-sm"
              icon="i-lucide-search"
              placeholder="Global filter..."
            />

            <div class="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
              <UProgress
                v-if="isLoadAllMode && loadAllBusy && totalLoadAllRows"
                :model-value="loadAllProgress"
                class="w-28"
              />
              <p
                v-if="isLoadAllMode && loadAllBusy"
                class="text-xs text-muted"
                aria-live="polite"
              >
                Memuat semua data: {{ loadedLoadAllRows }} dari {{ totalLoadAllRows || '...' }} pengajuan.
              </p>
              <p
                v-else-if="isLoadAllMode && totalLoadAllRows"
                class="text-xs text-muted"
                aria-live="polite"
              >
                Load All aktif: {{ totalRows }} hasil dari {{ totalLoadAllRows }} pengajuan.
              </p>
              <p
                v-else-if="isRefreshing && totalRows"
                class="text-xs text-muted"
                aria-live="polite"
              >
                Memuat data pengajuan...
              </p>
              <p
                v-else-if="totalRows"
                class="text-xs text-muted"
                aria-live="polite"
              >
                Menampilkan {{ loadedRows }} dari {{ totalRows }} pengajuan.
              </p>
              <p
                v-if="selectedCompletePengajuanIds.length"
                class="text-xs text-muted"
                aria-live="polite"
              >
                {{ selectedCompletePengajuanIds.length }} pengajuan dipilih.
              </p>
              <p
                v-else-if="selectedCompletedPengajuanCount"
                class="text-xs text-muted"
                aria-live="polite"
              >
                Pengajuan terpilih sudah Selesai.
              </p>

              <UButton
                v-if="canMutatePengajuan"
                :label="selectedCompletePengajuanIds.length ? `Tandai Selesai (${selectedCompletePengajuanIds.length})` : 'Tandai Selesai'"
                icon="i-lucide-check-check"
                color="success"
                variant="solid"
                size="md"
                :disabled="!selectedCompletePengajuanIds.length || isCompletingPengajuan"
                :loading="isCompletingPengajuan"
                @click="openSelectedCompletePengajuan"
              />
              <UButton
                v-if="isAdmin"
                :label="isLoadAllMode ? 'Mode Halaman' : 'Load All'"
                :icon="isLoadAllMode ? 'i-lucide-list' : 'i-lucide-database'"
                :color="isLoadAllMode ? 'primary' : 'neutral'"
                :variant="isLoadAllMode ? 'soft' : 'outline'"
                size="md"
                :loading="!isLoadAllMode && loadAllBusy"
                @click="toggleLoadAllMode"
              />
              <UButton
                v-if="isAdmin && isLoadAllMode"
                label="Refresh All"
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="ghost"
                size="md"
                :loading="loadAllBusy"
                @click="reloadLoadAll"
              />

              <USelect
                v-model="decisionFilter"
                :items="decisionFilterItems"
                class="w-full sm:w-40"
                :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
              />
            </div>
          </div>

          <UTable
            v-model:row-selection="rowSelection"
            :get-row-id="(row) => row.key"
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
              th: 'border-b border-muted px-4 py-3 font-semibold uppercase text-muted',
              td: 'border-b border-muted px-4 py-3 align-middle',
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
                  :name="loadError ? 'i-lucide-circle-alert' : 'i-lucide-inbox'"
                  class="size-8 text-muted"
                />
                <p class="text-sm font-medium text-highlighted">
                  {{ loadError ? 'Data pengajuan belum bisa dimuat' : 'Belum ada pengajuan final' }}
                </p>
                <p v-if="loadError" class="max-w-md text-sm text-muted">
                  {{ loadError }}
                </p>
              </div>
            </template>
          </UTable>

          <div v-if="!isLoading && explodedRows.length" class="flex flex-wrap items-center justify-between gap-3 border-t border-accented px-4 py-3">
            <p class="text-xs text-muted">
              {{ explodedRows.length }} item dari {{ filteredPengajuanCount }} pengajuan di halaman ini.
            </p>
            <UPagination
              :page="currentPage"
              :items-per-page="pageSize"
              :total="totalRows"
              @update:page="setPengajuanPage"
            />
          </div>
        </div>
      </section>

      <UModal
        v-model:open="completePengajuanOpen"
        title="Tandai pengajuan selesai?"
        :description="`${completePengajuanTargetIds.length} pengajuan akan diubah menjadi Selesai.`"
        :ui="{ footer: 'justify-end' }"
      >
        <template #body>
          <div class="space-y-4">
            <UAlert
              v-if="completePengajuanError"
              color="error"
              variant="subtle"
              icon="i-lucide-circle-alert"
              :title="completePengajuanError"
            />

            <div class="rounded-lg border border-muted bg-muted/20 p-3">
              <p class="text-xs font-medium uppercase text-muted">
                ID Pengajuan
              </p>
              <p class="mt-1 wrap-break-word font-mono text-sm text-highlighted">
                {{ completePengajuanTargetPreview || '-' }}
              </p>
            </div>

            <UFormField label="Catatan Admin" name="catatan-selesai">
              <UTextarea
                v-model="completePengajuanNote"
                :rows="3"
                class="w-full"
                :disabled="isCompletingPengajuan"
              />
            </UFormField>
          </div>
        </template>

        <template #footer="{ close }">
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            :disabled="isCompletingPengajuan"
            @click="close"
          />
          <UButton
            label="Tandai Selesai"
            icon="i-lucide-check-check"
            color="success"
            :loading="isCompletingPengajuan"
            :disabled="!completePengajuanTargetIds.length"
            @click="confirmCompletePengajuan"
          />
        </template>
      </UModal>

      <UModal
        v-model:open="editPengajuanOpen"
        :title="selectedPengajuan ? `Edit ${selectedPengajuan.idPengajuan}` : 'Edit Pengajuan'"
        description="Ubah data administratif pengajuan"
        :ui="{ footer: 'justify-end' }"
      >
        <template #body>
          <form id="edit-pengajuan-form" class="space-y-4" @submit.prevent="submitEditPengajuan">
            <UAlert
              v-if="isEditPrefillLoading"
              color="info"
              variant="subtle"
              icon="i-lucide-loader-circle"
              title="Memuat detail pengajuan"
            />
            <UAlert
              v-if="editPengajuanError"
              color="error"
              variant="subtle"
              icon="i-lucide-circle-alert"
              :title="editPengajuanError"
            />

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Nama" name="nama" required>
                <UInput
                  v-model="editPengajuanForm.nama"
                  class="w-full"
                  autocomplete="name"
                  :disabled="isEditPrefillLoading || isSavingPengajuan"
                />
              </UFormField>

              <UFormField label="Cabang" name="bagianCabang" required>
                <UInput
                  v-model="editPengajuanForm.bagianCabang"
                  class="w-full"
                  autocomplete="organization"
                  :disabled="isEditPrefillLoading || isSavingPengajuan"
                />
              </UFormField>

              <UFormField label="Pemilik" name="pemilik" required>
                <UInput
                  v-model="editPengajuanForm.pemilik"
                  class="w-full"
                  :disabled="isEditPrefillLoading || isSavingPengajuan"
                />
              </UFormField>

              <UFormField label="Tanggal Form" name="tanggalForm" required>
                <UInput
                  v-model="editPengajuanForm.tanggalForm"
                  type="date"
                  class="w-full"
                  :disabled="isEditPrefillLoading || isSavingPengajuan"
                />
              </UFormField>
            </div>

            <UFormField label="Alasan Pengajuan" name="alasanPengajuan" required>
              <UTextarea
                v-model="editPengajuanForm.alasanPengajuan"
                :rows="3"
                class="w-full"
                :disabled="isEditPrefillLoading || isSavingPengajuan"
              />
            </UFormField>

            <UFormField label="Catatan Tambahan" name="catatanTambahan">
              <UTextarea
                v-model="editPengajuanForm.catatanTambahan"
                :rows="3"
                class="w-full"
                :disabled="isEditPrefillLoading || isSavingPengajuan"
              />
            </UFormField>
          </form>
        </template>

        <template #footer="{ close }">
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            :disabled="isSavingPengajuan"
            @click="close"
          />
          <UButton
            type="submit"
            form="edit-pengajuan-form"
            label="Simpan"
            icon="i-lucide-save"
            :loading="isSavingPengajuan"
            :disabled="isEditPrefillLoading"
          />
        </template>
      </UModal>

      <UModal
        v-model:open="deletePengajuanOpen"
        title="Hapus pengajuan?"
        :description="selectedPengajuan ? `${selectedPengajuan.idPengajuan} akan dihapus beserta data terkaitnya.` : 'Pengajuan akan dihapus beserta data terkaitnya.'"
        :ui="{ footer: 'justify-end' }"
      >
        <template #body>
          <UAlert
            v-if="deletePengajuanError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="deletePengajuanError"
          />
        </template>

        <template #footer="{ close }">
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            :disabled="isDeletingPengajuan"
            @click="close"
          />
          <UButton
            label="Hapus"
            icon="i-lucide-trash-2"
            color="error"
            :loading="isDeletingPengajuan"
            @click="confirmDeletePengajuan"
          />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
