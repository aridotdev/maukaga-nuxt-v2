<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'

definePageMeta({
  layout: 'cs'
})

// Catatan: composables seperti useToast, useRoute, dll biasanya di-auto-import di Nuxt 3.

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

type DraftStatusResponse = {
  idPengajuan?: string
  status?: string
  resumeToken?: string
}

type DraftLoadResponse = DraftData & DraftStatusResponse

type SubmitResponse = {
  idPengajuan?: string
}

type EvidenceAttachmentPayload = {
  fileName: string
  fileBase64: string
  fileExtension: string
  fileMimeType: string
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
  fileBase64?: string
  fileExtension?: string
  fileMimeType?: string
  evidenceAttachments?: EvidenceAttachmentPayload[]
}

type StoredDraftReference = {
  idPengajuan: string
  resumeToken: string
}

type LoadDraftReference = Partial<StoredDraftReference> & {
  fromUrl?: boolean
  source?: 'manual' | 'stored' | 'url'
}

const toast = useToast()
const route = useRoute()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const { callApi: callAPI } = useCsAppsScriptApi()
const draftReferenceStorage = useCsDraftReferenceStorage()
const fileInput = ref<HTMLInputElement | null>(null)
const evidenceInput = ref<HTMLInputElement | null>(null)

const maxUploadMb = computed(() => Number(runtimeConfig.public.maxUploadMb || 10))
const maxEvidenceFiles = 10
const maxEvidenceFileMb = 5

const resumeId = ref('')
const currentDraftId = ref('')
const currentResumeToken = ref('')
const resumeUrl = ref('')
const loadedDraft = ref<DraftData | null>(null)
const selectedFile = ref<File | null>(null)
const selectedEvidenceFiles = ref<File[]>([])
const evidencePreviewUrls = ref<string[]>([])
const successId = ref('')
const hasResumeInputError = ref(false)
const hasFileError = ref(false)
const evidenceError = ref('')
const isLoadingDraft = ref(false)
const isLoadingStoredDraft = ref(false)
const isSubmitting = ref(false)

const isDraftReady = computed(() => !!currentDraftId.value && !!currentResumeToken.value && !!loadedDraft.value)
const fileInfoText = computed(() => {
  if (!selectedFile.value) return 'Belum ada file dipilih. Wajib saat submit final.'

  const error = validateFile(selectedFile.value)
  return `${selectedFile.value.name} (${formatBytes(selectedFile.value.size)})${error ? ` — ${error}` : ''}`
})
const evidenceInfoText = computed(() => {
  const count = selectedEvidenceFiles.value.length
  if (!count) return 'Belum ada foto tambahan dipilih.'

  return `${count}/${maxEvidenceFiles} foto dipilih`
})
const canAddEvidenceFiles = computed(() => selectedEvidenceFiles.value.length < maxEvidenceFiles)
const submitButtonText = computed(() => isSubmitting.value ? 'Mengirim...' : 'Submit Final Pengajuan')

onMounted(() => {
  initializeDraftResume()
})

onBeforeUnmount(() => {
  revokeEvidencePreviewUrls()
})

watch(resumeId, () => {
  hasResumeInputError.value = false
})

function showToast(title: string, color: ToastColor = 'info', description?: string) {
  toast.add({ title, description, color })
}

function initializeDraftResume() {
  const fromUrl = getDraftReferenceFromUrl()
  if (fromUrl.idPengajuan && fromUrl.resumeToken) {
    resumeId.value = fromUrl.idPengajuan
    void handleLoadDraft({ ...fromUrl, fromUrl: true, source: 'url' })
  }
}

