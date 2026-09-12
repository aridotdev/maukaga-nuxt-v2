<script setup lang="ts">
import { getLocalTimeZone, today } from '@internationalized/date'
import * as z from 'zod'
import type { FormErrorEvent, FormSubmitEvent } from '@nuxt/ui'
import type { CalendarProps } from '@nuxt/ui/runtime/components/Calendar.vue'
import type { InputDateProps } from '@nuxt/ui/runtime/components/InputDate.vue'

definePageMeta({
  layout: 'default'
})

defineOptions({
  name: 'NewPengajuanPage'
})

type ToastColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

type ProductItem = {
  model: string
  namaProduk: string
  nomorSeri: string
}

const schema = z.object({
  namaPemohon: z.string().trim().min(1, 'Nama Pemohon wajib diisi'),
  bagianCabang: z.string().trim().min(1, 'Bagian/Cabang wajib diisi'),
  namaPemilikBarang: z.string().trim().min(1, 'Nama Pemilik Barang wajib diisi'),
  alasanPengajuan: z.string().trim().min(1, 'Alasan Pengajuan wajib diisi'),
  catatanTambahan: z.string().optional().default(''),
  tanggalForm: z
    .string()
    .min(1, 'Tanggal Form wajib diisi')
    .refine(isDateAllowed, 'Tanggal Form harus besok sampai 7 hari ke depan'),
  products: z
    .array(
      z.object({
        model: z.string().trim().min(1, 'Model wajib diisi'),
        namaProduk: z.string().trim().min(1, 'Nama produk wajib diisi'),
        nomorSeri: z.string().trim().min(1, 'Nomor seri wajib diisi')
      })
    )
    .min(1, 'Minimal 1 item produk wajib diisi')
    .superRefine((products, context) => {
      const seen = new Map<string, number>()

      products.forEach((product, index) => {
        const key = getDuplicateKey(product.model, product.nomorSeri)
        if (!key) return

        const firstIndex = seen.get(key)
        if (firstIndex === undefined) {
          seen.set(key, index)
          return
        }

        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Model dan nomor seri sudah sama dengan item #${firstIndex + 1}.`,
          path: [index, 'nomorSeri']
        })
      })
    })
})

type FormState = z.output<typeof schema>

