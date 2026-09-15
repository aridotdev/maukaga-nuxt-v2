<script setup lang="ts">
import * as z from 'zod'
import type {
  CalendarProps,
  FormSubmitEvent,
  InputDateProps,
} from '@nuxt/ui'
import {
  getLocalTimeZone,
  parseDate,
  today,
} from '@internationalized/date'

definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

const toast = useToast()
const runtimeConfig = useRuntimeConfig()

const maxItems = Math.max(1, Number(runtimeConfig.public.maxItems || 10))
const maxUploadMb = Math.max(1, Number(runtimeConfig.public.maxUploadMb || 10))
const maxUploadBytes = maxUploadMb * 1024 * 1024

function isFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File
}

const uploadFileSchema = z.custom<File>(isFile, 'File tidak valid')
const pdfFileSchema = z.union([uploadFileSchema, z.null()])
  .refine(file => Boolean(isFile(file)), 'Hardcopy PDF wajib diunggah')
  .refine(
    file =>
      isFile(file)
      && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')),
    'Hardcopy wajib berupa file PDF',
  )
  .refine(
    file => isFile(file) && file.size <= maxUploadBytes,
    `Ukuran file maksimal ${maxUploadMb} MB`,
  )
const evidenceFileSchema = uploadFileSchema
  .refine(
    file =>
      ['application/pdf', 'image/jpeg'].includes(file.type)
      || /\.(pdf|jpe?g)$/i.test(file.name),
    'Lampiran hanya boleh berupa PDF atau JPG',
  )
  .refine(
    file => file.size <= maxUploadBytes,
    `Ukuran file maksimal ${maxUploadMb} MB`,
  )

const itemSchema = z.object({
  model: z.string('Model wajib diisi').trim().min(1, 'Model wajib diisi'),
  nomorSeri: z.string('Nomor seri wajib diisi').trim().min(1, 'Nomor seri wajib diisi'),
  produk: z.string('Produk wajib diisi').trim().min(1, 'Produk wajib diisi'),
})

const schema = z.object({
  nama: z.string('Nama wajib diisi').trim().min(1, 'Nama wajib diisi'),
  bagianCabang: z.string('Bagian/cabang wajib diisi').trim().min(1, 'Bagian/cabang wajib diisi'),
  pemilik: z.string('Pemilik wajib diisi').trim().min(1, 'Pemilik wajib diisi'),
  alasanPengajuan: z.string('Alasan pengajuan wajib diisi').trim().min(1, 'Alasan pengajuan wajib diisi').max(200, 'Alasan pengajuan maksimal 200 karakter'),
  tanggalForm: z.string('Tanggal form wajib diisi').min(1, 'Tanggal form wajib diisi'),
  catatanTambahan: z.string().trim().max(200, 'Catatan maksimal 200 karakter').optional(),
  items: z.array(itemSchema)
    .min(1, 'Tambahkan minimal satu item pengajuan')
    .max(maxItems, `Maksimal ${maxItems} item dalam satu pengajuan`),
  hardcopy: pdfFileSchema,
  evidence: z.array(evidenceFileSchema).default([]),
})

type Schema = z.output<typeof schema>
type ItemState = Schema['items'][number]
type InputDateValue = InputDateProps['modelValue']
type CalendarValue = CalendarProps['modelValue']

function getToday() {
  return today(getLocalTimeZone()).toString()
}

function createItem(): ItemState {
  return {
    model: '',
    nomorSeri: '',
    produk: '',
  }
}

const state = reactive<Schema>({
  nama: '',
  bagianCabang: '',
  pemilik: '',
  alasanPengajuan: '',
  tanggalForm: getToday(),
  catatanTambahan: '',
  items: [createItem()],
  hardcopy: null,
  evidence: [],
})

const inputDate = useTemplateRef('inputDate')

const inputDateValue = computed<InputDateValue>({
  get: () => state.tanggalForm
    ? parseDate(state.tanggalForm) as unknown as InputDateValue
    : undefined,
  set: (value) => {
    state.tanggalForm = value?.toString() ?? ''
  },
})
const calendarDateValue = computed<CalendarValue>({
  get: () => state.tanggalForm
    ? parseDate(state.tanggalForm) as unknown as CalendarValue
    : undefined,
  set: (value) => {
    state.tanggalForm = value?.toString() ?? ''
  },
})

const isSubmitting = ref(false)
const itemCount = computed(() => state.items.length)
const attachmentCount = computed(() => state.evidence.length + (state.hardcopy ? 1 : 0))

function addItem() {
  if (state.items.length >= maxItems) {
    toast.add({
      title: 'Batas item tercapai',
      description: `Satu pengajuan dapat memiliki maksimal ${maxItems} item.`,
      color: 'warning',
      icon: 'i-lucide-triangle-alert',
    })
    return
  }

  state.items.push(createItem())
}

function removeItem(index: number) {
  if (state.items.length === 1) {
    toast.add({
      title: 'Item tidak dapat dihapus',
      description: 'Pengajuan harus memiliki minimal satu item.',
      color: 'warning',
      icon: 'i-lucide-triangle-alert',
    })
    return
  }

  state.items.splice(index, 1)
}