async function handleLoadDraft(reference: LoadDraftReference = {}) {
  let idPengajuan = String(reference.idPengajuan || resumeId.value || '').trim()
  let resumeToken = String(reference.resumeToken || '').trim()
  const saved = getStoredDraftReference()

  if (!resumeToken && saved.idPengajuan === idPengajuan) resumeToken = saved.resumeToken

  if (!idPengajuan) {
    hasResumeInputError.value = true
    showToast('Masukkan ID Pengajuan, klik Draft Terakhir, atau buka Link Lanjutkan Draft.', 'error')
    return
  }

  const loadingState = reference.source === 'stored' ? isLoadingStoredDraft : isLoadingDraft
  loadingState.value = true
  hasResumeInputError.value = false

  try {
    const draftResult = await loadDraftData(idPengajuan, resumeToken)
    idPengajuan = draftResult.data.idPengajuan || idPengajuan
    resumeToken = draftResult.resumeToken
    loadedDraft.value = normalizeDraftData(draftResult.data, idPengajuan)
    setDraftReference(idPengajuan, resumeToken)
    resetSelectedFile()
    resetEvidenceFiles()

    if (reference.fromUrl) clearResumeParamsFromUrl()

    showToast('Draft berhasil dimuat', 'success', `Draft ${idPengajuan} siap diupload final.`)
  } catch (error) {
    showToast('Draft gagal dimuat', 'error', getErrorMessage(error))
  } finally {
    loadingState.value = false
  }
}

async function loadDraftData(idPengajuan: string, resumeToken: string): Promise<{ data: DraftData, resumeToken: string }> {
  if (!resumeToken) {
    const result = await callAPI<DraftLoadResponse>('loadDraftPengajuanById', { idPengajuan })
    if (result.success) {
      const nextToken = String(result.data?.resumeToken || '').trim()
      if (!nextToken) throw new Error('Draft ditemukan, tetapi Resume Token tidak tersedia. Draft ini tidak bisa dilanjutkan.')

      return { data: result.data || {}, resumeToken: nextToken }
    }

    if (!isUnknownActionError(result.error)) {
      throw new Error(result.error || 'ID Pengajuan tidak bisa dilanjutkan.')
    }

    const statusResult = await callAPI<DraftStatusResponse>('checkDraftPengajuanStatus', { idPengajuan })
    if (!statusResult.success) throw new Error(statusResult.error || 'ID Pengajuan tidak bisa dilanjutkan.')

    resumeToken = String(statusResult.data?.resumeToken || '').trim()
    if (!resumeToken) throw new Error('Draft ditemukan, tetapi Resume Token tidak tersedia. Draft ini tidak bisa dilanjutkan.')
  }

  const result = await callAPI<DraftData>('getDraftPengajuan', { idPengajuan, resumeToken })
  if (!result.success) throw new Error(result.error || 'Draft gagal dimuat')

  return { data: result.data || {}, resumeToken }
}

function isUnknownActionError(error?: string) {
  return String(error || '').toLowerCase().includes('action tidak dikenal')
}

function handleLoadStoredDraft() {
  const saved = getStoredDraftReference()
  if (!saved.idPengajuan || !saved.resumeToken) {
    showToast('Belum ada draft terakhir di browser ini. Buka Link Lanjutkan Draft jika memakai perangkat lain.', 'error')
    return
  }

  resumeId.value = saved.idPengajuan
  void handleLoadDraft({ ...saved, source: 'stored' })
}

function setDraftReference(idPengajuan: string, resumeToken: string) {
  currentDraftId.value = idPengajuan || ''
  currentResumeToken.value = resumeToken || ''
  resumeId.value = currentDraftId.value
  resumeUrl.value = currentDraftId.value && currentResumeToken.value ? buildResumeUrl(currentDraftId.value, currentResumeToken.value) : ''

  draftReferenceStorage.save({
    idPengajuan: currentDraftId.value,
    resumeToken: currentResumeToken.value,
    resumeUrl: resumeUrl.value
  })
}

function clearDraftReference() {
  currentDraftId.value = ''
  currentResumeToken.value = ''
  resumeUrl.value = ''
  resumeId.value = ''
  loadedDraft.value = null

  draftReferenceStorage.remove()
}

