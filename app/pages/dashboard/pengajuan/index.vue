<script setup lang="ts">
import { h } from 'vue'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'

definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

type PengajuanStatus = 'Baru' | 'Disetujui' | 'Ditolak' | 'Diprint' | 'Dikirim' | 'Selesai'
type PengajuanStatusFilter = PengajuanStatus | 'all'
type ItemDecision = 'Menunggu' | 'Disetujui' | 'Ditolak'
type ItemDecisionFilter = ItemDecision | 'all'
type PrintStatus = 'Belum Dicetak' | 'Dicetak'
type ShippingStatus = 'Belum Dikirim' | 'Dikirim'
type WarrantyCardType = 'Local' | 'Import'
type WarrantyCardValue = WarrantyCardType | ''

type PengajuanFile = {
  id: string
  name: string
  kind: 'hardcopy' | 'evidence' | 'attachment' | 'signed_statement'
  itemNo?: number
  itemNos: number[]
  mimeType: 'application/pdf' | 'image/jpeg'
  sizeLabel: string
}

type StatusLog = {
  at: string
  actor: string
  scope: 'pengajuan' | 'item'
  noItem?: number
  from: PengajuanStatus | '-'
  to: PengajuanStatus
  note: string
}

type PengajuanItem = {
  noItem: number
  produk: string
  model: string
  nomorSeri: string
  keputusanItem: ItemDecision
  catatanKeputusan?: string
  approvalOverrideReason: 'signed_statement' | null
  jenisKartu: WarrantyCardValue
  statusCetak: PrintStatus
  statusKirim: ShippingStatus
  printedAt?: string
  shippedAt?: string
}

type PengajuanRecord = {
  idPengajuan: string
  submittedAt: string
  nama: string
  bagian: string
  cabang: string
  pemilik: string
  alasanPengajuan: string
  tanggalForm: string
  catatanTambahan: string
  status: PengajuanStatus
  catatanAdmin: string
  approvalOverrideReason: 'signed_statement' | null
  files: PengajuanFile[]
  items: PengajuanItem[]
  statusLog: StatusLog[]
}

type TableRow = {
  key: string
  idPengajuan: string
  submittedAt: string
  nama: string
  bagian: string
  cabang: string
  pemilik: string
  status: PengajuanStatus
  noItem: number
  produk: string
  model: string
  nomorSeri: string
  keputusanItem: ItemDecision
  jenisKartu: WarrantyCardValue
  statusCetak: PrintStatus
  statusKirim: ShippingStatus
  fileCount: number
}

type EditPengajuanForm = {
  nama: string
  bagian: string
  cabang: string
  pemilik: string
  alasanPengajuan: string
  tanggalForm: string
  catatanTambahan: string
}

type DecisionTarget = {
  idPengajuan: string
  noItem: number
  decision: Exclude<ItemDecision, 'Menunggu'>
} | null
type SignedStatementScope = 'all_rejected' | 'selected_items'

const UCheckbox = resolveComponent('UCheckbox')

const PENGAJUAN_SELESAI_NOTE = 'Kartu garansi sudah diterima dan pengajuan selesai.'

const toast = useToast()
const { isAdmin, isQrcc } = useUserProfile()

const canMutatePengajuan = computed(() => isAdmin.value || isQrcc.value)
const canDeletePengajuan = computed(() => isAdmin.value)
const canRestorePengajuan = computed(() => isAdmin.value)

const {
  data: pengajuanRowsData,
  status: pengajuanFetchStatus,
  error: pengajuanFetchError,
  refresh: refreshPengajuan,
} = await useFetch<PengajuanRecord[]>('/api/pengajuan', {
  default: () => [],
})

const pengajuanRows = computed(() => pengajuanRowsData.value ?? [])
const isLoadingPengajuan = computed(() => pengajuanFetchStatus.value === 'pending')
const search = ref('')
const statusFilter = ref<PengajuanStatusFilter>('all')
const decisionFilter = ref<ItemDecisionFilter>('all')
const branchFilter = ref('all')
const modelFilter = ref('all')
const currentPage = ref(1)
const pageSize = ref(10)
const rowSelection = ref<Record<string, boolean>>({})
const detailOpen = ref(false)
const editPengajuanOpen = ref(false)
const deletePengajuanOpen = ref(false)
const completePengajuanOpen = ref(false)
const restorePengajuanOpen = ref(false)
const itemDecisionOpen = ref(false)
const isSavingPengajuan = ref(false)
const isDeletingPengajuan = ref(false)
const isCompletingPengajuan = ref(false)
const isRestoringPengajuan = ref(false)
const isSavingItemDecision = ref(false)
const isSavingItemOperation = ref(false)
const editPengajuanError = ref('')
const deletePengajuanError = ref('')
const completePengajuanError = ref('')
const restorePengajuanError = ref('')
const itemDecisionError = ref('')
const selectedPengajuan = ref<PengajuanRecord | null>(null)
const completePengajuanTargetIds = ref<string[]>([])
const completePengajuanNote = ref(PENGAJUAN_SELESAI_NOTE)
const restorePengajuanNote = ref('')
const decisionTarget = ref<DecisionTarget>(null)
const decisionNote = ref('')
const signedStatementInput = ref<HTMLInputElement | null>(null)
const isUploadingSignedStatement = ref(false)
const signedStatementError = ref('')
const signedStatementTargetItemNo = ref<number | null>(null)
const signedStatementScope = ref<SignedStatementScope>('all_rejected')
const signedStatementItemNos = ref<number[]>([])

const editPengajuanForm = reactive<EditPengajuanForm>({
  nama: '',
  bagian: '',
  cabang: '',
  pemilik: '',
  alasanPengajuan: '',
  tanggalForm: '',
  catatanTambahan: '',
})

const statusFilterItems = [
  { label: 'Semua status', value: 'all' },
  { label: 'Baru', value: 'Baru' },
  { label: 'Disetujui', value: 'Disetujui' },
  { label: 'Ditolak', value: 'Ditolak' },
  { label: 'Diprint', value: 'Diprint' },
  { label: 'Dikirim', value: 'Dikirim' },
  { label: 'Selesai', value: 'Selesai' },
]

const decisionFilterItems = [
  { label: 'Semua keputusan', value: 'all' },
  { label: 'Menunggu', value: 'Menunggu' },
  { label: 'Disetujui', value: 'Disetujui' },
  { label: 'Ditolak', value: 'Ditolak' },
]

const keputusanColorMap: Record<ItemDecision, 'neutral' | 'success' | 'error'> = {
  'Menunggu': 'neutral',
  'Disetujui': 'success',
  'Ditolak': 'error',
}

