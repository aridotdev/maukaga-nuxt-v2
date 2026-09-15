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

type PengajuanFile = {
  name: string
  kind: 'hardcopy' | 'evidence' | 'attachment'
  mimeType: 'application/pdf' | 'image/jpeg'
  sizeLabel: string
}

type StatusLog = {
  at: string
  actor: string
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
  jenisKartu: WarrantyCardType
  statusCetak: PrintStatus
  statusKirim: ShippingStatus
  printedAt?: string
  shippedAt?: string
}

type PengajuanRecord = {
  idPengajuan: string
  submittedAt: string
  nama: string
  bagianCabang: string
  pemilik: string
  alasanPengajuan: string
  tanggalForm: string
  catatanTambahan: string
  status: PengajuanStatus
  catatanAdmin: string
  files: PengajuanFile[]
  items: PengajuanItem[]
  statusLog: StatusLog[]
}

type TableRow = {
  key: string
  idPengajuan: string
  submittedAt: string
  nama: string
  bagianCabang: string
  pemilik: string
  status: PengajuanStatus
  noItem: number
  produk: string
  model: string
  nomorSeri: string
  keputusanItem: ItemDecision
  jenisKartu: WarrantyCardType
  statusCetak: PrintStatus
  statusKirim: ShippingStatus
  fileCount: number
}