function getStoredDraftReference(): StoredDraftReference {
  const saved = draftReferenceStorage.get()
  return { idPengajuan: saved.idPengajuan, resumeToken: saved.resumeToken }
}

function getDraftReferenceFromUrl(): StoredDraftReference {
  return {
    idPengajuan: getQueryValue(route.query.id) || getQueryValue(route.query.idPengajuan),
    resumeToken: getQueryValue(route.query.token) || getQueryValue(route.query.resumeToken)
  }
}

function buildResumeUrl(idPengajuan: string, resumeToken: string) {
  if (!import.meta.client || window.location.protocol === 'file:') return ''

  const url = new URL(window.location.href)
  url.searchParams.set('id', idPengajuan)
  url.searchParams.set('token', resumeToken)
  return url.toString()
}

function clearResumeParamsFromUrl() {
  const query = { ...route.query }
  delete query.id
  delete query.idPengajuan
  delete query.token
  delete query.resumeToken
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

function collectPayload(): SubmissionPayload {
  const draft = loadedDraft.value || {}

  return {
    nama: String(draft.nama || '').trim(),
    bagianCabang: String(draft.bagianCabang || '').trim(),
    pemilik: String(draft.pemilik || '').trim(),
    tanggalForm: String(draft.tanggalForm || '').trim(),
    alasanPengajuan: String(draft.alasanPengajuan || '').trim(),
    catatanTambahan: String(draft.catatanTambahan || '').trim(),
    items: (draft.items || []).map(item => ({
      produk: String(item.produk || '').trim(),
      model: String(item.model || '').trim(),
      nomorSeri: String(item.nomorSeri || '').trim()
    }))
  }
}

async function handleSubmitFinal() {
  if (!currentDraftId.value || !currentResumeToken.value || !loadedDraft.value) {
    showToast('Simpan draft terlebih dahulu, lanjutkan Draft Terakhir, atau buka Link Lanjutkan Draft sebelum Submit Final.', 'error')
    return
  }

  const payload = collectPayload()
  const validationErrors = getValidationErrors(payload)
  const fileError = validateFile(selectedFile.value)
  const evidenceErrors = getEvidenceValidationErrors()

  hasFileError.value = !!fileError

  if (validationErrors.length) {
    showToast('Data draft belum lengkap', 'error', [...new Set(validationErrors)].slice(0, 4).join(' • '))
    return
  }

  if (fileError || !selectedFile.value) {
    showToast(fileError || 'File hard copy wajib dilampirkan', 'error')
    return
  }

  if (evidenceErrors.length) {
    evidenceError.value = evidenceErrors[0] || ''
    showToast('Lampiran foto bukti belum valid', 'error', evidenceError.value)
    return
  }

  isSubmitting.value = true

  try {
    payload.idPengajuan = currentDraftId.value
    payload.resumeToken = currentResumeToken.value
    payload.fileBase64 = await fileToBase64(selectedFile.value)
    payload.fileExtension = getFileExtension(selectedFile.value.name)
    payload.fileMimeType = selectedFile.value.type || getMimeTypeFromExtension(payload.fileExtension)
    payload.evidenceAttachments = await buildEvidenceAttachmentPayloads()

    const result = await callAPI<SubmitResponse>('submitDraftPengajuan', payload as unknown as Record<string, unknown>)
    if (!result.success) throw new Error(result.error || 'Pengajuan gagal dikirim')

    const submittedId = result.data?.idPengajuan || currentDraftId.value
    clearDraftReference()
    resetSelectedFile()
    resetEvidenceFiles()
    successId.value = submittedId
    showToast('Pengajuan berhasil dikirim', 'success', `ID Pengajuan: ${submittedId}`)
  } catch (error) {
    showToast('Pengajuan gagal dikirim', 'error', getErrorMessage(error))
  } finally {
    isSubmitting.value = false
  }
}

function getValidationErrors(payload: SubmissionPayload) {
  const errors: string[] = []

  if (!payload.nama) errors.push('Nama wajib diisi')
  if (!payload.bagianCabang) errors.push('Bagian/Cabang wajib diisi')
  if (!payload.pemilik) errors.push('Pemilik wajib diisi')
  if (!payload.tanggalForm) errors.push('Tanggal Form wajib diisi')
  if (!payload.alasanPengajuan) errors.push('Alasan Pengajuan wajib diisi')

  if (payload.tanggalForm) {
    const selected = new Date(`${payload.tanggalForm}T00:00:00`)
    const max = new Date()
    max.setHours(23, 59, 59, 999)
    max.setDate(max.getDate() + 7)

    if (Number.isNaN(selected.getTime())) errors.push('Tanggal Form tidak valid')
    else if (selected > max) errors.push('Tanggal Form tidak boleh lebih dari 7 hari ke depan')
  }

  if (!payload.items.length) errors.push('Minimal 1 item produk wajib diisi')

  payload.items.forEach((item, index) => {
    if (!item.produk || !item.model || !item.nomorSeri) errors.push(`Item #${index + 1} belum lengkap`)
  })

  return errors
}

function triggerFilePicker() {
  fileInput.value?.click()
}

function triggerEvidencePicker() {
  if (!canAddEvidenceFiles.value) {
    showToast(`Maksimal ${maxEvidenceFiles} foto bukti`, 'error')
    return
  }

  evidenceInput.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  selectedFile.value = target.files?.[0] || null
  hasFileError.value = !!validateFile(selectedFile.value)
}

function handleEvidenceFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  addEvidenceFiles(Array.from(target.files || []))
  target.value = ''
}