const statusColorMap: Record<PengajuanStatus, 'info' | 'primary' | 'error' | 'warning' | 'success'> = {
  'Baru': 'info',
  'Disetujui': 'primary',
  'Ditolak': 'error',
  'Diprint': 'warning',
  'Dikirim': 'primary',
  'Selesai': 'success',
}

const allTableRows = computed(() => pengajuanRows.value.flatMap(createTableRows))

const filteredTableRows = computed(() => {
  const needle = normalizeSearch(search.value)

  return allTableRows.value.filter((row) => {
    const matchesStatus = statusFilter.value === 'all' || row.status === statusFilter.value
    const matchesDecision = decisionFilter.value === 'all' || row.keputusanItem === decisionFilter.value
    const matchesBranch = branchFilter.value === 'all' || row.cabang === branchFilter.value
    const matchesModel = modelFilter.value === 'all' || row.model === modelFilter.value
    const matchesSearch = !needle || normalizeSearch([
      row.idPengajuan,
      row.nama,
      row.pemilik,
      row.bagian,
      row.cabang,
      row.status,
      row.produk,
      row.model,
      row.nomorSeri,
      row.keputusanItem,
      row.jenisKartu,
    ].join(' ')).includes(needle)

    return matchesStatus && matchesDecision && matchesBranch && matchesModel && matchesSearch
  })
})

const tableRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredTableRows.value.slice(start, start + pageSize.value)
})

const totalRows = computed(() => filteredTableRows.value.length)
const filteredPengajuanCount = computed(() => new Set(filteredTableRows.value.map(row => row.idPengajuan)).size)
const selectedRows = computed(() => filteredTableRows.value.filter(row => rowSelection.value[row.key]))
const selectedCompletePengajuanIds = computed(() => getUniqueCompleteCandidates(selectedRows.value))
const selectedIneligibleCount = computed(() => {
  const selectedIds = new Set(selectedRows.value.map(row => row.idPengajuan))
  return Math.max(selectedIds.size - selectedCompletePengajuanIds.value.length, 0)
})
const completePengajuanTargetPreview = computed(() => {
  const ids = completePengajuanTargetIds.value
  const preview = ids.slice(0, 6).join(', ')
  return ids.length > 6 ? `${preview}, +${ids.length - 6} lainnya` : preview
})

const selectedDetailItems = computed(() => selectedPengajuan.value?.items ?? [])
const selectedDetailStatusLogs = computed(() => [...(selectedPengajuan.value?.statusLog ?? [])].reverse())
const rejectedSignedStatementItems = computed(() => {
  const record = selectedPengajuan.value
  if (!record) return []

  return record.items.filter(item =>
    item.keputusanItem === 'Ditolak' && !hasSignedStatementForItem(record, item.noItem),
  )
})

const signedStatementScopeItems = [
  { label: 'Semua item ditolak', value: 'all_rejected' as const },
  { label: 'Pilih item tertentu', value: 'selected_items' as const },
]

const columns = computed<TableColumn<TableRow>[]>(() => {
  const baseColumns: TableColumn<TableRow>[] = [{
    id: 'select',
    header: ({ table }) => h(UCheckbox, {
      'modelValue': table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
      'aria-label': 'Pilih semua baris',
      'disabled': !canMutatePengajuan.value,
    }),
    cell: ({ row }) => h(UCheckbox, {
      'modelValue': row.getIsSelected(),
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
      'aria-label': `Pilih ${row.original.idPengajuan} item ${row.original.noItem}`,
      'disabled': !canMutatePengajuan.value,
    }),
    meta: {
      class: {
        th: 'whitespace-nowrap',
        td: 'whitespace-nowrap',
      },
      style: {
        th: { width: '2%' },
        td: { width: '2%' },
      },
    },
  }, {
    accessorKey: 'idPengajuan',
    header: 'ID Pengajuan',
    meta: {
      class: {
        th: 'whitespace-nowrap',
        td: 'whitespace-nowrap',
      },
      style: {
        th: { width: 'max-content' },
        td: { width: 'max-content' },
      },
    },
  }, {
    accessorKey: 'item',
    header: 'Item',
    meta: {
      class: {
        th: 'whitespace-nowrap',
        td: 'whitespace-nowrap',
      },
      style: {
        th: { width: '1%' },
        td: { width: '1%' },
      },
    },
  }, {
    accessorKey: 'submittedAt',
    header: 'Tanggal Pengajuan',
  }, {
    id: 'pemohon',
    header: 'Pemohon',
  }, {
    id: 'model',
    header: 'Model',
  }, {
    accessorKey: 'nomorSeri',
    header: 'Nomor Seri',
  }, {
    id: 'bagian',
    header: 'Bagian',
  }, {
    id: 'cabang',
    header: 'Cabang',
  }, {
    id: 'status',
    header: 'Status',
  }, {
    accessorKey: 'keputusanItem',
    header: 'Keputusan Item',
  }, {
    id: 'actions',
    header: () => h('div', { class: 'text-right' }, 'Aksi'),
  }]

  if (canMutatePengajuan.value) return baseColumns
  return baseColumns.filter(column => column.id !== 'select')
})

watch([search, statusFilter, decisionFilter, branchFilter, modelFilter], () => {
  currentPage.value = 1
})

watch(filteredTableRows, (next) => {
  const visibleKeys = new Set(next.map(row => row.key))
  rowSelection.value = Object.fromEntries(
    Object.entries(rowSelection.value).filter(([key, selected]) => selected && visibleKeys.has(key)),
  )
})

function createTableRows(record: PengajuanRecord): TableRow[] {
  return record.items.map(item => ({
    key: getRowKey(record.idPengajuan, item.noItem),
    idPengajuan: record.idPengajuan,
    submittedAt: record.submittedAt,
    nama: record.nama,
    bagian: record.bagian,
    cabang: record.cabang,
    pemilik: record.pemilik,
    status: record.status,
    noItem: item.noItem,
    produk: item.produk,
    model: item.model,
    nomorSeri: item.nomorSeri,
    keputusanItem: item.keputusanItem,
    jenisKartu: item.jenisKartu,
    statusCetak: item.statusCetak,
    statusKirim: item.statusKirim,
    fileCount: record.files.length,
  }))
}

function resetFilters() {
  search.value = ''
  statusFilter.value = 'all'
  decisionFilter.value = 'all'
  branchFilter.value = 'all'
  modelFilter.value = 'all'
}

function openDetail(row: TableRow) {
  selectedPengajuan.value = findPengajuan(row.idPengajuan)
  signedStatementError.value = ''
  signedStatementScope.value = 'all_rejected'
  signedStatementItemNos.value = []
  detailOpen.value = Boolean(selectedPengajuan.value)
}