type EditPengajuanForm = {
  nama: string
  bagianCabang: string
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

const UCheckbox = resolveComponent('UCheckbox')

const PENGAJUAN_SELESAI_NOTE = 'Kartu garansi sudah diterima dan pengajuan selesai.'

const toast = useToast()
const { isAdmin, isQrcc } = useUserProfile()

const canMutatePengajuan = computed(() => isAdmin.value || isQrcc.value)
const canDeletePengajuan = computed(() => isAdmin.value)

const pengajuanRows = ref<PengajuanRecord[]>(createMockPengajuanRows())
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
const itemDecisionOpen = ref(false)
const isSavingPengajuan = ref(false)
const isDeletingPengajuan = ref(false)
const isCompletingPengajuan = ref(false)
const editPengajuanError = ref('')
const deletePengajuanError = ref('')
const completePengajuanError = ref('')
const itemDecisionError = ref('')
const selectedPengajuan = ref<PengajuanRecord | null>(null)
const completePengajuanTargetIds = ref<string[]>([])
const completePengajuanNote = ref(PENGAJUAN_SELESAI_NOTE)
const decisionTarget = ref<DecisionTarget>(null)
const decisionNote = ref('')

const editPengajuanForm = reactive<EditPengajuanForm>({
  nama: '',
  bagianCabang: '',
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

const allTableRows = computed(() => pengajuanRows.value.flatMap(createTableRows))

const filteredTableRows = computed(() => {
  const needle = normalizeSearch(search.value)

  return allTableRows.value.filter((row) => {
    const matchesStatus = statusFilter.value === 'all' || row.status === statusFilter.value
    const matchesDecision = decisionFilter.value === 'all' || row.keputusanItem === decisionFilter.value
    const matchesBranch = branchFilter.value === 'all' || row.bagianCabang === branchFilter.value
    const matchesModel = modelFilter.value === 'all' || row.model === modelFilter.value
    const matchesSearch = !needle || normalizeSearch([
      row.idPengajuan,
      row.nama,
      row.pemilik,
      row.bagianCabang,
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
    bagianCabang: record.bagianCabang,
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
  detailOpen.value = Boolean(selectedPengajuan.value)
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
  await nextTick()

  Object.assign(selectedPengajuan.value, {
    nama: editPengajuanForm.nama.trim(),
    bagianCabang: editPengajuanForm.bagianCabang.trim(),
    pemilik: editPengajuanForm.pemilik.trim(),
    alasanPengajuan: editPengajuanForm.alasanPengajuan.trim(),
    tanggalForm: editPengajuanForm.tanggalForm.trim(),
    catatanTambahan: editPengajuanForm.catatanTambahan.trim(),
  })

  editPengajuanOpen.value = false
  isSavingPengajuan.value = false
  toast.add({
    title: 'Pengajuan diperbarui',
    description: `${selectedPengajuan.value.idPengajuan} tersimpan di data lokal halaman.`,
    color: 'success',
    icon: 'i-lucide-circle-check',
  })
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
  await nextTick()

  pengajuanRows.value = pengajuanRows.value.filter(row => row.idPengajuan !== record.idPengajuan)
  deletePengajuanOpen.value = false
  selectedPengajuan.value = null
  isDeletingPengajuan.value = false
  toast.add({
    title: 'Pengajuan dihapus dari daftar mock',
    description: `${record.idPengajuan} tidak lagi tampil pada halaman ini.`,
    color: 'success',
    icon: 'i-lucide-circle-check',
  })
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
  await nextTick()

  const updatedIds: string[] = []
  for (const idPengajuan of ids) {
    const record = findPengajuan(idPengajuan)
    if (!record || !canCompleteRecord(record)) continue

    updateRecordStatus(record, 'Selesai', completePengajuanNote.value.trim() || PENGAJUAN_SELESAI_NOTE)
    updatedIds.push(record.idPengajuan)
  }

  if (!updatedIds.length) {
    completePengajuanError.value = 'Belum ada pengajuan terpilih yang memenuhi aturan Selesai.'
    isCompletingPengajuan.value = false
    return
  }

  rowSelection.value = Object.fromEntries(
    Object.entries(rowSelection.value).filter(([key]) => {
      const row = filteredTableRows.value.find(item => item.key === key)
      return row && !updatedIds.includes(row.idPengajuan)
    }),
  )

  completePengajuanOpen.value = false
  isCompletingPengajuan.value = false
  toast.add({
    title: 'Status pengajuan diperbarui',
    description: `${updatedIds.length} pengajuan ditandai Selesai pada data lokal halaman.`,
    color: 'success',
    icon: 'i-lucide-check-check',
  })
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

function confirmItemDecision() {
  const target = decisionTarget.value
  if (!target) return

  if (target.decision === 'Ditolak' && !decisionNote.value.trim()) {
    itemDecisionError.value = 'Catatan wajib diisi saat item ditolak.'
    return
  }

  const record = findPengajuan(target.idPengajuan)
  const item = findItem(record, target.noItem)
  if (!record || !item) return

  item.keputusanItem = target.decision
  item.catatanKeputusan = decisionNote.value.trim()

  if (target.decision === 'Ditolak') {
    item.statusCetak = 'Belum Dicetak'
    item.statusKirim = 'Belum Dikirim'
    item.printedAt = undefined
    item.shippedAt = undefined
  }

  recalculateRecordStatus(record, `Item ${target.noItem} ${target.decision.toLowerCase()}.`)
  itemDecisionOpen.value = false
  toast.add({
    title: 'Keputusan item diperbarui',
    description: `${record.idPengajuan} item ${target.noItem} sekarang ${target.decision}.`,
    color: 'success',
    icon: 'i-lucide-circle-check',
  })
}

function markItemPrinted(item: PengajuanItem) {
  const record = selectedPengajuan.value
  if (!record || !canMutatePengajuan.value || item.keputusanItem !== 'Disetujui') return

  item.statusCetak = 'Dicetak'
  item.printedAt = new Date().toISOString()
  recalculateRecordStatus(record, `Item ${item.noItem} ditandai sudah dicetak.`)
}

function markItemShipped(item: PengajuanItem) {
  const record = selectedPengajuan.value
  if (!record || !canMutatePengajuan.value || item.keputusanItem !== 'Disetujui' || item.statusCetak !== 'Dicetak') return

  item.statusKirim = 'Dikirim'
  item.shippedAt = new Date().toISOString()
  recalculateRecordStatus(record, `Item ${item.noItem} ditandai sudah dikirim.`)
}

function recalculateRecordStatus(record: PengajuanRecord, note: string) {
  const previousStatus = record.status
  const approvedItems = record.items.filter(item => item.keputusanItem === 'Disetujui')
  const rejectedItems = record.items.filter(item => item.keputusanItem === 'Ditolak')

  if (record.items.length > 0 && rejectedItems.length === record.items.length) {
    updateRecordStatus(record, 'Ditolak', note)
    return
  }

  if (approvedItems.length && approvedItems.every(item => item.statusKirim === 'Dikirim')) {
    updateRecordStatus(record, 'Dikirim', note)
    return
  }

  if (approvedItems.length && approvedItems.every(item => item.statusCetak === 'Dicetak')) {
    updateRecordStatus(record, 'Diprint', note)
    return
  }

  if (approvedItems.length) {
    updateRecordStatus(record, 'Disetujui', note)
    return
  }

  if (previousStatus !== 'Baru') updateRecordStatus(record, 'Baru', note)
}

function updateRecordStatus(record: PengajuanRecord, status: PengajuanStatus, note: string) {
  if (record.status === status) return

  const previous = record.status
  record.status = status
  record.catatanAdmin = note
  record.statusLog.push({
    at: new Date().toISOString(),
    actor: 'Admin Frontend',
    from: previous,
    to: status,
    note,
  })
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

function findItem(record: PengajuanRecord | null, noItem: number) {
  return record?.items.find(item => item.noItem === noItem) ?? null
}

function fillEditForm(record: PengajuanRecord) {
  editPengajuanForm.nama = record.nama
  editPengajuanForm.bagianCabang = record.bagianCabang
  editPengajuanForm.pemilik = record.pemilik
  editPengajuanForm.alasanPengajuan = record.alasanPengajuan
  editPengajuanForm.tanggalForm = record.tanggalForm
  editPengajuanForm.catatanTambahan = record.catatanTambahan
}

function validateEditForm(form: EditPengajuanForm) {
  if (!form.nama.trim()) return 'Nama pemohon wajib diisi.'
  if (!form.bagianCabang.trim()) return 'Bagian atau cabang wajib diisi.'
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

function createMockPengajuanRows(): PengajuanRecord[] {
  return [{
    idPengajuan: 'KG-20260915-0005',
    submittedAt: '2026-09-15T09:24:00+07:00',
    nama: 'Rina Maharani',
    bagianCabang: 'Karawang',
    pemilik: 'Toko Sumber Teknik',
    alasanPengajuan: 'Kartu garansi hilang saat proses administrasi toko.',
    tanggalForm: '2026-09-15',
    catatanTambahan: 'Hardcopy sudah dicek oleh QRCC.',
    status: 'Baru',
    catatanAdmin: '',
    files: [
      { name: 'hardcopy.pdf', kind: 'hardcopy', mimeType: 'application/pdf', sizeLabel: '1.2 MB' },
      { name: 'bukti_01.jpg', kind: 'evidence', mimeType: 'image/jpeg', sizeLabel: '840 KB' },
    ],
    items: [
      {
        noItem: 1,
        produk: 'Mesin Cuci',
        model: 'MW-8800X',
        nomorSeri: '0009217714',
        keputusanItem: 'Menunggu',
        jenisKartu: 'Local',
        statusCetak: 'Belum Dicetak',
        statusKirim: 'Belum Dikirim',
      },
      {
        noItem: 2,
        produk: 'Kulkas',
        model: 'RF-220S',
        nomorSeri: 'SN-009812',
        keputusanItem: 'Menunggu',
        jenisKartu: 'Import',
        statusCetak: 'Belum Dicetak',
        statusKirim: 'Belum Dikirim',
      },
    ],
    statusLog: [{
      at: '2026-09-15T09:24:00+07:00',
      actor: 'Admin Form Manual',
      from: '-',
      to: 'Baru',
      note: 'Pengajuan dibuat dari form manual admin.',
    }],
  }, {
    idPengajuan: 'KG-20260915-0004',
    submittedAt: '2026-09-15T08:15:00+07:00',
    nama: 'Bagas Pranata',
    bagianCabang: 'Bandung',
    pemilik: 'PT Mitra Elektronik',
    alasanPengajuan: 'Kartu rusak dan nomor serial masih valid.',
    tanggalForm: '2026-09-14',
    catatanTambahan: '',
    status: 'Disetujui',
    catatanAdmin: 'Satu item disetujui, satu item perlu koreksi data.',
    files: [
      { name: 'hardcopy.pdf', kind: 'hardcopy', mimeType: 'application/pdf', sizeLabel: '980 KB' },
    ],
    items: [
      {
        noItem: 1,
        produk: 'AC',
        model: 'AC-12DX',
        nomorSeri: 'AC00001873',
        keputusanItem: 'Disetujui',
        jenisKartu: 'Local',
        statusCetak: 'Belum Dicetak',
        statusKirim: 'Belum Dikirim',
      },
      {
        noItem: 2,
        produk: 'AC',
        model: 'AC-09DX',
        nomorSeri: 'AC00001874',
        keputusanItem: 'Menunggu',
        jenisKartu: 'Local',
        statusCetak: 'Belum Dicetak',
        statusKirim: 'Belum Dikirim',
      },
    ],
    statusLog: [{
      at: '2026-09-15T08:15:00+07:00',
      actor: 'Admin Form Manual',
      from: '-',
      to: 'Baru',
      note: 'Pengajuan dibuat dari form manual admin.',
    }, {
      at: '2026-09-15T08:44:00+07:00',
      actor: 'QRCC',
      from: 'Baru',
      to: 'Disetujui',
      note: 'Item 1 disetujui.',
    }],
  }, {
    idPengajuan: 'KG-20260914-0012',
    submittedAt: '2026-09-14T15:40:00+07:00',
    nama: 'Siti Handayani',
    bagianCabang: 'Surabaya',
    pemilik: 'CV Prima Jaya',
    alasanPengajuan: 'Penggantian kartu setelah koreksi data pelanggan.',
    tanggalForm: '2026-09-14',
    catatanTambahan: 'Label pengiriman menunggu konfirmasi alamat.',
    status: 'Diprint',
    catatanAdmin: 'Seluruh item disetujui sudah dicetak.',
    files: [
      { name: 'hardcopy.pdf', kind: 'hardcopy', mimeType: 'application/pdf', sizeLabel: '1.6 MB' },
      { name: 'lampiran_01.pdf', kind: 'attachment', mimeType: 'application/pdf', sizeLabel: '620 KB' },
    ],
    items: [
      {
        noItem: 1,
        produk: 'Water Heater',
        model: 'WH-15L',
        nomorSeri: 'WH15000901',
        keputusanItem: 'Disetujui',
        jenisKartu: 'Import',
        statusCetak: 'Dicetak',
        statusKirim: 'Belum Dikirim',
        printedAt: '2026-09-15T10:05:00+07:00',
      },
    ],
    statusLog: [{
      at: '2026-09-14T15:40:00+07:00',
      actor: 'Admin Form Manual',
      from: '-',
      to: 'Baru',
      note: 'Pengajuan dibuat dari form manual admin.',
    }, {
      at: '2026-09-15T10:05:00+07:00',
      actor: 'QRCC',
      from: 'Disetujui',
      to: 'Diprint',
      note: 'Item 1 ditandai sudah dicetak.',
    }],
  }, {
    idPengajuan: 'KG-20260913-0008',
    submittedAt: '2026-09-13T11:05:00+07:00',
    nama: 'Yusuf Akbar',
    bagianCabang: 'Jakarta',
    pemilik: 'Toko Mega Baru',
    alasanPengajuan: 'Cetak ulang kartu untuk item yang sudah dikirim.',
    tanggalForm: '2026-09-13',
    catatanTambahan: '',
    status: 'Dikirim',
    catatanAdmin: 'Item disetujui sudah dikirim.',
    files: [
      { name: 'hardcopy.pdf', kind: 'hardcopy', mimeType: 'application/pdf', sizeLabel: '1.1 MB' },
      { name: 'bukti_01.jpg', kind: 'evidence', mimeType: 'image/jpeg', sizeLabel: '760 KB' },
    ],
    items: [
      {
        noItem: 1,
        produk: 'TV LED',
        model: 'TV-55Q9',
        nomorSeri: 'TV00044590',
        keputusanItem: 'Disetujui',
        jenisKartu: 'Import',
        statusCetak: 'Dicetak',
        statusKirim: 'Dikirim',
        printedAt: '2026-09-14T13:12:00+07:00',
        shippedAt: '2026-09-15T09:00:00+07:00',
      },
      {
        noItem: 2,
        produk: 'TV LED',
        model: 'TV-43B2',
        nomorSeri: 'TV00044591',
        keputusanItem: 'Ditolak',
        catatanKeputusan: 'Nomor serial tidak sesuai hardcopy.',
        jenisKartu: 'Local',
        statusCetak: 'Belum Dicetak',
        statusKirim: 'Belum Dikirim',
      },
    ],
    statusLog: [{
      at: '2026-09-13T11:05:00+07:00',
      actor: 'Admin Form Manual',
      from: '-',
      to: 'Baru',
      note: 'Pengajuan dibuat dari form manual admin.',
    }, {
      at: '2026-09-15T09:00:00+07:00',
      actor: 'QRCC',
      from: 'Diprint',
      to: 'Dikirim',
      note: 'Item 1 ditandai sudah dikirim.',
    }],
  }, {
    idPengajuan: 'KG-20260912-0003',
    submittedAt: '2026-09-12T14:18:00+07:00',
    nama: 'Maya Lestari',
    bagianCabang: 'Medan',
    pemilik: 'UD Sejahtera',
    alasanPengajuan: 'Kartu lama salah cetak nama pemilik.',
    tanggalForm: '2026-09-12',
    catatanTambahan: 'Pengajuan sudah diterima oleh cabang.',
    status: 'Selesai',
    catatanAdmin: PENGAJUAN_SELESAI_NOTE,
    files: [
      { name: 'hardcopy.pdf', kind: 'hardcopy', mimeType: 'application/pdf', sizeLabel: '910 KB' },
    ],
    items: [
      {
        noItem: 1,
        produk: 'Dispenser',
        model: 'DP-330',
        nomorSeri: 'DP00033210',
        keputusanItem: 'Disetujui',
        jenisKartu: 'Local',
        statusCetak: 'Dicetak',
        statusKirim: 'Dikirim',
        printedAt: '2026-09-13T10:00:00+07:00',
        shippedAt: '2026-09-14T12:30:00+07:00',
      },
    ],
    statusLog: [{
      at: '2026-09-12T14:18:00+07:00',
      actor: 'Admin Form Manual',
      from: '-',
      to: 'Baru',
      note: 'Pengajuan dibuat dari form manual admin.',
    }, {
      at: '2026-09-14T16:20:00+07:00',
      actor: 'Admin',
      from: 'Dikirim',
      to: 'Selesai',
      note: PENGAJUAN_SELESAI_NOTE,
    }],
  }]
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

              
            </div>
          </div>

          <UTable
            v-model:row-selection="rowSelection"
            :get-row-id="(row) => row.key"
            :data="tableRows"
            :columns="columns"
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

            <template #cabang-cell="{ row }">
              <p class="">
                {{ row.original.bagianCabang }}
              </p>
            </template>

            <template #status-cell="{ row }">
              <p class="">
                {{ row.original.status }}
              </p>
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
                  Tidak ada pengajuan yang cocok
                </p>
                <p class="max-w-md text-sm text-muted">
                  Ubah kata kunci atau filter untuk melihat data pengajuan mock lainnya.
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
        :description="selectedPengajuan ? `${selectedPengajuan.nama} - ${selectedPengajuan.bagianCabang}` : undefined"
      >
        <template #body>
          <div v-if="selectedPengajuan" class="space-y-6">
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-lg border border-muted p-3">
                <p class="text-xs font-medium uppercase text-muted">
                  Pemohon
                </p>
                <p class="mt-1 font-medium text-highlighted">
                  {{ selectedPengajuan.nama }}
                </p>
                <p class="text-sm text-muted">
                  {{ selectedPengajuan.pemilik }}
                </p>
              </div>
              <div class="rounded-lg border border-muted p-3">
                <p class="text-xs font-medium uppercase text-muted">
                  Tanggal Form
                </p>
                <p class="mt-1 font-medium text-highlighted">
                  {{ formatDate(selectedPengajuan.tanggalForm) }}
                </p>
                <p class="text-sm text-muted">
                  {{ selectedPengajuan.bagianCabang }}
                </p>
              </div>
            </div>

            <div>
              <p class="text-xs font-medium uppercase text-muted">
                Alasan Pengajuan
              </p>
              <p class="mt-2 text-sm leading-6 text-highlighted">
                {{ selectedPengajuan.alasanPengajuan }}
              </p>
            </div>

            <div>
              <div class="mb-3 flex items-center justify-between gap-3">
                <h3 class="font-semibold text-highlighted">
                  Item Pengajuan
                </h3>
                <UBadge
                  :color="getStatusMeta(selectedPengajuan.status).color"
                  variant="subtle"
                  :label="selectedPengajuan.status"
                />
              </div>
              <div class="space-y-3">
                <div
                  v-for="item in selectedDetailItems"
                  :key="item.noItem"
                  class="rounded-lg border border-muted p-3"
                >
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div class="min-w-0">
                      <p class="text-xs font-medium uppercase text-muted">
                        Item {{ item.noItem }} - {{ item.produk }}
                      </p>
                      <p class="mt-1 font-medium text-highlighted">
                        {{ item.model }}
                      </p>
                      <p class="mt-1 font-mono text-xs text-muted">
                        {{ item.nomorSeri }}
                      </p>
                      <p
                        v-if="item.catatanKeputusan"
                        class="mt-2 text-xs text-muted"
                      >
                        {{ item.catatanKeputusan }}
                      </p>
                    </div>
                    <div class="flex flex-wrap gap-2 sm:justify-end">
                      <UBadge
                        :color="getDecisionMeta(item.keputusanItem).color"
                        variant="soft"
                        :label="item.keputusanItem"
                      />
                      <UBadge
                        color="neutral"
                        variant="soft"
                        :label="getOperationalProgress(item)"
                      />
                    </div>
                  </div>

                  <div
                    v-if="canMutatePengajuan"
                    class="mt-3 flex flex-wrap gap-2"
                  >
                    <UButton
                      size="sm"
                      icon="i-lucide-printer"
                      color="neutral"
                      variant="soft"
                      :disabled="item.keputusanItem !== 'Disetujui' || item.statusCetak === 'Dicetak'"
                      @click="markItemPrinted(item)"
                    >
                      Tandai Dicetak
                    </UButton>
                    <UButton
                      size="sm"
                      icon="i-lucide-truck"
                      color="neutral"
                      variant="soft"
                      :disabled="item.keputusanItem !== 'Disetujui' || item.statusCetak !== 'Dicetak' || item.statusKirim === 'Dikirim'"
                      @click="markItemShipped(item)"
                    >
                      Tandai Dikirim
                    </UButton>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 class="mb-3 font-semibold text-highlighted">
                Dokumen
              </h3>
              <div class="space-y-2">
                <div
                  v-for="file in selectedPengajuan.files"
                  :key="file.name"
                  class="flex items-center justify-between gap-3 rounded-lg border border-muted px-3 py-2"
                >
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-highlighted">
                      {{ file.name }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ file.kind }} - {{ file.mimeType }} - {{ file.sizeLabel }}
                    </p>
                  </div>
                  <UIcon name="i-lucide-lock-keyhole" class="size-4 shrink-0 text-muted" />
                </div>
              </div>
            </div>

            <div>
              <h3 class="mb-3 font-semibold text-highlighted">
                Riwayat Status
              </h3>
              <div class="space-y-3">
                <div
                  v-for="log in selectedDetailStatusLogs"
                  :key="`${log.at}-${log.to}`"
                  class="rounded-lg border border-muted p-3"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge
                      :color="getStatusMeta(log.to).color"
                      variant="subtle"
                      :label="log.to"
                    />
                    <span class="text-xs text-muted">{{ formatDateTime(log.at) }}</span>
                  </div>
                  <p class="mt-2 text-sm text-highlighted">
                    {{ log.note }}
                  </p>
                  <p class="mt-1 text-xs text-muted">
                    {{ log.actor }}: {{ log.from }} ke {{ log.to }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </template>
      </USlideover>

      <UModal
        v-model:open="editPengajuanOpen"
        :title="selectedPengajuan ? `Edit ${selectedPengajuan.idPengajuan}` : 'Edit Pengajuan'"
        description="Perubahan ini hanya tersimpan di state lokal halaman."
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
              <UFormField label="Bagian / Cabang" name="bagianCabang" required>
                <UInput v-model="editPengajuanForm.bagianCabang" class="w-full" />
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
        :description="`${completePengajuanTargetIds.length} pengajuan akan diubah menjadi Selesai pada data lokal halaman.`"
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
              <p class="mt-1 break-words font-mono text-sm text-highlighted">
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
        v-model:open="deletePengajuanOpen"
        title="Hapus pengajuan?"
        :description="selectedPengajuan ? `${selectedPengajuan.idPengajuan} akan dihapus dari data mock halaman ini.` : undefined"
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
            Penghapusan backend nantinya harus berupa soft delete dengan audit log. Di halaman mock ini aksi hanya menghapus dari daftar sementara.
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
