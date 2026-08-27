<script setup lang="ts">
import * as z from 'zod'
import type { FormErrorEvent, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'cs'
})

defineOptions({
  name: 'CsNewPage'
})

type ToastColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

type ProductItem = {
  model: string
  namaProduk: string
  nomorSeri: string
}

const pengajuanSchema = z.object({
  namaPemohon: z.string().trim().min(1, 'Nama Pemohon wajib diisi'),
  bagianCabang: z.string().trim().min(1, 'Bagian/Cabang wajib diisi'),
  namaPemilikBarang: z.string().trim().min(1, 'Nama Pemilik Barang wajib diisi'),
  alasanPengajuan: z.string().trim().min(1, 'Alasan Pengajuan wajib diisi'),
  catatanTambahan: z.string().optional().default(''),
  tanggalForm: z
    .string()
    .min(1, 'Tanggal Form wajib diisi')
    .refine(
      (iso) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
        const [y = 0, m = 0, d = 0] = iso.split('-').map(Number)
        const selected = new Date(y, m - 1, d)
        const max = new Date()
        max.setHours(23, 59, 59, 999)
        max.setDate(max.getDate() + 7)
        return selected <= max
      },
      { message: 'Tanggal Form tidak boleh lebih dari 7 hari ke depan' }
    ),
  products: z
    .array(
      z.object({
        model: z.string().trim().min(1, 'Model wajib diisi'),
        namaProduk: z.string().trim().min(1, 'Nama produk wajib diisi'),
        nomorSeri: z.string().trim().min(1, 'Nomor seri wajib diisi')
      })
    )
    .min(1, 'Minimal 1 item produk wajib diisi')
    .superRefine((products, ctx) => {
      const seen = new Map<string, number>()

      products.forEach((product, index) => {
        const key = normalizeProductDuplicateKey(product.model, product.nomorSeri)
        if (!key) return

        const firstIndex = seen.get(key)
        if (firstIndex === undefined) {
          seen.set(key, index)
          return
        }

        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Model dan nomor seri sudah sama dengan item #${firstIndex + 1}.`,
          path: [index, 'nomorSeri']
        })
      })
    })
})

type FormState = z.infer<typeof pengajuanSchema>

type ModelProdukRow = {
  model?: string
  produk?: string
}

type ModelProdukResponse = {
  rows?: ModelProdukRow[]
}

type DraftResponse = {
  idPengajuan?: string
  resumeToken?: string
}

type SubmissionPayload = {
  nama: string
  bagianCabang: string
  pemilik: string
  tanggalForm: string
  alasanPengajuan: string
  catatanTambahan: string
  items: Array<{
    produk: string
    model: string
    nomorSeri: string
  }>
  idPengajuan?: string
  resumeToken?: string
}

type PrintRow = {
  label: string
  value: string
}

const toast = useToast()
const runtimeConfig = useRuntimeConfig()
const { callApi: callAPI } = useCsAppsScriptApi()
const draftReferenceStorage = useCsDraftReferenceStorage()
const maxItems = computed(() => Number(runtimeConfig.public.maxItems || 10))
const maxTanggalForm = computed(() => getDateInputValue(addDays(new Date(), 7)))

const formState = reactive<FormState>({
  namaPemohon: '',
  bagianCabang: '',
  namaPemilikBarang: '',
  alasanPengajuan: '',
  catatanTambahan: '',
  tanggalForm: createTodayDateValue(),
  products: [createProductItem()]
})

const modelProdukMap = ref<Record<string, string>>({})
const currentDraftId = ref('')
const currentResumeToken = ref('')
const isSavingDraft = ref(false)
const showPrintPreview = ref(false)
const savedPrintPayload = ref<SubmissionPayload | null>(null)
const savedPrintId = ref('')
const showDraftConfirm = ref(false)
const showNewDraftConfirm = ref(false)

// const finalSubmitUrl = computed(() => {
//   if (!currentDraftId.value) return '/final-submit'