function addEvidenceFiles(files: File[]) {
  evidenceError.value = ''
  if (!files.length) return

  const availableSlots = maxEvidenceFiles - selectedEvidenceFiles.value.length
  if (availableSlots <= 0) {
    evidenceError.value = `Maksimal ${maxEvidenceFiles} foto bukti`
    showToast(evidenceError.value, 'error')
    return
  }

  const nextFiles: File[] = []
  const errors = new Set<string>()

  files.slice(0, availableSlots).forEach((file) => {
    const error = validateEvidenceFile(file)
    if (error) errors.add(`${file.name}: ${error}`)
    else nextFiles.push(file)
  })

  if (files.length > availableSlots) errors.add(`Maksimal ${maxEvidenceFiles} foto bukti`)
  if (nextFiles.length) setEvidenceFiles([...selectedEvidenceFiles.value, ...nextFiles])

  if (errors.size) {
    evidenceError.value = Array.from(errors).slice(0, 2).join(' • ')
    showToast('Sebagian foto tidak bisa ditambahkan', 'error', evidenceError.value)
  }
}

function removeEvidenceFile(index: number) {
  setEvidenceFiles(selectedEvidenceFiles.value.filter((_, fileIndex) => fileIndex !== index))
  evidenceError.value = ''
}

function resetSelectedFile() {
  selectedFile.value = null
  hasFileError.value = false
  if (fileInput.value) fileInput.value.value = ''
}

function resetEvidenceFiles() {
  setEvidenceFiles([])
  evidenceError.value = ''
  if (evidenceInput.value) evidenceInput.value.value = ''
}

function validateFile(file: File | null) {
  if (!file) return 'File hard copy wajib dilampirkan'

  const ext = getFileExtension(file.name)
  if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) return 'Format file harus PDF/JPG/JPEG/PNG'
  if (file.size > maxUploadMb.value * 1024 * 1024) return `Ukuran file tidak boleh melebihi ${maxUploadMb.value}MB`

  return ''
}