function openSignedStatementPicker(noItem?: number) {
  if (!isAdmin.value || !selectedPengajuan.value) return

  if (noItem !== undefined) {
    const item = selectedPengajuan.value.items.find(candidate => candidate.noItem === noItem)
    if (!item || item.keputusanItem !== 'Ditolak' || hasSignedStatementForItem(selectedPengajuan.value, noItem)) return

    signedStatementScope.value = 'selected_items'
    signedStatementItemNos.value = [noItem]
  } else if (!hasSignedStatementTargets()) {
    signedStatementError.value = 'Pilih minimal satu item Ditolak untuk dipulihkan.'
    return
  }

  signedStatementTargetItemNo.value = noItem ?? null
  signedStatementInput.value?.click()
}

async function uploadSelectedSignedStatement(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (
    !file
    || !selectedPengajuan.value
  ) {
    signedStatementTargetItemNo.value = null
    return
  }

  const targetItemNos = signedStatementScope.value === 'all_rejected'
    ? rejectedSignedStatementItems.value.map(item => item.noItem)
    : [...signedStatementItemNos.value]

  if (!targetItemNos.length) {
    signedStatementError.value = 'Pilih minimal satu item Ditolak untuk dipulihkan.'
    signedStatementTargetItemNo.value = null
    return
  }

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    signedStatementError.value = 'Surat pernyataan wajib berupa file PDF.'
    return
  }

  isUploadingSignedStatement.value = true
  signedStatementError.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('scope', signedStatementScope.value)
    formData.append('itemNos', JSON.stringify(targetItemNos))

    const updated = await $fetch<PengajuanRecord>(
      `/api/pengajuan/${selectedPengajuan.value.idPengajuan}/signed-statement`,
      {
        method: 'POST',
        body: formData,
      },
    )

    await refreshPengajuan()
    selectedPengajuan.value = updated
    signedStatementScope.value = 'all_rejected'
    signedStatementItemNos.value = []
    toast.add({
      title: 'Surat pernyataan tersimpan',
      description: `${updated.idPengajuan} disetujui berdasarkan surat pernyataan bertanda tangan.`,
      color: 'success',
      icon: 'i-lucide-file-check-2',
    })
  } catch (error) {
    signedStatementError.value = getApiErrorMessage(error)
  } finally {
    isUploadingSignedStatement.value = false
    signedStatementTargetItemNo.value = null
  }
}

function hasSignedStatementForItem(record: PengajuanRecord, noItem: number) {
  return record.files.some(file =>
    file.kind === 'signed_statement'
    && (file.itemNo === noItem || file.itemNos.includes(noItem)),
  )
}

function toggleSignedStatementItem(noItem: number, selected: boolean | 'indeterminate') {
  if (selected === 'indeterminate') return

  if (selected) {
    if (!signedStatementItemNos.value.includes(noItem)) {
      signedStatementItemNos.value = [...signedStatementItemNos.value, noItem]
    }
    return
  }

  signedStatementItemNos.value = signedStatementItemNos.value.filter(item => item !== noItem)
}

function hasSignedStatementTargets() {
  if (signedStatementScope.value === 'selected_items') {
    return signedStatementItemNos.value.length > 0
  }

  return rejectedSignedStatementItems.value.length > 0
}

function openEditPengajuan(row: TableRow) {
  if (!canMutatePengajuan.value) return

  const record = findPengajuan(row.idPengajuan)
  if (!record) return

  selectedPengajuan.value = record
  editPengajuanError.value = ''
  fillEditForm(record)
  editPengajuanOpen.value = true
}