//   return {
//     path: '/final-submit',
//     query: currentResumeToken.value
//       ? { id: currentDraftId.value, token: currentResumeToken.value }
//       : { id: currentDraftId.value }
//   }
// })
const printPayload = computed(() => savedPrintPayload.value || collectPayload())
const printId = computed(() => savedPrintId.value || currentDraftId.value || '-')
const printTanggalForm = computed(() => formatDate(printPayload.value.tanggalForm))
const printMetadataRows = computed<PrintRow[]>(() => {
  const payload = printPayload.value
  const rows: PrintRow[] = [
    { label: 'ID Pengajuan', value: printId.value },
    { label: 'Nama', value: payload.nama },
    { label: 'Bagian/Cabang', value: payload.bagianCabang },
    { label: 'Pemilik', value: payload.pemilik },
    { label: 'Alasan Pengajuan', value: payload.alasanPengajuan },
    { label: 'Catatan Tambahan', value: payload.catatanTambahan || '-' }
  ]

  if (payload.items.length === 1) {
    rows.push(
      { label: 'Produk', value: payload.items[0]?.produk || '' },
      { label: 'Model', value: payload.items[0]?.model || '' },
      { label: 'Nomor Seri', value: payload.items[0]?.nomorSeri || '' }
    )
  }

  return rows
})
const printHasMultipleItems = computed(() => printPayload.value.items.length > 1)
const printDraft = usePrintWithFilename('Pengajuan', () => printId.value)

onMounted(() => {
  loadModelProduk()
})

function createProductItem(): ProductItem {
  return { model: '', namaProduk: '', nomorSeri: '' }
}

function showToast(title: string, color: ToastColor = 'info', description?: string) {
  toast.add({ title, description, color })
}

async function loadModelProduk() {
  try {
    const result = await callAPI<ModelProdukResponse>('getModelProduk')
    if (!result.success) throw new Error(result.error || 'Master model produk gagal dimuat')

    const map: Record<string, string> = {}
    for (const row of result.data?.rows || []) {
      const key = normalizeModelKey(row.model)
      if (key && row.produk) map[key] = row.produk
    }
    modelProdukMap.value = map
    formState.products.forEach((_, index) => applyModelProdukToItem(index))
  } catch {
    modelProdukMap.value = {}
  }
}

function normalizeModelKey(value?: string) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase()
}

function normalizeProductDuplicateKey(model?: string, nomorSeri?: string) {
  const normalizedModel = normalizeModelKey(model)
  const normalizedSerial = String(nomorSeri || '').trim().replace(/\s+/g, ' ').toUpperCase()
  return normalizedModel && normalizedSerial ? `${normalizedModel}|${normalizedSerial}` : ''
}

function getProdukForModel(model: string) {
  return modelProdukMap.value[normalizeModelKey(model)] || ''
}

function isProdukLocked(product: ProductItem) {
  return !!getProdukForModel(product.model)
}

function applyModelProdukToItem(index: number) {
  const item = formState.products[index]
  if (!item) return false

  const produk = getProdukForModel(item.model)
  if (!produk) return false

  item.namaProduk = produk
  return true
}

function updateProductModel(index: number, value: string | number | undefined) {
  const item = formState.products[index]
  if (!item) return

  const wasLocked = isProdukLocked(item)
  item.model = String(value || '')

  const produk = getProdukForModel(item.model)
  if (produk) {
    item.namaProduk = produk
  } else if (wasLocked) {
    item.namaProduk = ''
  }
}

function updateProductName(index: number, value: string | number | undefined) {
  const item = formState.products[index]
  if (!item || isProdukLocked(item)) return
  item.namaProduk = String(value || '')
}

function updateProductSerial(index: number, value: string | number | undefined) {
  const item = formState.products[index]
  if (!item) return
  item.nomorSeri = String(value || '')
}

function addItem() {
  if (formState.products.length >= maxItems.value) {
    showToast('Jumlah item sudah maksimal', 'warning', `Maksimal ${maxItems.value} item produk.`)
    return
  }

  formState.products.push(createProductItem())
}

function removeItem(index: number) {
  if (formState.products.length <= 1) {
    showToast('Minimal 1 item produk wajib diisi.', 'warning')
    return
  }

  formState.products.splice(index, 1)
}