function validateEvidenceFile(file: File) {
  const ext = getFileExtension(file.name)
  if (!['jpg', 'jpeg', 'png'].includes(ext)) return 'Format foto harus JPG/JPEG/PNG'
  if (file.type && !['image/jpeg', 'image/png'].includes(file.type)) return 'Tipe file foto tidak valid'
  if (file.size > maxEvidenceFileMb * 1024 * 1024) return `Ukuran foto tidak boleh melebihi ${maxEvidenceFileMb}MB`

  return ''
}

function getEvidenceValidationErrors() {
  if (selectedEvidenceFiles.value.length > maxEvidenceFiles) return [`Maksimal ${maxEvidenceFiles} foto bukti`]

  return selectedEvidenceFiles.value
    .map(validateEvidenceFile)
    .filter(Boolean)
}

async function buildEvidenceAttachmentPayloads(): Promise<EvidenceAttachmentPayload[]> {
  return Promise.all(selectedEvidenceFiles.value.map(async (file) => {
    const fileExtension = getFileExtension(file.name)

    return {
      fileName: file.name,
      fileBase64: await fileToBase64(file),
      fileExtension,
      fileMimeType: file.type || getMimeTypeFromExtension(fileExtension)
    }
  }))
}

function setEvidenceFiles(files: File[]) {
  selectedEvidenceFiles.value = files
  syncEvidencePreviewUrls()
}

function syncEvidencePreviewUrls() {
  revokeEvidencePreviewUrls()
  if (!import.meta.client) return

  evidencePreviewUrls.value = selectedEvidenceFiles.value.map(file => URL.createObjectURL(file))
}

function revokeEvidencePreviewUrls() {
  if (!import.meta.client) return

  evidencePreviewUrls.value.forEach(url => URL.revokeObjectURL(url))
  evidencePreviewUrls.value = []
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.split(',')[1] || '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getFileExtension(name: string) {
  return String(name).split('.').pop()?.toLowerCase() || ''
}

