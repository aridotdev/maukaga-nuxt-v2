<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'

type DashboardStatus = 'Baru' | 'Disetujui' | 'Ditolak' | 'Diprint' | 'Dikirim' | 'Selesai'

type DashboardPengajuanRow = {
  nomor?: number
  idPengajuan: string
  timestampSubmit: string
  nama: string
  bagianCabang: string
  jumlahItem: number | string
  status: DashboardStatus | string
}

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const router = useRouter()
const { latestRows, isLoading, error, ensureLoaded } = useDashboardLatestData()

// Type data di sini kompatibel dengan UTable (latestRows dari useDashboardLatestData).
const columns: TableColumn<DashboardPengajuanRow>[] = [{
  accessorKey: 'nomor',
  header: 'No',
  meta: { class: { th: 'w-14', td: 'w-14' } },
  cell: ({ row }) => h('span', { class: 'font-medium text-muted' }, row.original.nomor)
}, {
  accessorKey: 'idPengajuan',
  header: 'ID Pengajuan',
  meta: { class: { th: 'w-[18%]', td: 'w-[18%]' } },
  cell: ({ row }) => h('span', { class: 'font-mono text-sm font-semibold text-highlighted' }, row.original.idPengajuan)
}, {
  accessorKey: 'timestampSubmit',
  header: 'Waktu Submit',
  meta: { class: { th: 'w-[17%]', td: 'w-[17%]' } },
  cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatSubmitTime(row.original.timestampSubmit))
}, {
  accessorKey: 'nama',
  header: 'Nama',
  meta: { class: { th: 'w-[27%]', td: 'w-[27%]' } },
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'truncate text-sm font-semibold text-highlighted' }, row.original.nama || '-'),
  ])
}, {
  accessorKey: 'bagianCabang',
  header: 'Cabang',
  meta: { class: { th: 'w-[27%]', td: 'w-[27%]' } },
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'truncate text-sm text-muted' }, row.original.bagianCabang || '-')
  ])
}, {
  accessorKey: 'jumlahItem',
  header: () => h('div', { class: 'text-center' }, 'Jml Item'),
  meta: { class: { th: 'w-[10%]', td: 'w-[10%]' } },
  cell: ({ row }) => h('div', { class: 'text-center font-medium text-toned' }, row.original.jumlahItem || 0)
}, {
  accessorKey: 'status',
  header: 'Proses Kartu',
  meta: { class: { th: 'w-[16%]', td: 'w-[16%]' } },
  cell: ({ row }) => renderPengajuanProcess(row.original.status)
}, {
  id: 'actions',
  header: () => h('div', { class: 'text-right' }, 'Aksi'),
  meta: { class: { th: 'w-[14%]', td: 'w-[14%]' } },
  cell: ({ row }) => h('div', { class: 'flex justify-end' }, [
    h(UButton, {
      label: 'Detail',
      icon: 'i-lucide-eye',
      color: 'neutral',
      variant: 'soft',
      size: 'sm',
      onClick: () => showDetail(row.original)
    })
  ])
}]

onMounted(() => {
  ensureLoaded()
})

watch(error, async (msg) => {
  if (msg && (msg.includes('Unauthorized') || msg.includes('Token admin'))) {
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_nama')
    sessionStorage.removeItem('admin_username')
    await router.push('/login')
  }
})

function showDetail(row: DashboardPengajuanRow) {
  if (!row.idPengajuan) return
  const url = router.resolve(`/dashboard/pengajuan/${encodeURIComponent(row.idPengajuan)}`).href
  window.open(url, '_blank')
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
</script>

<template>
  <section class="relative mt-6 rounded-lg border border-muted bg-default/45 shadow-sm backdrop-blur-xl">
    <div class="border-b border-muted px-4 py-4 sm:px-6">
      <div class="min-w-0 flex justify-between items-center gap-4 sm:flex-row">
        <h2 class="text-base font-semibold text-highlighted sm:text-lg">
          Daftar Pengajuan Terbaru
        </h2>
        <NuxtLink
          to="/dashboard/pengajuan"
          class="mt-1 inline-flex items-center text-sm font-medium text-primary hover:text-primary/80"
        >
          Lihat Semua
          <UIcon name="i-lucide-arrow-right" class="size-4 ml-1" />
        </NuxtLink>
      </div>
    </div>

    <div class="min-h-0 w-full overflow-x-auto">
      <UTable
        :data="latestRows"
        :columns="columns"
        :loading="isLoading"
        class="w-full"
        :ui="{
          root: 'w-full',
          base: 'w-full min-w-190 table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/45 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          tr: 'transition-colors hover:bg-elevated/30',
          th: 'border-b border-muted px-4 py-3 text-xs font-semibold uppercase text-muted',
          td: 'border-b border-muted px-4 py-4 text-sm align-middle',
          separator: 'h-0'
        }"
      >
        <template #empty>
          <div class="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <UIcon
              :name="error ? 'i-lucide-circle-alert' : 'i-lucide-inbox'"
              class="size-8 text-muted"
            />
            <p class="text-sm font-medium text-highlighted">
              {{ error ? 'Data pengajuan belum bisa dimuat' : 'Belum ada pengajuan final' }}
            </p>
            <p v-if="error" class="max-w-md text-sm text-muted">
              {{ error }}
            </p>
          </div>
        </template>
      </UTable>
    </div>
  </section>
</template>
