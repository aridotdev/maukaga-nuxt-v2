<script setup lang="ts">
type ReviewQueueItem = {
  idPengajuan?: string
  noItem?: number | string
  produk?: string
  model?: string
  nomorSeri?: string
  statusPengajuan?: string
  bagianCabang?: string
}

type ProductOption = {
  produk: string
  count: number
}

type ReviewQueueGroup = {
  model: string
  produk?: string
  count: number
  items?: ReviewQueueItem[]
  produkOptions?: ProductOption[]
}

const router = useRouter()
const toast = useToast()
const { callApi } = useAppsScriptApi()
const { invalidate } = useAppSheetInvalidate()

const {
  rows,
  isLoading,
  error: queryError,
  ensureLoaded,
  refresh
} = useReviewProductQueue()

const loadError = computed(() => queryError.value || '')

const productInputs = ref<Record<string, string>>({})
const approvingModels = ref<Record<string, boolean>>({})
const showAll = ref(false)

// Inisialisasi input untuk group baru saja (preserve nilai user yang sudah diketik).
watch(rows, (nextRows) => {
  nextRows.forEach((group) => {
    const key = getGroupKey(group)
    if (!(key in productInputs.value)) {
      productInputs.value[key] = group.produk ?? getTopProductOption(group) ?? ''
    }
  })
}, { immediate: true })

const pendingCount = computed(() => rows.value.reduce((total, group) => total + Number(group.count || 0), 0))
const visibleRows = computed(() => showAll.value ? rows.value : rows.value.slice(0, 3))

onMounted(() => {
  ensureLoaded()
})

watch(queryError, async (msg) => {
  if (msg && (msg.includes('Unauthorized') || msg.includes('Token admin'))) {
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_nama')
    sessionStorage.removeItem('admin_username')
    await router.push('/login')
  }
})

async function approveGroup(group: ReviewQueueGroup) {
  const key = getGroupKey(group)
  const produk = String(productInputs.value[key] || '').trim()

  if (!produk) {
    toast.add({
      title: 'Nama Produk wajib diisi',
      description: 'Isi nama produk yang benar sebelum approve.',
      color: 'warning',
      icon: 'i-lucide-triangle-alert'
    })
    return
  }

  approvingModels.value[key] = true

  try {
    const result = await callApi<{ model: string; produk: string; count: number }>('approveModelProduk', {
      model: group.model,
      produk
    })

    toast.add({
      title: 'Nama Produk disetujui',
      description: `${Number(result.data?.count || 0)} item diverifikasi untuk ${group.model}.`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    // Invalidate cache agar list & dashboard ikut segar.
    invalidate('getProductReviewQueue')
    invalidate('getDashboard')
    await refresh()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    toast.add({
      title: 'Approval gagal',
      description: message,
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })

    if (message.includes('Unauthorized')) {
      sessionStorage.removeItem('admin_token')
      sessionStorage.removeItem('admin_nama')
      sessionStorage.removeItem('admin_username')
      await router.push('/login')
    }
  } finally {
    approvingModels.value[key] = false
  }
}

function getGroupKey(group: ReviewQueueGroup) {
  return group.model || ''
}

function getTopProductOption(group: ReviewQueueGroup) {
  return group.produkOptions?.[0]?.produk || ''
}
</script>

<template>
  <UCard
    class="flex w-full shrink-0 flex-col lg:max-w-md"
    :ui="{
      root: 'overflow-hidden',
      header: 'pb-4',
      body: 'flex min-h-0 flex-1 flex-col gap-4 pt-0',
      footer: 'pt-4'
    }"
  >
    <template #header>
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 class="text-lg font-semibold text-highlighted">
            Antrean Review Produk
          </h2>
          <p class="mt-1 text-xs text-muted">
            Model baru menunggu verifikasi
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <UBadge
            color="warning"
            variant="subtle"
            :label="`${pendingCount} Pending`"
            class="font-semibold"
          />

          <UTooltip text="Refresh review">
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="sm"
              square
              :loading="isLoading"
              :disabled="isLoading"
              @click="refresh"
            />
          </UTooltip>
        </div>
      </div>
    </template>

    <UAlert
      v-if="loadError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Review Nama Produk belum bisa dimuat"
      :description="loadError"
    />

    <div
      v-if="isLoading && !rows.length"
      class="flex flex-col gap-3"
    >
      <USkeleton
        v-for="index in 3"
        :key="index"
        class="h-32 rounded-lg"
      />
    </div>

    <div
      v-else-if="!rows.length && !loadError"
      class="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-muted bg-elevated/30 px-4 py-10 text-center"
    >
      <UIcon
        name="i-lucide-circle-check"
        class="size-9 text-muted"
      />
      <p class="mt-3 text-sm font-medium text-highlighted">
        Tidak ada produk yang perlu direview
      </p>
      <p class="mt-1 text-xs text-muted">
        Item verified akan lanjut ke antrean cetak.
      </p>
    </div>

    <div
      v-else
      class="flex max-h-116 flex-col gap-3 overflow-y-auto pr-1"
    >
      <div
        v-for="group in visibleRows"
        :key="getGroupKey(group)"
        class="rounded-lg border border-muted bg-elevated/40 p-4 transition-colors hover:bg-elevated/70"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 items-start gap-2">
            <UIcon
              name="i-lucide-triangle-alert"
              class="mt-0.5 size-4 shrink-0 text-warning"
            />
            <div class="min-w-0">
              <h3 class="truncate text-sm font-semibold text-highlighted">
                {{ group.model }} - {{ group.produk }}
              </h3>
            </div>
          </div>

          <UBadge
            color="neutral"
            variant="soft"
            label="Manual"
            size="sm"
          />
        </div>

        <div class="mt-4 flex flex-col gap-2">
          <UFormField
            label="Nama Produk benar"
            size="sm"
          >
            <UInput
              v-model="productInputs[getGroupKey(group)]"
              placeholder="Nama Produk yang benar"
              icon="i-lucide-tag"
              class="w-full"
              :disabled="approvingModels[getGroupKey(group)]"
              @keyup.enter="approveGroup(group)"
            />
          </UFormField>

          <UButton
            block
            icon="i-lucide-check"
            label="Approve Nama Produk"
            color="primary"
            :loading="approvingModels[getGroupKey(group)]"
            :disabled="approvingModels[getGroupKey(group)]"
            @click="approveGroup(group)"
          />
        </div>
      </div>
    </div>

    <template
      v-if="rows.length > 3"
      #footer
    >
      <UButton
        block
        color="neutral"
        variant="ghost"
        :trailing-icon="showAll ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        :label="showAll ? 'Tampilkan Lebih Sedikit' : 'Lihat Semua Antrean'"
        @click="showAll = !showAll"
      />
    </template>
  </UCard>
</template>