function onSubmit(event: FormSubmitEvent<Schema>) {
  isSubmitting.value = true

  toast.add({
    title: 'Validasi berhasil',
    description: `${event.data.items.length} item dan ${attachmentCount.value} lampiran siap diproses.`,
    color: 'success',
    icon: 'i-lucide-circle-check',
  })

  isSubmitting.value = false
}
</script>

<template>
  <UDashboardPanel id="pengajuan-create">
    <template #header>
      <UDashboardNavbar title="Pengajuan Kartu Garansi">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            to="/dashboard/pengajuan"
            variant="ghost"
            icon="i-lucide-arrow-left"
          >
            Kembali
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UContainer class="w-full">
        <div class="mb-8 flex flex-col gap-3">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight text-highlighted sm:text-3xl">
              Form Pengajuan Kartu Garansi
            </h1>
            <p class="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Lengkapi data pengajuan, item kartu, dan dokumen pendukung.
            </p>
          </div>
        </div>

        <UForm
          :schema="schema"
          :state="state"
          class="space-y-6"
          @submit="onSubmit"
        >
          <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div class="space-y-6">
              <UCard>
                <template #header>
                  <div class="flex items-center gap-3">
                    <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <UIcon name="i-lucide-clipboard-pen-line" class="size-4" />
                    </div>
                    <h2 class="font-semibold text-highlighted">
                      Data Pemohon
                    </h2>
                  </div>
                </template>

                <div class="grid gap-5 sm:grid-cols-2">
                  <UFormField
                    name="nama"
                    label="Nama Pemohon"
                    required
                  >
                    <UInput
                      v-model="state.nama"
                      class="w-full"
                      placeholder="Masukkan nama pemohon"
                    />
                  </UFormField>

                  <UFormField
                    name="bagianCabang"
                    label="Bagian / cabang"
                    required
                  >
                    <UInput
                      v-model="state.bagianCabang"
                      class="w-full"
                      placeholder="Contoh: Karawang"
                    />
                  </UFormField>

                  <UFormField
                    name="pemilik"
                    label="Nama Pemilik Barang"
                    required
                  >
                    <UInput
                      v-model="state.pemilik"
                      class="w-full"
                      placeholder="Masukkan nama toko atau dealer"
                    />
                  </UFormField>

                  <UFormField
                    name="tanggalForm"
                    label="Tanggal Form"
                    required
                  >
                    <UInputDate
                      ref="inputDate"
                      v-model="inputDateValue"
                      class="w-full"
                      locale="id"
                      aria-label="Tanggal Form"
                    >
                      <template #trailing>
                        <UPopover :reference="inputDate?.inputsRef[0]?.$el">
                          <UButton
                            color="neutral"
                            variant="link"
                            size="sm"
                            icon="i-lucide-calendar"
                            aria-label="Pilih tanggal"
                            class="px-0"
                          />
                          <template #content>
                            <UCalendar
                              v-model="calendarDateValue"
                              locale="id"
                              class="p-2"
                            />
                          </template>
                        </UPopover>
                      </template>
                    </UInputDate>
                  </UFormField>

                  <UFormField
                    name="alasanPengajuan"
                    label="Alasan pengajuan"
                    required
                  >
                    <UTextarea
                      v-model="state.alasanPengajuan"
                      class="w-full"
                      :rows="3"
                      autoresize
                      :maxrows="6"
                      placeholder="Jelaskan alasan cetak ulang kartu garansi"
                    />
                  </UFormField>

                  <UFormField
                    name="catatanTambahan"
                    label="Catatan tambahan"
                  >
                    <UTextarea
                      v-model="state.catatanTambahan"
                      class="w-full"
                      :rows="3"
                      autoresize
                      :maxrows="6"
                      placeholder="Tulis catatan tambahan bila diperlukan"
                    />
                  </UFormField>
                </div>
              </UCard>

              <UCard>
                <template #header>
                  <div class="flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                      <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <UIcon name="i-lucide-boxes" class="size-4" />
                      </div>
                      <h2 class="font-semibold text-highlighted">
                        Daftar Produk
                      </h2>
                    </div>
                    <UButton
                      type="button"
                      variant="solid"
                      icon="i-lucide-plus"
                      :disabled="itemCount >= maxItems"
                      @click="addItem"
                    >
                      Tambah item
                    </UButton>
                  </div>
                </template>

                <div class="space-y-3">
                  <div
                    v-for="(item, index) in state.items"
                    :key="index"
                    class=""
                  >
                    <div class="flex items-center gap-1">
                      <div class="flex items-center gap-2">
                        <span class="flex size-6 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                          {{ String(index + 1).padStart(2, '0') }}
                        </span>
                      </div>

                      <div class="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                        <UFormField
                          :name="`items.${index}.model`"
                          class="min-w-0"
                          required
                        >
                          <UInput
                            v-model="item.model"
                            class="w-full"
                            placeholder="Contoh: 4T-C55HJ6000I"
                          />
                        </UFormField>

                        <UFormField
                          :name="`items.${index}.nomorSeri`"
                          class="min-w-0"
                          required
                        >
                          <UInput
                            v-model="item.nomorSeri"
                            class="w-full"
                            placeholder="Contoh: 9634426H123456"
                          />
                        </UFormField>

                        <UFormField
                          :name="`items.${index}.produk`"
                          class="min-w-0"
                          required
                        >
                          <UInput
                            v-model="item.produk"
                            class="w-full"
                            placeholder="Contoh: TELEVISI"
                          />
                        </UFormField>
                      </div>

                      <UTooltip text="Hapus item">
                        <UButton
                          type="button"
                          color="error"
                          variant="ghost"
                          icon="i-lucide-trash-2"
                          size="sm"
                          :aria-label="`Hapus item ${index + 1}`"
                          @click="removeItem(index)"
                        />
                      </UTooltip>
                    </div>

                    
                  </div>

                  
                </div>
              </UCard>

              <UCard>
                <template #header>
                  <div class="flex items-start gap-3">
                    <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <UIcon name="i-lucide-paperclip" class="size-5" />
                    </div>
                    <div>
                      <h2 class="font-semibold text-highlighted">
                        Dokumen Pendukung
                      </h2>
                      <p class="mt-1 text-sm text-muted">
                        Lampiran disimpan pada level pengajuan.
                      </p>
                    </div>
                  </div>
                </template>

                <div class="space-y-5">
                  <UFormField
                    name="hardcopy"
                    label="Hardcopy pengajuan"
                    :description="`Wajib PDF. Maksimal ukuran file ${maxUploadMb} MB.`"
                    required
                  >
                    <UFileUpload
                      v-model="state.hardcopy"
                      class="w-full"
                      variant="area"
                      accept="application/pdf,.pdf"
                      label="Unggah hardcopy PDF"
                      description="Tarik file ke area ini atau pilih dari perangkat"
                      icon="i-lucide-file-up"
                      :preview="true"
                    />
                  </UFormField>

                  <UFormField
                    name="evidence"
                    label="Bukti / lampiran tambahan"
                    :description="`Opsional. PDF atau JPG, masing-masing maksimal ${maxUploadMb} MB.`"
                  >
                    <UFileUpload
                      v-model="state.evidence"
                      class="w-full"
                      variant="area"
                      multiple
                      accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg"
                      label="Unggah lampiran tambahan"
                      description="Tambahkan bukti pendukung bila diperlukan"
                      icon="i-lucide-images"
                      :preview="true"
                    />
                  </UFormField>
                </div>
              </UCard>
            </div>

            <aside class="space-y-6 xl:sticky xl:top-6 xl:self-start">
              <UCard>
                <template #header>
                  <div class="flex items-center justify-between gap-3">
                    <h2 class="font-semibold text-highlighted">
                      Ringkasan
                    </h2>
                    <UBadge color="info" variant="soft">
                      Baru
                    </UBadge>
                  </div>
                </template>

                <dl class="space-y-4 text-sm">
                  <div class="flex items-center justify-between gap-4">
                    <dt class="text-muted">
                      Item
                    </dt>
                    <dd class="font-medium text-highlighted">
                      {{ itemCount }}
                    </dd>
                  </div>
                  <div class="flex items-center justify-between gap-4">
                    <dt class="text-muted">
                      Lampiran
                    </dt>
                    <dd class="font-medium text-highlighted">
                      {{ attachmentCount }}
                    </dd>
                  </div>
                  <div class="flex items-center justify-between gap-4">
                    <dt class="text-muted">
                      Status
                    </dt>
                    <dd class="font-medium text-primary">
                      Menunggu review
                    </dd>
                  </div>
                </dl>
              </UCard>

              <UCard>
                <template #header>
                  <h2 class="font-semibold text-highlighted">
                    Checklist
                  </h2>
                </template>

                <ul class="space-y-3 text-sm text-muted">
                  <li class="flex items-start gap-2">
                    <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
                    Minimal satu item pengajuan
                  </li>
                  <li class="flex items-start gap-2">
                    <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
                    Model dan nomor serial lengkap
                  </li>
                  <li class="flex items-start gap-2">
                    <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
                    Hardcopy PDF wajib tersedia
                  </li>
                  <li class="flex items-start gap-2">
                    <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
                    Tidak ada duplikasi model dan serial
                  </li>
                </ul>
              </UCard>
            </aside>
          </div>

          <div class="flex flex-col-reverse gap-3 border-t border-default pt-6 sm:flex-row sm:justify-end">
            <UButton
              to="/dashboard/pengajuan"
              color="neutral"
              variant="outline"
              icon="i-lucide-x"
            >
              Batal
            </UButton>
            <UButton
              type="submit"
              icon="i-lucide-save"
              :loading="isSubmitting"
              :disabled="isSubmitting"
            >
              Simpan Pengajuan
            </UButton>
          </div>
        </UForm>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