async function submitEditPengajuan() {
  if (!selectedPengajuan.value || isSavingPengajuan.value) return

  const validationError = validateEditForm(editPengajuanForm)
  if (validationError) {
    editPengajuanError.value = validationError
    return
  }

  isSavingPengajuan.value = true

  try {
    const updated = await $fetch<PengajuanRecord>(`/api/pengajuan/${selectedPengajuan.value.idPengajuan}/update`, {
      method: 'POST',
      body: {
        nama: editPengajuanForm.nama.trim(),
        bagian: editPengajuanForm.bagian.trim(),
        cabang: editPengajuanForm.cabang.trim(),
        pemilik: editPengajuanForm.pemilik.trim(),
        alasanPengajuan: editPengajuanForm.alasanPengajuan.trim(),
        tanggalForm: editPengajuanForm.tanggalForm.trim(),
        catatanTambahan: editPengajuanForm.catatanTambahan.trim(),
      },
    })

    await refreshPengajuan()
    selectedPengajuan.value = updated
    editPengajuanOpen.value = false
    toast.add({
      title: 'Pengajuan diperbarui',
      description: `${updated.idPengajuan} tersimpan di database.`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
  } catch (error) {
    editPengajuanError.value = getApiErrorMessage(error)
  } finally {
    isSavingPengajuan.value = false
  }
}

function openDeletePengajuan(row: TableRow) {
  if (!canDeletePengajuan.value) return

  selectedPengajuan.value = findPengajuan(row.idPengajuan)
  deletePengajuanError.value = ''
  deletePengajuanOpen.value = Boolean(selectedPengajuan.value)
}

async function confirmDeletePengajuan() {
  const record = selectedPengajuan.value
  if (!record || isDeletingPengajuan.value) return

  isDeletingPengajuan.value = true

  try {
    await $fetch(`/api/pengajuan/${record.idPengajuan}/delete`, {
      method: 'POST',
      body: { reason: 'Dihapus melalui dashboard pengajuan.' },
    })
    await refreshPengajuan()
    deletePengajuanOpen.value = false
    selectedPengajuan.value = null
    toast.add({
      title: 'Pengajuan dihapus',
      description: `${record.idPengajuan} sudah dihapus dari daftar aktif.`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
  } catch (error) {
    deletePengajuanError.value = getApiErrorMessage(error)
  } finally {
    isDeletingPengajuan.value = false
  }
}

function openCompletePengajuan(row: TableRow) {
  const record = findPengajuan(row.idPengajuan)
  if (!record || !canCompleteRecord(record)) return
  openCompletePengajuanByIds([record.idPengajuan])
}

function openSelectedCompletePengajuan() {
  if (!selectedCompletePengajuanIds.value.length) return
  openCompletePengajuanByIds(selectedCompletePengajuanIds.value)
}

function openCompletePengajuanByIds(ids: string[]) {
  completePengajuanTargetIds.value = Array.from(new Set(ids))
  completePengajuanNote.value = PENGAJUAN_SELESAI_NOTE
  completePengajuanError.value = ''
  completePengajuanOpen.value = true
}

async function confirmCompletePengajuan() {
  const ids = completePengajuanTargetIds.value
  if (!ids.length || isCompletingPengajuan.value) return

  isCompletingPengajuan.value = true

  try {
    const result = await $fetch<{ updated: string[] }>('/api/pengajuan/bulk-status', {
      method: 'POST',
      body: {
        ids,
        status: 'Selesai',
        note: completePengajuanNote.value.trim() || PENGAJUAN_SELESAI_NOTE,
      },
    })

    await refreshPengajuan()
    rowSelection.value = Object.fromEntries(
      Object.entries(rowSelection.value).filter(([key]) => {
        const row = filteredTableRows.value.find(item => item.key === key)
        return row && !result.updated.includes(row.idPengajuan)
      }),
    )

    completePengajuanOpen.value = false
    toast.add({
      title: 'Status pengajuan diperbarui',
      description: `${result.updated.length} pengajuan ditandai Selesai.`,
      color: 'success',
      icon: 'i-lucide-check-check',
    })
  } catch (error) {
    completePengajuanError.value = getApiErrorMessage(error)
  } finally {
    isCompletingPengajuan.value = false
  }
}

function openRestorePengajuan(row: TableRow) {
  if (!canRestorePengajuan.value) return

  const record = findPengajuan(row.idPengajuan)
  if (!record || record.status !== 'Ditolak') return

  selectedPengajuan.value = record
  restorePengajuanNote.value = ''
  restorePengajuanError.value = ''
  restorePengajuanOpen.value = true
}

async function confirmRestorePengajuan() {
  const record = selectedPengajuan.value
  const note = restorePengajuanNote.value.trim()
  if (!record || record.status !== 'Ditolak' || isRestoringPengajuan.value) return

  if (!note) {
    restorePengajuanError.value = 'Alasan pemulihan wajib diisi.'
    return
  }

  isRestoringPengajuan.value = true

  try {
    const updated = await $fetch<PengajuanRecord>(`/api/pengajuan/${record.idPengajuan}/status`, {
      method: 'POST',
      body: {
        status: 'Baru',
        note,
      },
    })

    await refreshPengajuan()
    selectedPengajuan.value = updated
    restorePengajuanOpen.value = false
    toast.add({
      title: 'Pengajuan dipulihkan',
      description: `${updated.idPengajuan} kembali ke status Baru.`,
      color: 'success',
      icon: 'i-lucide-rotate-ccw',
    })
  } catch (error) {
    restorePengajuanError.value = getApiErrorMessage(error)
  } finally {
    isRestoringPengajuan.value = false
  }
}

function openItemDecision(row: TableRow, decision: Exclude<ItemDecision, 'Menunggu'>) {
  if (!canMutatePengajuan.value) return

  decisionTarget.value = {
    idPengajuan: row.idPengajuan,
    noItem: row.noItem,
    decision,
  }
  decisionNote.value = ''
  itemDecisionError.value = ''
  itemDecisionOpen.value = true
}

async function confirmItemDecision() {
  const target = decisionTarget.value
  if (!target || isSavingItemDecision.value) return

  if (target.decision === 'Ditolak' && !decisionNote.value.trim()) {
    itemDecisionError.value = 'Catatan wajib diisi saat item ditolak.'
    return
  }

  isSavingItemDecision.value = true

  try {
    const updated = await $fetch<PengajuanRecord>(`/api/pengajuan/${target.idPengajuan}/item-decision`, {
      method: 'POST',
      body: {
        noItem: target.noItem,
        decision: target.decision,
        note: decisionNote.value.trim(),
      },
    })

    await refreshPengajuan()
    selectedPengajuan.value = updated
    itemDecisionOpen.value = false
    toast.add({
      title: 'Keputusan item diperbarui',
      description: `${updated.idPengajuan} item ${target.noItem} sekarang ${target.decision}.`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
  } catch (error) {
    itemDecisionError.value = getApiErrorMessage(error)
  } finally {
    isSavingItemDecision.value = false
  }
}

async function markItemPrinted(item: PengajuanItem) {
  const record = selectedPengajuan.value
  if (!record || !canMutatePengajuan.value || item.keputusanItem !== 'Disetujui' || isSavingItemOperation.value) return

  isSavingItemOperation.value = true

  try {
    const updated = await $fetch<PengajuanRecord>(`/api/pengajuan/${record.idPengajuan}/item-print`, {
      method: 'POST',
      body: { noItem: item.noItem },
    })
    await refreshPengajuan()
    selectedPengajuan.value = updated
  } catch (error) {
    toast.add({
      title: 'Gagal menandai dicetak',
      description: getApiErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  } finally {
    isSavingItemOperation.value = false
  }
}

async function markItemShipped(item: PengajuanItem) {
  const record = selectedPengajuan.value
  if (!record || !canMutatePengajuan.value || item.keputusanItem !== 'Disetujui' || item.statusCetak !== 'Dicetak' || isSavingItemOperation.value) return

  isSavingItemOperation.value = true

  try {
    const updated = await $fetch<PengajuanRecord>(`/api/pengajuan/${record.idPengajuan}/item-shipping`, {
      method: 'POST',
      body: { noItem: item.noItem },
    })
    await refreshPengajuan()
    selectedPengajuan.value = updated
  } catch (error) {
    toast.add({
      title: 'Gagal menandai dikirim',
      description: getApiErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  } finally {
    isSavingItemOperation.value = false
  }
}

function canCompleteRecord(record: PengajuanRecord) {
  const hasShippedItem = record.items.some(item => item.statusKirim === 'Dikirim')
  const allDoneOrRejected = record.items.every(item =>
    item.keputusanItem === 'Ditolak' || item.statusKirim === 'Dikirim',
  )

  return record.status === 'Dikirim' && hasShippedItem && allDoneOrRejected
}

function getUniqueCompleteCandidates(rows: TableRow[]) {
  return Array.from(new Set(rows
    .map(row => findPengajuan(row.idPengajuan))
    .filter((record): record is PengajuanRecord => Boolean(record && canCompleteRecord(record)))
    .map(record => record.idPengajuan)))
}

function getRowActions(row: TableRow) {
  const actions: DropdownMenuItem[][] = [[{
    label: 'Lihat detail',
    icon: 'i-lucide-eye',
    onSelect: () => openDetail(row),
  }]]

  if (canMutatePengajuan.value) {
    actions.push([{
      label: 'Edit data utama',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditPengajuan(row),
    }, {
      label: 'Setujui item',
      icon: 'i-lucide-check',
      disabled: row.keputusanItem === 'Disetujui',
      onSelect: () => openItemDecision(row, 'Disetujui'),
    }, {
      label: 'Tolak item',
      icon: 'i-lucide-x',
      disabled: row.keputusanItem === 'Ditolak',
      onSelect: () => openItemDecision(row, 'Ditolak'),
    }])
  }

  const record = findPengajuan(row.idPengajuan)
  if (canRestorePengajuan.value && record?.status === 'Ditolak') {
    actions.push([{
      label: 'Pulihkan ke Baru',
      icon: 'i-lucide-rotate-ccw',
      onSelect: () => openRestorePengajuan(row),
    }])
  }

  if (canMutatePengajuan.value && record && canCompleteRecord(record)) {
    actions.push([{
      label: 'Tandai Selesai',
      icon: 'i-lucide-check-check',
      color: 'success',
      onSelect: () => openCompletePengajuan(row),
    }])
  }

  if (canDeletePengajuan.value) {
    actions.push([{
      label: 'Hapus pengajuan',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => openDeletePengajuan(row),
    }])
  }

  return actions
}

function findPengajuan(idPengajuan: string) {
  return pengajuanRows.value.find(row => row.idPengajuan === idPengajuan) ?? null
}

function fillEditForm(record: PengajuanRecord) {
  editPengajuanForm.nama = record.nama
  editPengajuanForm.bagian = record.bagian
  editPengajuanForm.cabang = record.cabang
  editPengajuanForm.pemilik = record.pemilik
  editPengajuanForm.alasanPengajuan = record.alasanPengajuan
  editPengajuanForm.tanggalForm = record.tanggalForm
  editPengajuanForm.catatanTambahan = record.catatanTambahan
}

function validateEditForm(form: EditPengajuanForm) {
  if (!form.nama.trim()) return 'Nama pemohon wajib diisi.'
  if (!form.bagian.trim()) return 'Bagian wajib diisi.'
  if (!form.cabang.trim()) return 'Cabang wajib diisi.'
  if (!form.pemilik.trim()) return 'Pemilik barang wajib diisi.'
  if (!form.alasanPengajuan.trim()) return 'Alasan pengajuan wajib diisi.'
  if (!isValidDateInput(form.tanggalForm)) return 'Tanggal form tidak valid.'
  return ''
}

function isValidDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

function getStatusMeta(status: PengajuanStatus) {
  const statusMeta = {
    Baru: { color: 'info', icon: 'i-lucide-sparkles', label: 'Baru' },
    Disetujui: { color: 'primary', icon: 'i-lucide-check', label: 'Disetujui' },
    Ditolak: { color: 'error', icon: 'i-lucide-x', label: 'Ditolak' },
    Diprint: { color: 'warning', icon: 'i-lucide-printer', label: 'Diprint' },
    Dikirim: { color: 'primary', icon: 'i-lucide-truck', label: 'Dikirim' },
    Selesai: { color: 'success', icon: 'i-lucide-circle-check', label: 'Selesai' },
  } as const

  return statusMeta[status]
}

function getDecisionMeta(decision: ItemDecision) {
  const decisionMeta = {
    Menunggu: { color: 'neutral', icon: 'i-lucide-clock', label: 'Menunggu' },
    Disetujui: { color: 'success', icon: 'i-lucide-check', label: 'Disetujui' },
    Ditolak: { color: 'error', icon: 'i-lucide-x', label: 'Ditolak' },
  } as const

  return decisionMeta[decision]
}

function getOperationalProgress(row: TableRow | PengajuanItem) {
  if (row.keputusanItem === 'Ditolak') return 'Tidak masuk antrean'
  if (row.statusKirim === 'Dikirim') return 'Sudah dikirim'
  if (row.statusCetak === 'Dicetak') return 'Menunggu pengiriman'
  if (row.keputusanItem === 'Disetujui') return 'Menunggu cetak'
  return 'Menunggu review'
}

function getFileKindLabel(kind: PengajuanFile['kind']) {
  const kindLabel = {
    hardcopy: 'Hardcopy',
    evidence: 'Lampiran tambahan',
    attachment: 'Lampiran tambahan',
    signed_statement: 'Surat Pernyataan',
  } as const

  return kindLabel[kind]
}

function getPengajuanFileUrl(idPengajuan: string, fileId: string) {
  return `/api/pengajuan/${encodeURIComponent(idPengajuan)}/files/${encodeURIComponent(fileId)}`
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
  }).format(new Date(`${value}T00:00:00`))
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function getRowKey(idPengajuan: string, noItem: number) {
  return `${idPengajuan}::${noItem}`
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
  <UDashboardPanel id="pengajuan">
    <template #header>
      <UDashboardNavbar title="Pengajuan Kartu Garansi">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            variant="solid"
            icon="i-lucide-plus"
            to="/dashboard/pengajuan/create"
          >
            Pengajuan Baru
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UContainer class="">
        <section class="mt-6 overflow-hidden rounded-lg border border-muted bg-default">
          <div class="flex flex-col gap-3 border-b border-muted px-4 py-4">
            <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <UInput
                v-model="search"
                class="w-full xl:max-w-sm"
                icon="i-lucide-search"
                placeholder="Cari ID, pemohon, cabang, model, serial"
              />

              <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:flex xl:justify-end">
                <UButton
                  icon="i-lucide-rotate-ccw"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="resetFilters"
                >
                  Reset Filter
                </UButton>
                
                <USelect
                  v-model="statusFilter"
                  :items="statusFilterItems"
                  class="w-full xl:w-42"
                />
                <USelect
                  v-model="decisionFilter"
                  :items="decisionFilterItems"
                  class="w-full xl:w-44"
                />


                <div class="flex flex-wrap items-center gap-2">
                  
                  
                  <UButton
                    v-if="canMutatePengajuan"
                    icon="i-lucide-check-check"
                    color="success"
                    size="sm"
                    :disabled="!selectedCompletePengajuanIds.length || isCompletingPengajuan"
                    :loading="isCompletingPengajuan"
                    @click="openSelectedCompletePengajuan"
                  >
                    Tandai Selesai
                  </UButton>
                </div>
              </div>

              
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-xs text-muted" aria-live="polite">
                {{ totalRows }} item dari {{ filteredPengajuanCount }} pengajuan ditampilkan, termasuk status Selesai.
              </p>

              <p
                v-if="selectedCompletePengajuanIds.length"
                class="text-xs text-muted"
                aria-live="polite"
              >
                {{ selectedCompletePengajuanIds.length }} pengajuan siap diselesaikan.
              </p>
              <p
                v-else-if="selectedIneligibleCount"
                class="text-xs text-muted"
                aria-live="polite"
              >
                Pilihan belum memenuhi aturan Selesai.
              </p>
              
            </div>
          </div>

          <UTable
            v-model:row-selection="rowSelection"
            :get-row-id="(row) => row.key"
            :data="tableRows"
            :columns="columns"
            :loading="isLoadingPengajuan"
            class="w-full"
            :ui="{
              root: 'w-full',
              base: 'w-full min-w-275 table-auto border-separate border-spacing-0',
              th: 'border-b border-muted px-4 py-3 text-xs font-semibold uppercase text-muted',
              td: 'border-b border-muted px-4 py-3 align-top',
              tr: 'transition-colors hover:bg-elevated/40'
            }"
          >
            <template #idPengajuan-cell="{ row }">
              <button
                type="button"
                class="text-left font-mono text-sm font-semibold text-highlighted hover:text-primary"
                @click="openDetail(row.original)"
              >
                {{ row.original.idPengajuan }}
              </button>
              
            </template>

            <template #submittedAt-cell="{ row }">
              <p class="">
                {{ formatDateTime(row.original.submittedAt) }}
              </p>
            </template>

            <template #item-cell="{ row }">
              <p class="">
                Item #{{ row.original.noItem }}
              </p>
            </template>

            <template #pemohon-cell="{ row }">
              <p class="">
                {{ row.original.nama }}
              </p>
            </template>

            <template #model-cell="{ row }">
              <p class="">
                {{ row.original.model }}
              </p>
            </template>

            <template #bagian-cell="{ row }">
              <p class="">
                {{ row.original.bagian }}
              </p>
            </template>

            <template #cabang-cell="{ row }">
              <p class="">
                {{ row.original.cabang }}
              </p>
            </template>

            <template #status-cell="{ row }">
              <UBadge
                :color="statusColorMap[row.original.status]"
                variant="subtle"
              >
                {{ row.original.status }}
              </UBadge>
            </template>

            <template #keputusanItem-cell="{ row }">
              <UBadge
                :color="keputusanColorMap[row.original.keputusanItem]"
                variant="solid"
              >
                {{ row.original.keputusanItem }}
              </UBadge>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex justify-end">
                <UDropdownMenu :items="getRowActions(row.original)">
                  <UButton
                    icon="i-lucide-ellipsis"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    aria-label="Aksi pengajuan"
                  />
                </UDropdownMenu>
              </div>
            </template>

            <template #empty>
              <div class="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <UIcon name="i-lucide-inbox" class="size-8 text-muted" />
                <p class="text-sm font-medium text-highlighted">
                  {{ pengajuanFetchError ? 'Data pengajuan gagal dimuat' : 'Tidak ada pengajuan yang cocok' }}
                </p>
                <p class="max-w-md text-sm text-muted">
                  {{ pengajuanFetchError ? getApiErrorMessage(pengajuanFetchError) : 'Ubah kata kunci atau filter untuk melihat data pengajuan lainnya.' }}
                </p>
              </div>
            </template>
          </UTable>

          <div
            v-if="totalRows"
            class="flex flex-col gap-3 border-t border-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-xs text-muted">
              Halaman {{ currentPage }} menampilkan {{ tableRows.length }} dari {{ totalRows }} item.
            </p>
            <UPagination
              v-model:page="currentPage"
              :items-per-page="pageSize"
              :total="totalRows"
            />
          </div>
        </section>
      </UContainer>

      <USlideover
        v-model:open="detailOpen"
        :title="selectedPengajuan?.idPengajuan || 'Detail Pengajuan'"
        :description="selectedPengajuan ? `${selectedPengajuan.nama} - ${selectedPengajuan.bagian} - ${selectedPengajuan.cabang}` : undefined"
        :ui="{
          content: 'max-w-2xl',
          header: 'items-start gap-3 pr-12',
          body: 'p-0 sm:p-0',
        }"
      >
        <template #actions>
          <UBadge
            v-if="selectedPengajuan"
            :color="getStatusMeta(selectedPengajuan.status).color"
            variant="subtle"
            :icon="getStatusMeta(selectedPengajuan.status).icon"
            :label="selectedPengajuan.status"
            class="mt-0.5 shrink-0"
          />
        </template>

        <template #body>
          <div v-if="selectedPengajuan" class="divide-y divide-default">
            <section class="space-y-5 p-4 sm:p-6">
              <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div class="min-w-0">
                  <p class="text-xs font-medium uppercase text-muted">
                    Pemohon
                  </p>
                  <p class="mt-1 truncate text-sm font-semibold text-highlighted">
                    {{ selectedPengajuan.nama }}
                  </p>
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-medium uppercase text-muted">
                    Pemilik Barang
                  </p>
                  <p class="mt-1 truncate text-sm font-semibold text-highlighted">
                    {{ selectedPengajuan.pemilik }}
                  </p>
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-medium uppercase text-muted">
                    Bagian
                  </p>
                  <p class="mt-1 truncate text-sm font-semibold text-highlighted">
                    {{ selectedPengajuan.bagian }}
                  </p>
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-medium uppercase text-muted">
                    Cabang
                  </p>
                  <p class="mt-1 truncate text-sm font-semibold text-highlighted">
                    {{ selectedPengajuan.cabang }}
                  </p>
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-medium uppercase text-muted">
                    Tanggal Form
                  </p>
                  <p class="mt-1 text-sm font-semibold text-highlighted">
                    {{ formatDate(selectedPengajuan.tanggalForm) }}
                  </p>
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-medium uppercase text-muted">
                    Tanggal Pengajuan
                  </p>
                  <p class="mt-1 text-sm font-semibold text-highlighted">
                    {{ formatDateTime(selectedPengajuan.submittedAt) }}
                  </p>
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-medium uppercase text-muted">
                    Total Item
                  </p>
                  <p class="mt-1 text-sm font-semibold text-highlighted">
                    {{ selectedDetailItems.length }} produk
                  </p>
                </div>
              </div>

              <div class="rounded-lg bg-elevated/50 p-4">
                <p class="text-xs font-medium uppercase text-muted">
                  Alasan Pengajuan
                </p>
                <p class="mt-2 text-sm leading-6 text-highlighted">
                  {{ selectedPengajuan.alasanPengajuan }}
                </p>
                <template v-if="selectedPengajuan.catatanTambahan">
                  <USeparator class="my-4" />
                  <p class="text-xs font-medium uppercase text-muted">
                    Catatan Tambahan
                  </p>
                  <p class="mt-2 text-sm leading-6 text-highlighted">
                    {{ selectedPengajuan.catatanTambahan }}
                  </p>
                </template>
              </div>
            </section>

            <section class="space-y-4 p-4 sm:p-6">
              <div>
                <h3 class="text-sm font-semibold text-highlighted">
                  Item Produk
                </h3>
                <p class="mt-1 text-sm text-muted">
                  Tinjau keputusan, status cetak, dan pengiriman per produk.
                </p>
              </div>

              <div class="space-y-3">
                <article
                  v-for="item in selectedDetailItems"
                  :key="item.noItem"
                  class="rounded-lg border border-muted bg-default p-4"
                >
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div class="min-w-0">
                      <p class="text-xs font-medium uppercase text-muted">
                        Item {{ item.noItem }} - {{ item.produk }}
                      </p>
                      <p class="mt-1 truncate text-base font-semibold text-highlighted">
                        {{ item.model }}
                      </p>
                      <p class="mt-1 font-mono text-xs text-muted">
                        {{ item.nomorSeri }}
                      </p>
                    </div>
                    <div class="flex flex-wrap gap-2 sm:max-w-60 sm:justify-end">
                      <UBadge
                        :color="getDecisionMeta(item.keputusanItem).color"
                        variant="soft"
                        :icon="getDecisionMeta(item.keputusanItem).icon"
                        :label="item.keputusanItem"
                      />
                      <UBadge
                        color="neutral"
                        variant="soft"
                        :label="getOperationalProgress(item)"
                      />
                    </div>
                  </div>

                  <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt class="text-xs font-medium uppercase text-muted">
                        Jenis Kartu
                      </dt>
                      <dd class="mt-1 font-medium text-highlighted">
                        {{ item.jenisKartu || 'Belum dipilih' }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs font-medium uppercase text-muted">
                        Cetak
                      </dt>
                      <dd class="mt-1 font-medium text-highlighted">
                        {{ item.statusCetak }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs font-medium uppercase text-muted">
                        Kirim
                      </dt>
                      <dd class="mt-1 font-medium text-highlighted">
                        {{ item.statusKirim }}
                      </dd>
                    </div>
                  </dl>

                  <p
                    v-if="item.catatanKeputusan"
                    class="mt-4 rounded-md bg-elevated/50 px-3 py-2 text-sm leading-6 text-muted"
                  >
                    {{ item.catatanKeputusan }}
                  </p>

                  <p
                    v-if="item.approvalOverrideReason === 'signed_statement'"
                    class="mt-3 text-xs text-success"
                  >
                    Item disetujui berdasarkan surat pernyataan bertanda tangan.
                  </p>

                  <div
                    v-if="canMutatePengajuan"
                    class="mt-4 flex flex-wrap gap-2"
                  >
                    <UButton
                      size="sm"
                      icon="i-lucide-printer"
                      color="neutral"
                      variant="soft"
                      :disabled="item.keputusanItem !== 'Disetujui' || !item.jenisKartu || item.statusCetak === 'Dicetak' || isSavingItemOperation"
                      @click="markItemPrinted(item)"
                    >
                      Tandai Dicetak
                    </UButton>
                    <UButton
                      size="sm"
                      icon="i-lucide-truck"
                      color="neutral"
                      variant="soft"
                      :disabled="item.keputusanItem !== 'Disetujui' || item.statusCetak !== 'Dicetak' || item.statusKirim === 'Dikirim' || isSavingItemOperation"
                      @click="markItemShipped(item)"
                    >
                      Tandai Dikirim
                    </UButton>
                    <UButton
                      v-if="isAdmin && item.keputusanItem === 'Ditolak' && !hasSignedStatementForItem(selectedPengajuan, item.noItem)"
                      size="sm"
                      icon="i-lucide-file-up"
                      color="primary"
                      variant="soft"
                      :loading="isUploadingSignedStatement && signedStatementTargetItemNo === item.noItem"
                      :disabled="isUploadingSignedStatement"
                      @click="openSignedStatementPicker(item.noItem)"
                    >
                      Unggah Surat Pernyataan
                    </UButton>
                  </div>
                </article>
              </div>
            </section>

            <section class="space-y-6 p-4 sm:p-6">
              <div>
                <div class="mb-3 flex items-center justify-between gap-3">
                  <h3 class="text-sm font-semibold text-highlighted">
                    Dokumen
                  </h3>
                  <span class="text-xs text-muted">
                    {{ selectedPengajuan.files.length }} file
                  </span>
                </div>
                <div class="divide-y divide-default rounded-lg border border-muted">
                  <div
                    v-for="file in selectedPengajuan.files"
                    :key="`${file.name}-${file.itemNos.join('-') || 'submission'}`"
                    class="flex items-center gap-3 px-3 py-3"
                  >
                    <UIcon name="i-lucide-file-text" class="size-4 shrink-0 text-muted" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-highlighted">
                        {{ file.name }}
                      </p>
                      <p class="text-xs text-muted">
                        {{ getFileKindLabel(file.kind) }}<template v-if="file.itemNos.length"> - Item {{ file.itemNos.join(', ') }}</template> - {{ file.mimeType }} - {{ file.sizeLabel }}
                      </p>
                    </div>
                    <UButton
                      :to="getPengajuanFileUrl(selectedPengajuan.idPengajuan, file.id)"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-external-link"
                      label="Lihat file"
                      :aria-label="`Lihat file ${file.name}`"
                    />
                  </div>
                </div>
                <input
                  ref="signedStatementInput"
                  type="file"
                  accept="application/pdf,.pdf"
                  class="sr-only"
                  @change="uploadSelectedSignedStatement"
                >
                <div
                  v-if="isAdmin && rejectedSignedStatementItems.length"
                  class="mt-4 rounded-lg border border-muted bg-elevated/30 p-4"
                >
                  <div class="grid gap-4 sm:grid-cols-[minmax(0,13rem)_1fr] sm:items-start">
                    <UFormField label="Cakupan surat">
                      <USelect
                        v-model="signedStatementScope"
                        :items="signedStatementScopeItems"
                        class="w-full"
                      />
                    </UFormField>
                    <div v-if="signedStatementScope === 'selected_items'" class="space-y-2">
                      <p class="text-xs font-medium uppercase text-muted">
                        Item yang dipulihkan
                      </p>
                      <label
                        v-for="item in rejectedSignedStatementItems"
                        :key="item.noItem"
                        class="flex cursor-pointer items-start gap-3 rounded-md border border-muted px-3 py-2"
                      >
                        <UCheckbox
                          :model-value="signedStatementItemNos.includes(item.noItem)"
                          @update:model-value="toggleSignedStatementItem(item.noItem, $event)"
                        />
                        <span class="min-w-0 text-sm">
                          <span class="block font-medium text-highlighted">Item {{ item.noItem }} - {{ item.model }}</span>
                          <span class="block truncate text-xs text-muted">{{ item.nomorSeri }}<template v-if="item.catatanKeputusan"> - {{ item.catatanKeputusan }}</template></span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
                <UAlert
                  v-if="signedStatementError"
                  class="mt-3"
                  color="error"
                  variant="subtle"
                  icon="i-lucide-circle-alert"
                  :title="signedStatementError"
                />
                <UButton
                  v-if="isAdmin && rejectedSignedStatementItems.length"
                  class="mt-3"
                  label="Unggah Surat Pernyataan"
                  icon="i-lucide-file-up"
                  color="primary"
                  variant="soft"
                  :loading="isUploadingSignedStatement"
                  @click="openSignedStatementPicker()"
                />
                <p
                  v-if="selectedPengajuan.approvalOverrideReason === 'signed_statement'"
                  class="mt-3 text-xs text-success"
                >
                  Pengajuan disetujui berdasarkan surat pernyataan bertanda tangan.
                </p>
              </div>

              <div>
                <h3 class="mb-3 text-sm font-semibold text-highlighted">
                  Riwayat Status
                </h3>
                <ol class="space-y-4 border-s border-muted ps-4">
                  <li
                    v-for="log in selectedDetailStatusLogs"
                    :key="`${log.at}-${log.scope}-${log.noItem ?? 'submission'}-${log.to}`"
                    class="relative"
                  >
                    <span class="absolute -inset-s-5.25 top-1.5 size-2 rounded-full bg-primary" />
                    <div class="flex flex-wrap items-center gap-2">
                      <UBadge
                        :color="getStatusMeta(log.to).color"
                        variant="subtle"
                        :label="log.to"
                      />
                      <span
                        v-if="log.scope === 'item' && log.noItem"
                        class="text-xs font-medium text-muted"
                      >
                        Item {{ log.noItem }}
                      </span>
                      <span class="text-xs text-muted">{{ formatDateTime(log.at) }}</span>
                    </div>
                    <p class="mt-2 text-sm leading-6 text-highlighted">
                      {{ log.note }}
                    </p>
                    <p class="mt-1 text-xs text-muted">
                      {{ log.actor }} - {{ log.from }} ke {{ log.to }}
                    </p>
                  </li>
                </ol>
              </div>
            </section>
          </div>
        </template>
      </USlideover>

      <UModal
        v-model:open="editPengajuanOpen"
        :title="selectedPengajuan ? `Edit ${selectedPengajuan.idPengajuan}` : 'Edit Pengajuan'"
        description="Perubahan data utama akan disimpan ke database."
        :ui="{ footer: 'justify-end' }"
      >
        <template #body>
          <form
            id="edit-pengajuan-form"
            class="space-y-4"
            @submit.prevent="submitEditPengajuan"
          >
            <UAlert
              v-if="editPengajuanError"
              color="error"
              variant="subtle"
              icon="i-lucide-circle-alert"
              :title="editPengajuanError"
            />

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Nama Pemohon" name="nama" required>
                <UInput v-model="editPengajuanForm.nama" class="w-full" />
              </UFormField>
              <UFormField label="Bagian" name="bagian" required>
                <UInput v-model="editPengajuanForm.bagian" class="w-full" />
              </UFormField>
              <UFormField label="Cabang" name="cabang" required>
                <UInput v-model="editPengajuanForm.cabang" class="w-full" />
              </UFormField>
              <UFormField label="Pemilik" name="pemilik" required>
                <UInput v-model="editPengajuanForm.pemilik" class="w-full" />
              </UFormField>
              <UFormField label="Tanggal Form" name="tanggalForm" required>
                <UInput
                  v-model="editPengajuanForm.tanggalForm"
                  type="date"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="Alasan Pengajuan" name="alasanPengajuan" required>
              <UTextarea
                v-model="editPengajuanForm.alasanPengajuan"
                :rows="3"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Catatan Tambahan" name="catatanTambahan">
              <UTextarea
                v-model="editPengajuanForm.catatanTambahan"
                :rows="3"
                class="w-full"
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
          />
        </template>
      </UModal>

      <UModal
        v-model:open="itemDecisionOpen"
        :title="decisionTarget?.decision === 'Ditolak' ? 'Tolak item?' : 'Setujui item?'"
        :description="decisionTarget ? `${decisionTarget.idPengajuan} item ${decisionTarget.noItem}` : undefined"
        :ui="{ footer: 'justify-end' }"
      >
        <template #body>
          <div class="space-y-4">
            <UAlert
              v-if="itemDecisionError"
              color="error"
              variant="subtle"
              icon="i-lucide-circle-alert"
              :title="itemDecisionError"
            />
            <UFormField
              label="Catatan Keputusan"
              name="catatan-keputusan"
              :required="decisionTarget?.decision === 'Ditolak'"
            >
              <UTextarea
                v-model="decisionNote"
                :rows="3"
                class="w-full"
                placeholder="Isi alasan terutama saat item ditolak"
              />
            </UFormField>
          </div>
        </template>

        <template #footer="{ close }">
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            @click="close"
          />
          <UButton
            :label="decisionTarget?.decision === 'Ditolak' ? 'Tolak Item' : 'Setujui Item'"
            :color="decisionTarget?.decision === 'Ditolak' ? 'error' : 'success'"
            :icon="decisionTarget?.decision === 'Ditolak' ? 'i-lucide-x' : 'i-lucide-check'"
            @click="confirmItemDecision"
          />
        </template>
      </UModal>

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
            <div class="rounded-lg border border-muted bg-elevated/30 p-3">
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
        v-model:open="restorePengajuanOpen"
        title="Pulihkan pengajuan?"
        :description="selectedPengajuan ? `${selectedPengajuan.idPengajuan} akan dikembalikan ke status Baru.` : undefined"
        :ui="{ footer: 'justify-end' }"
      >
        <template #body>
          <div class="space-y-4">
            <UAlert
              v-if="restorePengajuanError"
              color="error"
              variant="subtle"
              icon="i-lucide-circle-alert"
              :title="restorePengajuanError"
            />
            <UFormField label="Alasan pemulihan" name="alasan-pemulihan" required>
              <UTextarea
                v-model="restorePengajuanNote"
                :rows="3"
                class="w-full"
                :disabled="isRestoringPengajuan"
                placeholder="Isi alasan pemulihan untuk audit."
              />
            </UFormField>
          </div>
        </template>

        <template #footer="{ close }">
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            :disabled="isRestoringPengajuan"
            @click="close"
          />
          <UButton
            label="Pulihkan ke Baru"
            icon="i-lucide-rotate-ccw"
            color="primary"
            :loading="isRestoringPengajuan"
            @click="confirmRestorePengajuan"
          />
        </template>
      </UModal>

      <UModal
        v-model:open="deletePengajuanOpen"
        title="Hapus pengajuan?"
        :description="selectedPengajuan ? `${selectedPengajuan.idPengajuan} akan dihapus dari daftar aktif.` : undefined"
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
          <p class="text-sm text-muted">
            Penghapusan memakai soft delete dan dicatat pada audit log.
          </p>
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
