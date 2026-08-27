<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

definePageMeta({
  layout: 'cs'
})

type ToastColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

type DraftItem = {
  produk?: string
  model?: string
  nomorSeri?: string
}

type DraftData = {
  idPengajuan?: string
  status?: string
  nama?: string
  bagianCabang?: string
  pemilik?: string
  alasanPengajuan?: string
  tanggalForm?: string
  catatanTambahan?: string
  items?: DraftItem[]
}

type LoadDraftReference = {
  idPengajuan?: string
  fromUrl?: boolean
  source?: 'manual' | 'stored' | 'url'
}

type PrintRow = {
  label: string
  value: string
}

const toast = useToast()
const route = useRoute()
const router = useRouter()
const { callApi: callAPI } = useCsAppsScriptApi()
const draftReferenceStorage = useCsDraftReferenceStorage()

const searchId = ref('')
const currentDraftId = ref('')
const loadedDraft = ref<DraftData | null>(null)
const hasSearchInputError = ref(false)
const isLoadingDraft = ref(false)
const isLoadingStoredDraft = ref(false)
const showPrintPreview = ref(false)
const searchControlSize = ref<'md' | 'xl'>('xl')
let mobileMediaQueryList: MediaQueryList | null = null

const isDraftReady = computed(() => !!currentDraftId.value && !!loadedDraft.value)
const printPayload = computed(() => loadedDraft.value || {})
const printId = computed(() => currentDraftId.value || '-')
const printTanggalForm = computed(() => formatDate(printPayload.value.tanggalForm || ''))
const printMetadataRows = computed<PrintRow[]>(() => {
  const payload = printPayload.value
  const rows: PrintRow[] = [
    { label: 'ID Pengajuan', value: printId.value },
    { label: 'Nama', value: payload.nama || '' },
    { label: 'Bagian/Cabang', value: payload.bagianCabang || '' },
    { label: 'Pemilik', value: payload.pemilik || '' },
    { label: 'Alasan Pengajuan', value: payload.alasanPengajuan || '' },
    { label: 'Catatan Tambahan', value: payload.catatanTambahan || '-' }
  ]

  if (payload.items?.length === 1) {
    rows.push(
      { label: 'Produk', value: payload.items[0]?.produk || '' },
      { label: 'Model', value: payload.items[0]?.model || '' },
      { label: 'Nomor Seri', value: payload.items[0]?.nomorSeri || '' }
    )
  }

  return rows
})
const printHasMultipleItems = computed(() => (printPayload.value.items?.length || 0) > 1)
const printDraft = usePrintWithFilename('Pengajuan', () => printId.value)

onMounted(() => {
  initializeDraftResume()
  initializeSearchControlSize()
})

onBeforeUnmount(() => {
  mobileMediaQueryList?.removeEventListener('change', updateSearchControlSize)
})

watch(searchId, () => {
  hasSearchInputError.value = false
})

function showToast(title: string, color: ToastColor = 'info', description?: string) {
  toast.add({ title, description, color })
}

function initializeDraftResume() {
  const fromUrl = getDraftReferenceFromUrl()
  if (fromUrl.idPengajuan) {
    searchId.value = fromUrl.idPengajuan
    void handleLoadDraft({ idPengajuan: fromUrl.idPengajuan, fromUrl: true, source: 'url' })
  }
}

function initializeSearchControlSize() {
  if (!import.meta.client) return

  mobileMediaQueryList = window.matchMedia('(max-width: 767px)')
  updateSearchControlSize(mobileMediaQueryList)
  mobileMediaQueryList.addEventListener('change', updateSearchControlSize)
}

function updateSearchControlSize(event: MediaQueryList | MediaQueryListEvent) {
  searchControlSize.value = event.matches ? 'md' : 'xl'
}

async function handleLoadDraft(reference: LoadDraftReference = {}) {
  let idPengajuan = String(reference.idPengajuan || searchId.value || '').trim()
  const saved = getStoredDraftReference()

  if (!idPengajuan && saved.idPengajuan) idPengajuan = saved.idPengajuan

  if (!idPengajuan) {
    hasSearchInputError.value = true
    showToast('Masukkan ID Pengajuan, klik Pengajuan Terakhir, atau buka Link Pengajuan.', 'error')
    return
  }

  const loadingState = reference.source === 'stored' ? isLoadingStoredDraft : isLoadingDraft
  loadingState.value = true
  hasSearchInputError.value = false
  showPrintPreview.value = false

  try {
    // Print ulang berlaku untuk semua status (termasuk yang sudah final),
    // pakai action khusus yang tidak butuh resumeToken & tidak filter status.
    const result = await callAPI<DraftData>('getPengajuanForPrint', { idPengajuan })
    if (!result.success) throw new Error(result.error || 'Pengajuan gagal dimuat')

    idPengajuan = result.data?.idPengajuan || idPengajuan
    loadedDraft.value = normalizeDraftData(result.data || {}, idPengajuan)
    setDraftReference(idPengajuan)

    if (reference.fromUrl) clearResumeParamsFromUrl()

    showToast('Pengajuan berhasil dimuat', 'success', `ID Pengajuan: ${idPengajuan} siap dicetak ulang.`)
  } catch (error) {
    loadedDraft.value = null
    currentDraftId.value = ''
    showToast('Pengajuan gagal dimuat', 'error', getErrorMessage(error))
  } finally {
    loadingState.value = false
  }
}