type ModelProdukResponse = {
  rows?: Array<{
    model?: string
    produk?: string
  }>
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

type InputDateValue = NonNullable<InputDateProps<false>['modelValue']>
type CalendarValue = NonNullable<CalendarProps<false, false>['modelValue']>

const workflowSteps = [
  {
    number: 1,
    title: 'Lengkapi data',
    description: 'Isi data pemohon, alasan, dan daftar produk secara detail.'
  },
  {
    number: 2,
    title: 'Cetak draft',
    description: 'Simpan draft, cetak form fisik, lalu minta tanda tangan basah.'
  },
  {
    number: 3,
    title: 'Final submit',
    description: 'Upload scan atau foto hard copy bertanda tangan melalui halaman Final Submit.'
  }
]

const toast = useToast()
const runtimeConfig = useRuntimeConfig()
const { callApi } = usePengajuanApi()
const draftReferenceStorage = useDraftReferenceStorage()

const maxItems = computed(() => Number(runtimeConfig.public.maxItems || 10))
const minTanggalForm = computed<InputDateValue>(() => toInputDateValue(today(getLocalTimeZone()).add({ days: 1 })))
const maxTanggalFormDate = computed<InputDateValue>(() => toInputDateValue(today(getLocalTimeZone()).add({ days: 7 })))
const calendarMinTanggalForm = computed<CalendarValue>(() => toCalendarValue(today(getLocalTimeZone()).add({ days: 1 })))
const calendarMaxTanggalForm = computed<CalendarValue>(() => toCalendarValue(today(getLocalTimeZone()).add({ days: 7 })))
const formState = reactive<FormState>(createInitialFormState())
const inputDate = useTemplateRef('inputDate')
const tanggalFormDate = shallowRef<CalendarValue>(calendarMinTanggalForm.value)
const inputDateValue = computed<InputDateValue>({
  get: () => toInputDateValue(tanggalFormDate.value),
  set: (value) => {
    tanggalFormDate.value = toCalendarValue(value)
  }
})

const modelProdukMap = ref<Record<string, string>>({})
const currentDraftId = ref('')
const currentResumeToken = ref('')
const savedPrintPayload = ref<SubmissionPayload | null>(null)
const isSavingDraft = ref(false)
const showPrintPreview = ref(false)
const showDraftConfirm = ref(false)
const showNewDraftConfirm = ref(false)

const currentStep = computed(() => showPrintPreview.value ? 2 : 1)
const printPayload = computed(() => savedPrintPayload.value || collectPayload())
const printTanggalForm = computed(() => formatDate(printPayload.value.tanggalForm))
const printMetadataRows = computed<PrintRow[]>(() => {
  const payload = printPayload.value
  const rows: PrintRow[] = [
    { label: 'ID Pengajuan', value: currentDraftId.value || '-' },
    { label: 'Nama', value: payload.nama },
    { label: 'Bagian/Cabang', value: payload.bagianCabang },
    { label: 'Pemilik', value: payload.pemilik },
    { label: 'Alasan Pengajuan', value: payload.alasanPengajuan },
    { label: 'Catatan Tambahan', value: payload.catatanTambahan || '-' }
  ]

  if (payload.items.length === 1) {
    const [item] = payload.items
    rows.push(
      { label: 'Produk', value: item?.produk || '' },
      { label: 'Model', value: item?.model || '' },
      { label: 'Nomor Seri', value: item?.nomorSeri || '' }
    )
  }

  return rows
})
const printHasMultipleItems = computed(() => printPayload.value.items.length > 1)
const printDraft = usePrintWithFilename('Pengajuan', () => currentDraftId.value || '-')

onMounted(() => {
  void loadModelProduk()
})

watch(tanggalFormDate, (value) => {
  formState.tanggalForm = value.toString()
}, { immediate: true })

function createProductItem(): ProductItem {
  return {
    model: '',
    namaProduk: '',
    nomorSeri: ''
  }
}

function createInitialFormState(): FormState {
  return {
    namaPemohon: '',
    bagianCabang: '',
    namaPemilikBarang: '',
    alasanPengajuan: '',
    catatanTambahan: '',
    tanggalForm: getDateInputValue(addDays(new Date(), 1)),
    products: [createProductItem()]
  }
}

function toInputDateValue(value: unknown): InputDateValue {
  return value as InputDateValue
}

function toCalendarValue(value: unknown): CalendarValue {
  return value as CalendarValue
}

function isDateAllowed(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year = 0, month = 0, day = 0] = value.split('-').map(Number)
  const selected = new Date(year, month - 1, day)
  if (
    selected.getFullYear() !== year
    || selected.getMonth() !== month - 1
    || selected.getDate() !== day
  ) {
    return false
  }

  const minDate = addDays(new Date(), 1)
  const maxDate = addDays(new Date(), 7)
  minDate.setHours(0, 0, 0, 0)
  maxDate.setHours(23, 59, 59, 999)
  return selected >= minDate && selected <= maxDate
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function getDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeModelKey(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase()
}

function getDuplicateKey(model: unknown, serial: unknown): string {
  const normalizedModel = normalizeModelKey(model)
  const normalizedSerial = String(serial || '').trim().replace(/\s+/g, ' ').toUpperCase()
  return normalizedModel && normalizedSerial ? `${normalizedModel}|${normalizedSerial}` : ''
}

function getProductName(model: string): string {
  return modelProdukMap.value[normalizeModelKey(model)] || ''
}

function isProductLocked(product: ProductItem): boolean {
  return Boolean(getProductName(product.model))
}

function updateProductModel(product: ProductItem, value: string | number | undefined): void {
  const wasLocked = isProductLocked(product)
  product.model = String(value || '')

  const productName = getProductName(product.model)
  if (productName) {
    product.namaProduk = productName
  } else if (wasLocked) {
    product.namaProduk = ''
  }
}

async function loadModelProduk(): Promise<void> {
  try {
    const result = await callApi<ModelProdukResponse>('getModelProduk')
    if (!result.success) return

    modelProdukMap.value = Object.fromEntries(
      (result.data?.rows || [])
        .map(row => [normalizeModelKey(row.model), String(row.produk || '').trim()])
        .filter(([model, product]) => model && product)
    )

    formState.products.forEach((product) => {
      const productName = getProductName(product.model)
      if (productName) product.namaProduk = productName
    })
  } catch {
    modelProdukMap.value = {}
  }
}

function showToast(title: string, color: ToastColor = 'info', description?: string): void {
  toast.add({ title, description, color })
}

function addItem(): void {
  if (formState.products.length >= maxItems.value) {
    showToast('Jumlah item sudah maksimal', 'warning', `Maksimal ${maxItems.value} item produk.`)
    return
  }

  formState.products.push(createProductItem())
}

function removeItem(index: number): void {
  if (formState.products.length <= 1) {
    showToast('Minimal 1 item produk wajib diisi.', 'warning')
    return
  }

  formState.products.splice(index, 1)
}

function collectPayload(): SubmissionPayload {
  return {
    nama: formState.namaPemohon.trim(),
    bagianCabang: formState.bagianCabang.trim(),
    pemilik: formState.namaPemilikBarang.trim(),
    tanggalForm: formState.tanggalForm,
    alasanPengajuan: formState.alasanPengajuan.trim(),
    catatanTambahan: formState.catatanTambahan.trim(),
    items: formState.products.map(product => ({
      produk: product.namaProduk.trim(),
      model: product.model.trim(),
      nomorSeri: product.nomorSeri.trim()
    }))
  }
}

function onFormError(event: FormErrorEvent): void {
  const message = [...new Set(event.errors.map(error => error.message))]
    .slice(0, 4)
    .join(' - ')

  showToast('Form belum lengkap', 'error', message)
}

function onDraftSubmit(_event: FormSubmitEvent<FormState>): void {
  showDraftConfirm.value = true
}

async function confirmDraftAndPrint(): Promise<void> {
  showDraftConfirm.value = false
  isSavingDraft.value = true

  try {
    const payload = collectPayload()
    if (currentDraftId.value && currentResumeToken.value) {
      payload.idPengajuan = currentDraftId.value
      payload.resumeToken = currentResumeToken.value
    }

    const result = await callApi<DraftResponse>(
      'saveDraftPengajuan',
      payload as unknown as Record<string, unknown>
    )
    if (!result.success) throw new Error(result.error || 'Draft gagal disimpan')

    const idPengajuan = String(result.data?.idPengajuan || '').trim()
    const resumeToken = String(result.data?.resumeToken || '').trim()
    if (!idPengajuan || !resumeToken) {
      throw new Error('Draft tersimpan, tetapi referensi untuk melanjutkan tidak tersedia.')
    }

    setDraftReference(idPengajuan, resumeToken)
    savedPrintPayload.value = {
      ...payload,
      idPengajuan,
      resumeToken
    }
    showPrintPreview.value = true
    showToast('Draft berhasil disimpan', 'success', `ID Pengajuan: ${idPengajuan}`)
  } catch (error) {
    showToast('Draft gagal disimpan', 'error', getErrorMessage(error))
  } finally {
    isSavingDraft.value = false
  }
}

function cancelDraftConfirm(): void {
  showDraftConfirm.value = false
}

function setDraftReference(idPengajuan: string, resumeToken: string): void {
  currentDraftId.value = idPengajuan
  currentResumeToken.value = resumeToken

  if (!import.meta.client) return

  draftReferenceStorage.save({
    idPengajuan,
    resumeToken,
    resumeUrl: buildFinalSubmitUrl(idPengajuan, resumeToken)
  })
}

function buildFinalSubmitUrl(idPengajuan: string, resumeToken: string): string {
  if (!import.meta.client || window.location.protocol === 'file:') return ''

  const url = new URL('/final-submit', window.location.origin)
  url.searchParams.set('id', idPengajuan)
  if (resumeToken) url.searchParams.set('token', resumeToken)
  return url.toString()
}

function backToForm(): void {
  showNewDraftConfirm.value = true
}

function startNewDraft(): void {
  showNewDraftConfirm.value = false
  showPrintPreview.value = false
  savedPrintPayload.value = null
  currentDraftId.value = ''
  currentResumeToken.value = ''
  Object.assign(formState, createInitialFormState())
  tanggalFormDate.value = minTanggalForm.value as unknown as CalendarValue
  draftReferenceStorage.remove()
}

function cancelNewDraft(): void {
  showNewDraftConfirm.value = false
}

function formatDate(value: string): string {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID') : '-'
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl space-y-6">
    <header class="border-b border-default pb-5">
      <h1 class="text-2xl font-semibold text-highlighted">
        Form Pengajuan Kartu Garansi Baru
      </h1>
      <p class="mt-1 text-sm text-muted">
        Lengkapi data pengajuan, simpan draft, lalu cetak hard copy untuk ditandatangani.
      </p>
    </header>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <UForm
        v-if="!showPrintPreview"
        :schema="schema"
        :state="formState"
        :disabled="isSavingDraft"
        class="space-y-6"
        @submit="onDraftSubmit"
        @error="onFormError"
      >
        <UCard variant="outline">
          <template #header>
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-user" class="size-5 text-primary" />
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-muted">
                  Langkah 01
                </p>
                <h2 class="text-lg font-semibold text-highlighted">
                  Informasi Pemohon
                </h2>
              </div>
            </div>
          </template>

          <div class="grid gap-4 md:grid-cols-2">
            <UFormField name="namaPemohon" label="Nama Pemohon" required>
              <UInput
                v-model="formState.namaPemohon"
                placeholder="Masukkan nama Anda"
                class="w-full"
                size="lg"
              />
            </UFormField>

            <UFormField name="bagianCabang" label="Cabang" required>
              <UInput
                v-model="formState.bagianCabang"
                placeholder="Contoh: Surabaya"
                class="w-full"
                size="lg"
              />
            </UFormField>

            <UFormField name="namaPemilikBarang" label="Nama Pemilik Barang" required>
              <UInput
                v-model="formState.namaPemilikBarang"
                placeholder="Masukkan nama toko atau dealer"
                class="w-full"
                size="lg"
              />
            </UFormField>

            <UFormField name="tanggalForm" label="Tanggal Form" required>
              <UInputDate
                ref="inputDate"
                v-model="inputDateValue"
                :min-value="minTanggalForm"
                :max-value="maxTanggalFormDate"
                class="w-full"
                size="lg"
              >
                <template #trailing>
                  <UPopover :reference="inputDate?.inputsRef[3]?.$el">
                    <UButton
                      type="button"
                      color="neutral"
                      variant="link"
                      size="sm"
                      icon="i-lucide-calendar"
                      aria-label="Pilih tanggal form"
                      class="px-0"
                    />

                    <template #content>
                      <!-- @vue-ignore Nuxt UI and Reka UI currently resolve different date type instances. -->
                      <UCalendar
                        v-model="tanggalFormDate"
                        :min-value="calendarMinTanggalForm"
                        :max-value="calendarMaxTanggalForm"
                        class="p-2"
                      />
                    </template>
                  </UPopover>
                </template>
              </UInputDate>
            </UFormField>

            <UFormField name="alasanPengajuan" label="Alasan Pengajuan" required>
              <UTextarea
                v-model="formState.alasanPengajuan"
                placeholder="Jelaskan alasan pengajuan kartu garansi baru"
                :rows="4"
                class="w-full"
                size="lg"
              />
            </UFormField>

            <UFormField name="catatanTambahan" label="Catatan Tambahan" hint="Opsional">
              <UTextarea
                v-model="formState.catatanTambahan"
                placeholder="Tambahkan catatan jika ada"
                :rows="4"
                class="w-full"
                size="lg"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard variant="outline">
          <template #header>
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-package" class="size-5 text-primary" />
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide text-muted">
                    Langkah 02
                  </p>
                  <h2 class="text-lg font-semibold text-highlighted">
                    Daftar Produk
                  </h2>
                </div>
              </div>

              <UButton
                type="button"
                label="Tambah item"
                icon="i-lucide-plus"
                :disabled="formState.products.length >= maxItems"
                @click="addItem"
              />
            </div>
          </template>

          <div class="space-y-3">
            <div class="hidden grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-3 border-b border-default px-3 pb-2 text-xs font-medium text-muted md:grid">
              <span>#</span>
              <span>Model</span>
              <span>Produk / Nama Produk</span>
              <span>Nomor Seri</span>
              <span />
            </div>

            <div
              v-for="(product, index) in formState.products"
              :key="index"
              class="grid gap-3 rounded-lg border border-default p-3 md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem] md:items-start"
            >
              <div class="flex items-center gap-2 md:justify-center">
                <span class="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                  {{ index + 1 }}
                </span>
                <span class="text-xs font-medium text-muted md:hidden">
                  Item produk
                </span>
              </div>

              <UFormField :name="`products.${index}.model`" required>
                <UInput
                  :model-value="product.model"
                  aria-label="Tipe atau model produk"
                  placeholder="Tipe/Model"
                  class="w-full"
                  @update:model-value="updateProductModel(product, $event)"
                />
              </UFormField>

              <UFormField :name="`products.${index}.namaProduk`" required>
                <UInput
                  v-model="product.namaProduk"
                  :disabled="isProductLocked(product)"
                  aria-label="Produk atau nama produk"
                  :placeholder="isProductLocked(product) ? 'Terisi dari master' : 'Nama Produk'"
                  class="w-full"
                />
              </UFormField>

              <UFormField :name="`products.${index}.nomorSeri`" required>
                <UInput
                  v-model="product.nomorSeri"
                  aria-label="Nomor seri produk"
                  placeholder="S/N"
                  class="w-full"
                />
              </UFormField>

              <UButton
                type="button"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                :disabled="formState.products.length <= 1"
                :aria-label="`Hapus item ${index + 1}`"
                @click="removeItem(index)"
              />
            </div>
          </div>

          <template #footer>
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-xs text-muted">
                Draft tersimpan di database sebelum dicetak. Upload final dilakukan di halaman Final Submit.
              </p>
              <UButton
                type="submit"
                label="Simpan Draft & Cetak"
                icon="i-lucide-printer"
                size="lg"
                class="justify-center"
                :loading="isSavingDraft"
              />
            </div>
          </template>
        </UCard>
      </UForm>

      <section
        v-else
        id="section-print"
        class="w-full bg-white p-4 text-sm text-slate-900 sm:p-6"
      >
        <div class="no-print mb-6 flex flex-col gap-4 border-b border-default pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="text-lg font-semibold text-highlighted">
            Preview Cetak Form {{ currentDraftId }}
          </h2>
          <div class="flex flex-col gap-2 sm:flex-row">
            <UButton
              type="button"
              label="Buat Pengajuan Baru"
              icon="i-lucide-file-plus-2"
              color="neutral"
              variant="outline"
              @click="backToForm"
            />
            <UButton
              type="button"
              label="Cetak"
              icon="i-lucide-printer"
              @click="printDraft"
            />
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
              <tr
                v-for="(item, index) in printPayload.items"
                :key="`${item.model}-${item.nomorSeri}-${index}`"
              >
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

      <UCard as="aside" variant="outline" class="h-fit">
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-file-text" class="size-5 text-primary" />
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted">
                Alur Berkas
              </p>
              <h2 class="text-lg font-semibold text-highlighted">
                Proses Pengajuan
              </h2>
            </div>
          </div>
        </template>

        <ol class="relative space-y-3 before:absolute before:bottom-8 before:left-3.5 before:top-8 before:w-px before:bg-border">
          <li
            v-for="step in workflowSteps"
            :key="step.number"
            class="relative flex gap-3 rounded-lg border p-3"
            :class="step.number === currentStep
              ? 'border-primary bg-primary text-inverted'
              : step.number < currentStep
                ? 'border-primary/30 bg-primary/5'
                : 'border-default bg-elevated'"
          >
            <span
              class="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
              :class="step.number === currentStep
                ? 'bg-white text-primary'
                : 'border-default bg-default text-muted'"
            >
              {{ String(step.number).padStart(2, '0') }}
            </span>
            <div>
              <h3
                class="text-sm font-semibold"
                :class="step.number === currentStep ? 'text-inverted' : 'text-highlighted'"
              >
                {{ step.title }}
              </h3>
              <p
                class="mt-1 text-xs leading-relaxed"
                :class="step.number === currentStep ? 'text-inverted' : 'text-muted'"
              >
                {{ step.description }}
              </p>
            </div>
          </li>
        </ol>
      </UCard>
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
          label="Batal"
          color="neutral"
          variant="outline"
          :disabled="isSavingDraft"
          @click="cancelDraftConfirm"
        />
        <UButton
          type="button"
          label="Ya, Lanjutkan"
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
          label="Batal"
          color="neutral"
          variant="outline"
          @click="cancelNewDraft"
        />
        <UButton
          type="button"
          label="Ya, Buat Baru"
          @click="startNewDraft"
        />
      </template>
    </UModal>
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