function getMimeTypeFromExtension(extension?: string) {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png'
  }

  return map[String(extension || '').toLowerCase()] || 'application/octet-stream'
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <section class="mx-auto flex min-h-full w-full max-w-350 flex-col md:p-8">
    <div class="flex flex-col gap-6 lg:flex-row">
      <div class="min-w-0 flex-1">
        <Transition name="layout" mode="out-in">
      <!-- STATE: BERHASIL SUBMIT -->
      <div v-if="successId" class="mb-8 grow rounded-xl lg:rounded-3xl border border-white/60 bg-white/45 p-6 text-center shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-2xl md:p-12">
        <div class="mx-auto max-w-xl py-8">
          <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600 ring-8 ring-green-50">
            <UIcon name="i-lucide-check" class="size-10" />
          </div>
          <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
            Pengajuan Berhasil!
          </h2>
          <p class="mt-4 text-base text-slate-500">
            Pengajuan Anda telah berhasil dikirim dan masuk ke antrean verifikasi admin sebelum proses cetak dilanjutkan.
          </p>
          <div class="mt-8 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-6">
            <p class="text-sm font-medium text-slate-500">
              ID Pengajuan Anda
            </p>
            <p class="mt-2 font-mono text-2xl font-bold tracking-wider text-blue-700">
              {{ successId }}
            </p>
          </div>
          <NuxtLink
            to="/"
            class="mt-8 inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg focus:ring-4 focus:ring-slate-900/20"
          >
            Kembali ke Beranda
          </NuxtLink>
        </div>
      </div>

      <!-- STATE: CARI DRAFT & UPLOAD -->
      <div v-else class="mb-8 grow rounded-xl lg:rounded-3xl border border-white/60 bg-white/45 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-2xl md:p-8">
        
        <!-- STEP 1: CARI DRAFT -->
        <div class="mx-auto mb-8 max-w-xl py-6 text-center">
          <div class="mb-4 inline-flex items-center justify-center rounded-2xl bg-blue-100 p-3 text-blue-600">
            <UIcon name="i-lucide-upload-cloud" class="size-8" />
          </div>
          <h2 class="mb-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Final Submit Pengajuan Kartu Garansi
          </h2>
          <p class="mb-8 text-sm text-slate-500">
            Lanjutkan draft terakhir Anda untuk mengunggah dokumen fisik.
          </p>

          <div class="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <UInput
              v-model="resumeId"
              type="text"
              class="w-full md:flex-1"
              size="xl"
              color="neutral"
              variant="outline"
              :highlight="hasResumeInputError"
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
              size="xl"
              icon="i-lucide-search"
              :label="isLoadingDraft ? 'Mencari...' : 'Muat Draft'"
              :loading="isLoadingDraft"
              :disabled="isLoadingDraft || isLoadingStoredDraft"
              @click="handleLoadDraft({ source: 'manual' })"
            />
          </div>

          <UButton
            type="button"
            class="mt-3 w-full justify-center rounded-xl px-8 py-3.5 font-semibold transition-all active:scale-95"
            color="neutral"
            variant="outline"
            size="xl"
            icon="i-lucide-history"
            :label="isLoadingStoredDraft ? 'Memuat...' : 'Draft Terakhir'"
            :loading="isLoadingStoredDraft"
            :disabled="isLoadingDraft || isLoadingStoredDraft"
            @click="handleLoadStoredDraft"
          />
        </div>

        <Transition name="slide-up">
          <div v-if="isDraftReady" class="space-y-8">
            
            <hr class="border-slate-200/60" >

            <!-- STEP 2: REVIEW DATA (FITUR BARU BERDASARKAN PERMINTAAN) -->
            <div>
              <h3 class="mb-4 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 text-lg font-bold text-slate-800 sm:flex sm:gap-2">
                <UIcon name="i-lucide-file-text" class="size-5 text-blue-600" />
                Ringkasan Data
                <span class="col-start-2 w-fit rounded bg-blue-100 px-2 py-0.5 font-mono text-xs font-semibold text-blue-800 sm:ml-2">{{ currentDraftId }}</span>
              </h3>
              
              <div class="grid gap-6 md:grid-cols-[1fr_2fr]">
                <!-- Info Pemohon -->
                <div class="rounded-2xl border border-slate-200 bg-white/50 p-5">
                  <dl class="space-y-4 text-sm">
                    <div>
                      <dt class="text-xs font-medium text-slate-500">Nama Pemohon</dt>
                      <dd class="mt-0.5 font-semibold text-slate-900">{{ loadedDraft?.nama || '-' }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs font-medium text-slate-500">Cabang / Bagian</dt>
                      <dd class="mt-0.5 font-medium text-slate-900">{{ loadedDraft?.bagianCabang || '-' }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs font-medium text-slate-500">Tgl. Form</dt>
                      <dd class="mt-0.5 font-medium text-slate-900">{{ loadedDraft?.tanggalForm || '-' }}</dd>
                    </div>
                  </dl>
                </div>

                <!-- List Produk -->
                <div class="rounded-2xl border border-slate-200 bg-white/50 p-5">
                  <p class="mb-3 text-xs font-medium text-slate-500">Item Produk ({{ loadedDraft?.items?.length || 0 }})</p>
                  <div class="max-h-55 space-y-3 overflow-y-auto pr-2">
                    <div 
                      v-for="(item, idx) in loadedDraft?.items" 
                      :key="idx"
                      class="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p class="font-bold text-slate-800">{{ item.model || 'Model tidak diketahui' }}</p>
                        <p class="mt-0.5 text-xs text-slate-500">{{ item.produk || 'Produk' }}</p>
                      </div>
                      <div class="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 border border-slate-100">
                        <UIcon name="i-lucide-barcode" class="size-4 text-slate-400" />
                        <span class="font-mono text-sm font-semibold text-slate-700">
                          {{ item.nomorSeri || 'N/A' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- STEP 3: UPLOAD FILE -->
            <div>
              <h3 class="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
                <UIcon name="i-lucide-upload-cloud" class="size-5 text-blue-600" />
                Upload Dokumen Fisik
              </h3>
              
              <button
                type="button"
                class="group relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-white/50 px-5 py-5 text-center transition-all hover:bg-slate-50/80 focus:outline-none focus:ring-4 focus:ring-slate-900/10 sm:flex-row sm:justify-start sm:text-left"
                :class="[
                  hasFileError ? 'border-red-400' : 
                  selectedFile ? 'border-green-400 bg-green-50/30 hover:bg-green-50/50' : 'border-slate-300'
                ]"
                @click="triggerFilePicker"
              >
                <!-- Icon State -->
                <div 
                  class="mb-3 flex size-12 items-center justify-center rounded-full transition-all duration-300 group-hover:scale-110 sm:mb-0 sm:mr-4 sm:shrink-0"
                  :class="selectedFile ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'"
                >
                  <UIcon 
                    :name="selectedFile ? 'i-lucide-file-check-2' : 'i-lucide-file-up'" 
                    class="size-6" 
                  />
                </div>

                <!-- Text State -->
                <div class="min-w-0">
                  <span class="block text-sm font-bold sm:text-base" :class="selectedFile ? 'text-green-800' : 'text-slate-700'">
                    {{ selectedFile ? 'Ganti File Pindai' : 'Pilih File Pindai TTD' }}
                  </span>
                  
                  <span 
                    class="mt-1 block max-w-md text-sm transition-colors" 
                    :class="hasFileError ? 'text-red-600 font-medium' : selectedFile ? 'text-green-600' : 'text-slate-500'"
                  >
                    {{ fileInfoText }}
                  </span>
                  
                  <span v-if="!selectedFile" class="mt-2 inline-flex rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    Format: PDF, JPG, PNG (Maks. {{ maxUploadMb }}MB)
                  </span>
                </div>
              </button>
              
              <input
                ref="fileInput"
                type="file"
                class="hidden"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                @change="handleFileChange"
              >

              <div class="mt-6 border-t border-slate-200/60 pt-5">
                <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between bg:items-start">
                  <div>
                    <h4 class="flex items-center gap-2 text-base font-bold text-slate-800">
                      <UIcon name="i-lucide-images" class="size-5 text-blue-600" />
                      Lampiran Foto Bukti
                    </h4>
                    <p class="mt-1 text-sm text-slate-500">
                      Foto unit, dus, label model, serial number, atau bukti pendukung lain.
                    </p>
                  </div>
                  <span class="text-xs font-semibold text-slate-500">{{ evidenceInfoText }}</span>
                </div>

                <button
                  type="button"
                  class="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-dashed bg-white/50 px-4 py-4 text-left transition-all hover:bg-slate-50/80 focus:outline-none focus:ring-4 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-60"
                  :class="evidenceError ? 'border-red-300' : selectedEvidenceFiles.length ? 'border-blue-300 bg-blue-50/20' : 'border-slate-300'"
                  :disabled="!canAddEvidenceFiles"
                  @click="triggerEvidencePicker"
                >
                  <span class="flex min-w-0 items-center gap-3">
                    <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-transform group-hover:scale-105">
                      <UIcon name="i-lucide-image-plus" class="size-5" />
                    </span>
                    <span class="min-w-0">
                      <span class="block text-sm font-bold text-slate-700">
                        {{ canAddEvidenceFiles ? 'Tambah Foto Bukti' : 'Batas Foto Terpenuhi' }}
                      </span>
                      <span class="mt-0.5 block text-xs text-slate-500">
                        JPG atau PNG, maksimal {{ maxEvidenceFileMb }}MB per foto
                      </span>
                    </span>
                  </span>
                  <UIcon name="i-lucide-plus" class="size-5 shrink-0 text-slate-400" />
                </button>

                <input
                  ref="evidenceInput"
                  type="file"
                  class="hidden"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  multiple
                  @change="handleEvidenceFileChange"
                >

                <p v-if="evidenceError" class="mt-2 text-sm font-medium text-red-600">
                  {{ evidenceError }}
                </p>

                <div v-if="selectedEvidenceFiles.length" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  <div
                    v-for="(file, index) in selectedEvidenceFiles"
                    :key="`${file.name}-${file.lastModified}-${index}`"
                    class="relative rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
                  >
                    <div class="aspect-square overflow-hidden rounded-xl bg-slate-100">
                      <img
                        :src="evidencePreviewUrls[index]"
                        :alt="file.name"
                        class="h-full w-full object-cover"
                      >
                    </div>
                    <button
                      type="button"
                      class="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-slate-900/80 text-white shadow-sm transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                      aria-label="Hapus foto bukti"
                      @click.stop="removeEvidenceFile(index)"
                    >
                      <UIcon name="i-lucide-x" class="size-4" />
                    </button>
                    <p class="mt-2 truncate text-xs font-semibold text-slate-700">
                      {{ file.name }}
                    </p>
                    <p class="text-xs text-slate-500">
                      {{ formatBytes(file.size) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- ACTIONS -->
            <div class="flex flex-col-reverse justify-end gap-3 border-t border-slate-200/60 pt-6 sm:flex-row">
              <UButton
                type="button"
                class="w-full justify-center rounded-xl px-6 py-3.5 font-semibold text-slate-600 hover:bg-slate-100 sm:w-auto"
                color="neutral"
                variant="ghost"
                size="lg"
                label="Batalkan"
                :disabled="isSubmitting"
                @click="clearDraftReference"
              />
              <UButton
                type="button"
                class="w-full justify-center rounded-xl px-8 py-3.5 font-bold shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:shadow-xl sm:w-auto"
                color="primary"
                variant="solid"
                size="lg"
                icon="i-lucide-send-to-back"
                :label="submitButtonText"
                :loading="isSubmitting"
                :disabled="isSubmitting || !selectedFile || hasFileError"
                @click="handleSubmitFinal"
              />
            </div>

          </div>
        </Transition>

      </div>
        </Transition>
      </div>

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

            <div class="relative z-10 flex gap-4 rounded-2xl border border-muted bg-default/40 p-4 shadow-sm backdrop-blur-sm transition-colors hover:bg-default/60">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-muted bg-default text-sm font-bold text-highlighted shadow-sm">
                01
              </div>
              <div>
                <h4 class="mb-1 text-sm font-bold text-highlighted">
                  Lengkapi data
                </h4>
                <p class="text-xs leading-relaxed text-muted">
                  Isi data pemohon, alasan, dan daftar produk secara detail.
                </p>
              </div>
            </div>

            <div class="relative z-10 flex gap-4 rounded-2xl border border-muted bg-default/40 p-4 shadow-sm backdrop-blur-sm transition-colors hover:bg-default/60">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-muted bg-default text-sm font-bold text-highlighted shadow-sm">
                02
              </div>
              <div>
                <h4 class="mb-1 text-sm font-bold text-highlighted">
                  Cetak draft
                </h4>
                <p class="text-xs leading-relaxed text-muted">
                  Simpan draft, cetak form fisik, lalu minta tanda tangan basah.
                </p>
              </div>
            </div>

            <div class="relative z-10 flex gap-4 rounded-2xl border border-inverted bg-inverted p-4 text-inverted shadow-sm">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-default/30 bg-default/20 text-sm font-bold backdrop-blur-sm">
                03
              </div>
              <div>
                <h4 class="mb-1 text-sm font-bold text-inverted">
                  Final submit
                </h4>
                <p class="text-xs leading-relaxed text-inverted/80">
                  Upload scan/foto hard copy bertanda tangan melalui halaman Final Submit.
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
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

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.2);
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