function handleReviewPrint() {
  if (!isDraftReady.value) {
    showToast('Data pengajuan belum dimuat. Cari ID Pengajuan terlebih dahulu.', 'error')
    return
  }
  showPrintPreview.value = true
}

function backToForm() {
  showPrintPreview.value = false
}

function setDraftReference(idPengajuan: string) {
  currentDraftId.value = idPengajuan || ''
  searchId.value = currentDraftId.value

  draftReferenceStorage.save({ idPengajuan: currentDraftId.value })
}

function getStoredDraftReference(): { idPengajuan: string } {
  return { idPengajuan: draftReferenceStorage.get().idPengajuan }
}

function getDraftReferenceFromUrl(): { idPengajuan: string } {
  return {
    idPengajuan: getQueryValue(route.query.id) || getQueryValue(route.query.idPengajuan)
  }
}

function clearResumeParamsFromUrl() {
  const query = { ...route.query }
  delete query.id
  delete query.idPengajuan
  void router.replace({ path: route.path, query })
}

function getQueryValue(value: unknown) {
  if (Array.isArray(value)) return String(value[0] || '').trim()
  return String(value || '').trim()
}

function normalizeDraftData(data: DraftData, fallbackId: string): DraftData {
  return {
    idPengajuan: data.idPengajuan || fallbackId,
    status: data.status || '',
    nama: data.nama || '',
    bagianCabang: data.bagianCabang || '',
    pemilik: data.pemilik || '',
    alasanPengajuan: data.alasanPengajuan || '',
    tanggalForm: data.tanggalForm || '',
    catatanTambahan: data.catatanTambahan || '',
    items: (data.items || []).map(item => ({
      produk: item.produk || '',
      model: item.model || '',
      nomorSeri: item.nomorSeri || ''
    }))
  }
}