function createTodayDateValue() {
  return getDateInputValue(new Date())
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function getDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function collectPayload(): SubmissionPayload {
  return {
    nama: formState.namaPemohon.trim(),
    bagianCabang: formState.bagianCabang.trim(),
    pemilik: formState.namaPemilikBarang.trim(),
    tanggalForm: formState.tanggalForm,
    alasanPengajuan: formState.alasanPengajuan.trim(),
    catatanTambahan: formState.catatanTambahan.trim(),
    items: formState.products.map(item => ({
      produk: item.namaProduk.trim(),
      model: item.model.trim(),
      nomorSeri: item.nomorSeri.trim()
    }))
  }
}

function onFormError(event: FormErrorEvent) {
  const firstFew = [...new Set(event.errors.map(e => e.message))].slice(0, 4).join(' - ')
  showToast('Form belum lengkap', 'error', firstFew)
}

async function onDraftSubmit(_event: FormSubmitEvent<FormState>) {
  showDraftConfirm.value = true
}

async function confirmDraftAndPrint() {
  showDraftConfirm.value = false
  await handleSaveDraftAndPrint()
}

function cancelDraftConfirm() {
  showDraftConfirm.value = false
}

async function handleSaveDraftAndPrint() {
  isSavingDraft.value = true
  try {
    const payload = collectPayload()
    if (currentDraftId.value && currentResumeToken.value) {
      payload.idPengajuan = currentDraftId.value
      payload.resumeToken = currentResumeToken.value
    }

    const result = await callAPI<DraftResponse>('saveDraftPengajuan', payload as unknown as Record<string, unknown>)
    if (!result.success) throw new Error(result.error || 'Draft gagal disimpan')

    setDraftReference(result.data?.idPengajuan || '', result.data?.resumeToken || '')
    savedPrintPayload.value = clonePayload({
      ...payload,
      idPengajuan: currentDraftId.value,
      resumeToken: currentResumeToken.value
    })
    savedPrintId.value = currentDraftId.value
    showPrintPreview.value = true
    showToast('Draft berhasil disimpan', 'success', `ID Pengajuan: ${currentDraftId.value}`)
  } catch (error) {
    showToast('Draft gagal disimpan', 'error', getErrorMessage(error))
  } finally {
    isSavingDraft.value = false
  }
}

function setDraftReference(idPengajuan: string, resumeToken: string) {
  currentDraftId.value = idPengajuan
  currentResumeToken.value = resumeToken

  if (!import.meta.client || !idPengajuan) return

  draftReferenceStorage.save({
    idPengajuan,
    resumeToken,
    resumeUrl: buildFinalSubmitUrl(idPengajuan, resumeToken)
  })
}

function buildFinalSubmitUrl(idPengajuan: string, resumeToken: string) {
  if (!import.meta.client || window.location.protocol === 'file:') return ''

  const url = new URL('/final-submit', window.location.origin)
  url.searchParams.set('id', idPengajuan)
  if (resumeToken) url.searchParams.set('token', resumeToken)
  return url.toString()
}

function backToForm() {
  showNewDraftConfirm.value = true
}

function startNewDraft() {
  showNewDraftConfirm.value = false
  clearDraftState()
  showPrintPreview.value = false
}

function cancelNewDraft() {
  showNewDraftConfirm.value = false
}

function clearDraftState() {
  currentDraftId.value = ''
  currentResumeToken.value = ''
  savedPrintPayload.value = null
  savedPrintId.value = ''

  formState.namaPemohon = ''
  formState.bagianCabang = ''
  formState.namaPemilikBarang = ''
  formState.alasanPengajuan = ''
  formState.catatanTambahan = ''
  formState.tanggalForm = createTodayDateValue()
  formState.products.splice(0, formState.products.length, createProductItem())

  draftReferenceStorage.remove()
}

function clonePayload(payload: SubmissionPayload): SubmissionPayload {
  return JSON.parse(JSON.stringify(payload)) as SubmissionPayload
}

function formatDate(value: string) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID') : '-'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <div class="new-page-root">
    <Teleport to="body">
      <div
        v-if="isSavingDraft"
        class="fixed inset-0 z-100 flex items-center justify-center bg-default/70 backdrop-blur-sm"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="flex flex-col items-center gap-3 rounded-2xl border border-muted bg-default px-8 py-6 shadow-lg">
          <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
          <p class="text-sm font-medium text-highlighted">
            Menyimpan draft...
          </p>
        </div>
      </div>
    </Teleport>
    <div class="new-page-form relative mx-auto flex w-full max-w-350 flex-col gap-9 p-0 sm:p-6 lg:gap-6 lg:p-8">
      <!-- Header Section -->
      <header class="flex flex-col items-start justify-between gap-2 lg:flex-row lg:items-center lg:gap-3 lg:rounded-2xl lg:bg-default/45 lg:p-8 rounded-xl border border-white/60 bg-white/45 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-xl">
        <div class="min-w-0 flex-1">
          <h1 class="mb-1 text-lg font-bold leading-snug text-highlighted lg:text-2xl">
            Form Pengajuan Kartu Garansi Baru
          </h1>
          <p class="text-[11px] leading-relaxed text-muted sm:text-xs lg:text-sm">
            Lengkapi data pengajuan, simpan draft, lalu cetak hard copy untuk ditandatangani.
          </p>
        </div>
      </header>

      <!-- Main Content Layout (Left Form, Right Sidebar) -->
      <div class="flex flex-col gap-6 lg:flex-row">
        <!-- Left Column: Form Areas -->
        <UForm
          v-show="!showPrintPreview"
          :schema="pengajuanSchema"
          :state="formState"
          class="flex flex-1 flex-col gap-9 lg:gap-6"
          @submit="onDraftSubmit"
          @error="onFormError"
        >
          <!-- Section 1: Informasi Pemohon -->
          <section class="relative lg:rounded-2xl lg:bg-default/45 lg:p-8 rounded-xl border border-white/60 bg-white/45 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-xl">
            <div class="mb-5 flex items-center justify-between border-b border-muted pb-3 lg:mb-8 lg:pb-4">
              <div class="flex items-center gap-3 lg:gap-4">
                <div class="flex h-10 w-10 items-center justify-center rounded-full border border-muted bg-default/60 text-highlighted shadow-sm lg:h-12 lg:w-12">
                  <UIcon name="i-lucide-user" class="size-5" />
                </div>
                <div>
                  <p class="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-dimmed lg:mb-1 lg:text-xs">
                    Langkah 01
                  </p>
                  <h2 class="text-lg font-bold leading-tight text-highlighted lg:text-xl">
                    Informasi Pemohon
                  </h2>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6">
              <UFormField name="namaPemohon" label="Nama Pemohon" size="lg" required>
                <UInput
                  v-model="formState.namaPemohon"
                  placeholder="Masukkan nama Anda"
                  class="w-full"
                  size="lg" 
                />
              </UFormField>

              <UFormField name="bagianCabang" label="Cabang" size="lg" required>
                <UInput
                  v-model="formState.bagianCabang"
                  placeholder="Contoh: Cabang Jakarta Pusat"
                  class="w-full"
                  size="lg"
                />
              </UFormField>

              <UFormField name="namaPemilikBarang" label="Nama Pemilik Barang" size="lg" required>
                <UInput
                  v-model="formState.namaPemilikBarang"
                  placeholder="Masukkan nama toko atau dealer"
                  class="w-full"
                  size="lg"
                />
              </UFormField>

              <UFormField name="tanggalForm" label="Tanggal Form" size="lg" required>
                <UInput
                  v-model="formState.tanggalForm"
                  type="date"
                  class="w-full"
                  size="lg"
                  :max="maxTanggalForm"
                />
              </UFormField>

              <UFormField name="alasanPengajuan" label="Alasan Pengajuan" size="lg" required>
                <UTextarea
                  v-model="formState.alasanPengajuan"
                  placeholder="Jelaskan alasan pengajuan kartu garansi baru"
                  class="w-full"
                  size="lg"
                  :rows="5"
                />
              </UFormField>

              <UFormField name="catatanTambahan" label="Catatan Tambahan" hint="Opsional" size="lg">
                <UTextarea
                  v-model="formState.catatanTambahan"
                  placeholder="Tambahkan catatan jika ada"
                  class="w-full"
                  size="lg"
                  :rows="5"
                />
              </UFormField>
            </div>
          </section>

          <!-- Section 2: Daftar Produk -->
          <section class="flex flex-col lg:rounded-4xl lg:bg-default/45 lg:p-8 rounded-xl border border-white/60 bg-white/45 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-xl">
            <div class="mb-5 flex flex-col items-stretch justify-between gap-3 border-b border-muted pb-3 lg:mb-6 lg:flex-row lg:items-center lg:gap-0 lg:pb-4">
              <div class="flex w-full items-center justify-between gap-3 lg:gap-4">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-muted bg-default/60 text-highlighted shadow-sm lg:h-12 lg:w-12">
                  <UIcon name="i-lucide-package" class="size-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-dimmed lg:mb-1 lg:text-xs">
                    Langkah 02
                  </p>
                  <h2 class="text-lg font-bold leading-tight text-highlighted lg:text-xl">
                    Daftar Produk
                  </h2>
                </div>
                <UButton
                  type="button"
                  label="Item"
                  icon="i-lucide-plus"
                  color="primary"
                  variant="solid"
                  class="self-end cursor-pointer lg:shrink-0"
                  :disabled="formState.products.length >= maxItems"
                  @click="addItem"
                />
              </div>
            </div>

            <!-- Item List -->
            <div class="mb-6 md:mb-8 md:overflow-hidden md:rounded-xl md:border md:border-muted md:bg-default/35 md:shadow-sm md:backdrop-blur-lg">
              <div class="hidden grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-3 border-b border-muted px-4 py-3 text-xs font-semibold uppercase tracking-wider text-toned md:grid">
                <span class="text-center">#</span>
                <span>Model <span class="text-error">*</span></span>
                <span>Produk / Nama Produk <span class="text-error">*</span></span>
                <span>Nomor Seri <span class="text-error">*</span></span>
                <span />
              </div>

              <div class="flex flex-col gap-2 md:p-3">
                <div
                  v-for="(product, index) in formState.products"
                  :key="index"
                  class="grid grid-cols-1 gap-3 rounded-lg border border-muted bg-default/60 p-3 shadow-xs md:grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_40px] md:items-start"
                >
                  <div class="flex items-center gap-3 md:justify-center md:pt-1">
                    <span class="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {{ index + 1 }}
                    </span>
                    <span class="text-xs font-semibold uppercase tracking-wider text-toned md:hidden">
                      Item Produk
                    </span>
                  </div>

                  <UFormField :name="`products.${index}.model`" size="sm">
                    <UInput
                      :model-value="product.model"
                      aria-label="Tipe atau model produk"
                      placeholder="Tipe/Model"
                      class="w-full"
                      color="neutral"
                      variant="outline"
                      size="md"
                      @update:model-value="value => updateProductModel(index, value)"
                    />
                  </UFormField>

                  <UFormField :name="`products.${index}.namaProduk`" size="sm">
                    <UInput
                      :model-value="product.namaProduk"
                      :disabled="isProdukLocked(product)"
                      aria-label="Produk atau nama produk"
                      placeholder="Nama Produk"
                      class="w-full"
                      color="neutral"
                      variant="outline"
                      size="md"
                      @update:model-value="value => updateProductName(index, value)"
                    />
                  </UFormField>

                  <UFormField :name="`products.${index}.nomorSeri`" size="sm">
                    <UInput
                      :model-value="product.nomorSeri"
                      aria-label="Nomor seri produk"
                      placeholder="S/N"
                      class="w-full"
                      color="neutral"
                      variant="outline"
                      size="md"
                      @update:model-value="value => updateProductSerial(index, value)"
                    />
                  </UFormField>

                  <div class="flex justify-end md:pt-1">
                    <UButton
                      type="button"
                      icon="i-lucide-trash-2"
                      color="error"
                      variant="ghost"
                      size="sm"
                      class="cursor-pointer"
                      :disabled="formState.products.length <= 1"
                      :aria-label="`Hapus item ${index + 1}`"
                      @click="removeItem(index)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer Action in Form Area -->
            <div class="mt-auto flex flex-col items-center justify-between gap-4 border-t border-muted pt-6 sm:flex-row">
              <p class="text-xs italic text-muted">
                Draft akan tersimpan di database sebelum dicetak. Upload final dilakukan di halaman Final Submit.
              </p>
              <UButton
                type="submit"
                label="Simpan Draft & Cetak"
                icon="i-lucide-printer"
                color="primary"
                size="lg"
                class="w-full justify-center sm:w-auto cursor-pointer"
                :loading="isSavingDraft"
              />
            </div>
          </section>
        </UForm>

        <div
          v-show="showPrintPreview"
          id="print-preview-slot"
          class="flex flex-1"
        />

        <!-- Right Column: Sidebar / Status Tracker -->
        <aside class="flex w-full flex-col gap-6 lg:w-80">
          <!-- Status Tracker Panel -->
          <div class="lg:rounded-2xl lg:bg-default/45 lg:p-8 rounded-xl border border-white/60 bg-white/45 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-xl">
            <div class="mb-6 flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl border border-muted bg-default/60 text-highlighted shadow-sm">
                <UIcon name="i-lucide-file-text" class="size-5" />
              </div>
              <div>
                <p class="text-xs font-bold uppercase tracking-wider text-dimmed">
                  Alur Berkas
                </p>
                <h3 class="text-base font-bold text-highlighted">
                  Proses Pengajuan
                </h3>
              </div>
            </div>

            <div class="relative flex flex-col gap-3">
              <!-- Connecting Line -->
              <div class="absolute bottom-8 left-5.5 top-8 z-0 w-0.5 border-l border-muted bg-muted" />

              <div
                class="relative z-10 flex gap-4 rounded-2xl p-4 shadow-sm"
                :class="showPrintPreview ? 'border border-muted bg-default/40 backdrop-blur-sm transition-colors hover:bg-default/60' : 'border border-inverted bg-inverted text-inverted'"
              >
                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold backdrop-blur-sm"
                  :class="showPrintPreview ? 'border border-muted bg-default text-highlighted shadow-sm' : 'border border-default/30 bg-default/20'"
                >
                  01
                </div>
                <div>
                  <h4
                    class="mb-1 text-sm font-bold"
                    :class="showPrintPreview ? 'text-highlighted' : 'text-inverted'"
                  >
                    Lengkapi data
                  </h4>
                  <p
                    class="text-xs leading-relaxed"
                    :class="showPrintPreview ? 'text-muted' : 'text-inverted/80'"
                  >
                    Isi data pemohon, alasan, dan daftar produk secara detail.
                  </p>
                </div>
              </div>

              <div
                class="relative z-10 flex gap-4 rounded-2xl p-4 shadow-sm"
                :class="showPrintPreview ? 'border border-inverted bg-inverted text-inverted' : 'border border-muted bg-default/40 backdrop-blur-sm transition-colors hover:bg-default/60'"
              >
                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold backdrop-blur-sm"
                  :class="showPrintPreview ? 'border border-default/30 bg-default/20' : 'border border-muted bg-default text-highlighted shadow-sm'"
                >
                  02
                </div>
                <div>
                  <h4
                    class="mb-1 text-sm font-bold"
                    :class="showPrintPreview ? 'text-inverted' : 'text-highlighted'"
                  >
                    Cetak draft
                  </h4>
                  <p
                    class="text-xs leading-relaxed"
                    :class="showPrintPreview ? 'text-inverted/80' : 'text-muted'"
                  >
                    Simpan draft, cetak form fisik, lalu minta tanda tangan basah.
                  </p>
                </div>
              </div>

              <div class="relative z-10 flex gap-4 rounded-2xl border border-muted bg-default/40 p-4 shadow-sm backdrop-blur-sm transition-colors hover:bg-default/60">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-muted bg-default text-sm font-bold text-highlighted shadow-sm">
                  03
                </div>
                <div>
                  <h4 class="mb-1 text-sm font-bold text-toned">
                    Final submit
                  </h4>
                  <p class="text-xs leading-relaxed text-dimmed">
                    Upload scan/foto hard copy bertanda tangan melalui halaman Final Submit.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <UModal
      v-model:open="showDraftConfirm"
      title="Konfirmasi"
      description="Apakah data yang Anda ajukan sudah benar?"
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer>
        <UButton
          type="button"
          label="Cancel"
          color="neutral"
          variant="outline"
          :disabled="isSavingDraft"
          @click="cancelDraftConfirm"
        />
        <UButton
          type="button"
          label="Ya, Lanjutkan"
          color="primary"
          :loading="isSavingDraft"
          @click="confirmDraftAndPrint"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="showNewDraftConfirm"
      title="Buat Pengajuan Baru"
      description="Data pengajuan saat ini akan dihapus dan form dikosongkan. Lanjutkan?"
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer>
        <UButton
          type="button"
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="cancelNewDraft"
        />
        <UButton
          type="button"
          label="Ya, Buat Baru"
          color="primary"
          @click="startNewDraft"
        />
      </template>
    </UModal>

    <Teleport to="#print-preview-slot">
      <section
        v-if="showPrintPreview"
        id="section-print"
        class="mx-auto w-full max-w-[210mm] max-h-[297mm] bg-white p-6 text-sm text-slate-900"
      >
      <div class="no-print mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-blue-900">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-lg font-bold">
              Preview Cetak Form {{ printId }}
            </h2>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row">
            <UButton
              type="button"
              label="Buat Pengajuan Baru"
              icon="i-lucide-file-plus-2"
              color="neutral"
              variant="subtle"
              @click="backToForm"
            />
            <!-- <UButton
              :to="finalSubmitUrl"
              label="Final Submit"
              icon="i-lucide-upload"
              color="neutral"
              variant="outline"
            /> -->
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

      <div class="border-b border-slate-300 pb-4 text-center">
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
        <h2 class="mt-6 font-bold">
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
    </Teleport>
  </div>
</template>

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