function formatDate(value: string) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID') : '-'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <section class="mx-auto flex min-h-full w-full max-w-4xl flex-col md:p-8">
    <Transition name="layout" mode="out-in">
      <!-- STATE: FORM CARI -->
      <div v-if="!showPrintPreview" class="flex grow flex-col">
        <div class="mb-8 grow rounded-3xl border border-white/60 bg-white/45 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-2xl transition-all duration-500 md:p-8">
          <div class="mx-auto max-w-xl py-6 text-center">
            <div class="mb-4 inline-flex items-center justify-center rounded-2xl bg-blue-100 p-3 text-blue-600">
              <UIcon name="i-lucide-printer-check" class="size-8" />
            </div>
            <h2 class="mb-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Print Ulang Pengajuan
            </h2>
            <p class="mb-8 text-sm text-slate-500">
              Masukkan ID Pengajuan untuk memuat dan mencetak ulang form yang sudah pernah dibuat.
            </p>

            <div class="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <UInput
                v-model="searchId"
                type="text"
                class="w-full md:flex-1"
                :size="searchControlSize"
                color="neutral"
                variant="outline"
                :highlight="hasSearchInputError"
                :ui="{ base: 'rounded-xl bg-white/80 px-4 py-3.5 font-mono uppercase shadow-inner transition-colors focus:bg-white' }"
                placeholder="Contoh: KG-YYYYMMDD-0001"
                autocomplete="off"
                @keyup.enter="handleLoadDraft({ source: 'manual' })"
              />
              <UButton
                type="button"
                class="w-full justify-center rounded-xl px-8 py-3.5 font-semibold shadow-md transition-all active:scale-95 md:w-auto"
                color="primary"
                variant="solid"
                :size="searchControlSize"
                icon="i-lucide-search"
                :label="isLoadingDraft ? 'Mencari...' : 'Cari Pengajuan'"
                :loading="isLoadingDraft"
                :disabled="isLoadingDraft || isLoadingStoredDraft"
                @click="handleLoadDraft({ source: 'manual' })"
              />
            </div>
          </div>
        </div>

        <!-- HASIL PENCARIAN -->
        <Transition name="slide-fade">
          <div v-if="isDraftReady" class="relative overflow-hidden rounded-2xl border border-white/60 bg-white/60 p-6 text-center shadow-sm backdrop-blur-md">
            <div class="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-500 opacity-20 blur-3xl transition-colors duration-1000" />

            <div class="relative z-10">
              <div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <UIcon name="i-lucide-file-check-2" class="size-7" />
              </div>

              <span class="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Pengajuan Dimuat</span>
              <h3 class="mb-4 break-all font-mono text-2xl font-black text-slate-800">
                {{ currentDraftId || '-' }}
              </h3>

              <div class="mx-auto mb-4 grid max-w-xl gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left text-xs text-slate-500 sm:grid-cols-2">
                <div class="flex items-center justify-between gap-3">
                  <span>Nama</span>
                  <span class="text-right font-semibold text-slate-700">{{ loadedDraft?.nama || '-' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span>Bagian/Cabang</span>
                  <span class="text-right font-semibold text-slate-700">{{ loadedDraft?.bagianCabang || '-' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span>Pemilik</span>
                  <span class="text-right font-semibold text-slate-700">{{ loadedDraft?.pemilik || '-' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span>Tgl. Form</span>
                  <span class="text-right font-semibold text-slate-700">{{ loadedDraft?.tanggalForm || '-' }}</span>
                </div>
                <div v-if="loadedDraft?.status" class="flex items-center justify-between gap-3 sm:col-span-2">
                  <span>Status</span>
                  <span class="text-right font-semibold text-slate-700">{{ loadedDraft.status }}</span>
                </div>
              </div>

              <div class="mx-auto mb-4 max-w-xl rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <span class="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Alasan Pengajuan</span>
                <p class="text-sm font-medium leading-relaxed text-slate-600">
                  {{ loadedDraft?.alasanPengajuan || '-' }}
                </p>
              </div>

              <div class="mx-auto mb-6 max-w-2xl rounded-xl border border-slate-100 bg-white/70 p-4 text-left shadow-sm">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Item Produk</span>
                  <span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                    {{ loadedDraft?.items?.length || 0 }} item
                  </span>
                </div>

                <div class="max-h-55 space-y-3 overflow-y-auto pr-2">
                  <div
                    v-for="(item, idx) in loadedDraft?.items"
                    :key="idx"
                    class="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div class="min-w-0">
                      <p class="truncate font-bold text-slate-800">{{ item.model || 'Model tidak diketahui' }}</p>
                      <p class="mt-0.5 truncate text-xs text-slate-500">{{ item.produk || 'Produk' }}</p>
                    </div>
                    <div class="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-100 bg-white px-2.5 py-1.5">
                      <UIcon name="i-lucide-barcode" class="size-4 shrink-0 text-slate-400" />
                      <span class="break-all font-mono text-sm font-semibold text-slate-700">
                        {{ item.nomorSeri || 'N/A' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex flex-col-reverse justify-center gap-3 sm:flex-row">
                <UButton
                  type="button"
                  class="w-full justify-center rounded-xl px-8 py-3.5 font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 sm:w-auto"
                  color="primary"
                  variant="solid"
                  size="lg"
                  icon="i-lucide-printer"
                  label="Review & Cetak Ulang"
                  @click="handleReviewPrint"
                />
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- STATE: PREVIEW CETAK -->
      <section
        v-else
        id="section-print"
        class="mx-auto max-h-[297mm] max-w-[210mm] bg-white p-6 text-sm text-slate-900"
      >
        <div class="no-print mb-6 rounded-2xl border border-white/60 bg-white/60 p-4 text-slate-900 shadow-sm backdrop-blur-md">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span class="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Preview Cetak</span>
              <h2 class="break-all font-mono text-lg font-bold text-slate-900">
                {{ printId }}
              </h2>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row">
              <UButton
                type="button"
                label="Kembali"
                icon="i-lucide-arrow-left"
                color="neutral"
                variant="subtle"
                @click="backToForm"
              />
              <UButton
                type="button"
                label="Cetak"
                icon="i-lucide-printer"
                color="primary"
                @click="printDraft"
              />
            </div>
          </div>
        </div>

        <div class="border-slate-300 text-center">
          <h1 class="text-xl font-bold">
            Form Permintaan Kartu Garansi
          </h1>
        </div>

        <table class="mt-5 w-full border-collapse text-sm">
          <tbody>
            <tr v-for="row in printMetadataRows" :key="row.label">
              <th class="w-1/3 border border-slate-400 bg-slate-100 p-1 text-left">
                {{ row.label }}
              </th>
              <td class="border border-slate-400 p-1">
                {{ row.value }}
              </td>
            </tr>
          </tbody>
        </table>

        <template v-if="printHasMultipleItems">
          <h2 class="mt-4 font-bold">
            Daftar Item
          </h2>
          <table class="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th class="border border-slate-400 bg-slate-100 p-1">
                  No
                </th>
                <th class="border border-slate-400 bg-slate-100 p-1">
                  Produk
                </th>
                <th class="border border-slate-400 bg-slate-100 p-1">
                  Model
                </th>
                <th class="border border-slate-400 bg-slate-100 p-1">
                  Nomor Seri
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in printPayload.items" :key="`${item.model}-${item.nomorSeri}-${index}`">
                <td class="border border-slate-400 p-1 text-center">
                  {{ index + 1 }}
                </td>
                <td class="border border-slate-400 p-1">
                  {{ item.produk }}
                </td>
                <td class="border border-slate-400 p-1">
                  {{ item.model }}
                </td>
                <td class="border border-slate-400 p-1">
                  {{ item.nomorSeri }}
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <div class="mt-8 text-[9px]">
          <div class="flex items-start gap-4">
            <p class="w-[30%] pt-1 text-[11px] font-semibold">
              Tanggal Form : {{ printTanggalForm }}
            </p>
            <table class="w-[70%] table-fixed border-collapse">
              <thead>
                <tr>
                  <th class="w-1/3 border border-black p-1 text-center font-bold">
                    Diajukan
                  </th>
                  <th class="w-1/3 border border-black p-1 text-center font-bold">
                    Diketahui
                  </th>
                  <th class="w-1/3 border border-black p-1 text-center font-bold">
                    Disetujui
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="h-16 w-1/3 border border-black p-1" />
                  <td class="h-16 w-1/3 border border-black p-1" />
                  <td class="h-16 w-1/3 border border-black p-1" />
                </tr>
                <tr>
                  <td class="w-1/3 border border-black p-1 text-center font-bold" />
                  <td class="w-1/3 border border-black p-1 text-center font-bold">
                    CS Head
                  </td>
                  <td class="w-1/3 border border-black p-1 text-center font-bold">
                    Branch Manager
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-8 flex items-start gap-4">
            <p class="w-[30%] pt-1 text-[11px] font-semibold">
              Disetujui dan diberikan :
            </p>
            <table class="w-[47%] table-fixed border-collapse">
              <thead>
                <tr>
                  <th class="w-1/2 border border-black p-1 text-center font-bold">
                    Diberikan
                  </th>
                  <th class="w-1/2 border border-black p-1 text-center font-bold">
                    Disetujui
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="h-16 w-1/2 border border-black p-1" />
                  <td class="h-16 w-1/2 border border-black p-1" />
                </tr>
                <tr>
                  <td class="w-1/2 border border-black p-1 text-center font-bold">
                    Controller
                  </td>
                  <td class="w-1/2 border border-black p-1 text-center font-bold">
                    QRCC Div. Head
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-2 text-[9px] leading-tight">
          <p class="font-bold">
            Catatan:
          </p>
          <p>1. Untuk permintaan Kartu Garansi mohon diisi nama jelasnya.</p>
          <p>2. Untuk permintaan melalui cabang, kolom diketahui harus diisi oleh kepala service.</p>
        </div>
      </section>
    </Transition>
  </section>
</template>

<style scoped>
/* Vue Transitions untuk Micro Interactions */
.layout-enter-active,
.layout-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.layout-enter-from {
  opacity: 0;
  transform: scale(0.98) translateY(10px);
}
.layout-leave-to {
  opacity: 0;
  transform: scale(0.98) translateY(-10px);
}

.slide-fade-enter-active {
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.2);
}
.slide-fade-leave-active {
  transition: all 0.3s ease-in;
}
.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>

<style>
@media print {
  body * {
    visibility: hidden !important;
  }

  #section-print,
  #section-print * {
    visibility: visible !important;
  }

  #section-print {
    display: block !important;
    left: 0 !important;
    margin: 0 auto !important;
    max-width: none !important;
    padding: 0 !important;
    position: absolute !important;
    right: 0 !important;
    top: 0 !important;
    width: 100% !important;
  }

  .no-print,
  .no-print * {
    display: none !important;
    visibility: hidden !important;
  }

  @page {
    size: A4;
    margin: 5mm;
  }

  body {
    background: #fff !important;
  }
}
</style>
