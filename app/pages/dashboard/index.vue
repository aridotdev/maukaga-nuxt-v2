<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  middleware: ['auth-guard', 'role-guard'],
})

type SummaryCard = {
  label: string
  value: number
  description: string
  icon: string
  to: string
}

type StatusSummary = {
  label: string
  value: number
  color: 'primary' | 'info' | 'warning' | 'success' | 'error' | 'neutral'
}

type QueueItem = {
  label: string
  description: string
  value: number
  icon: string
  color: 'warning' | 'info' | 'success'
  to: string
}

type RecentSubmission = {
  id: string
  pemohon: string
  cabang: string
  items: number
  status: string
  statusColor: 'primary' | 'info' | 'warning' | 'success' | 'error' | 'neutral'
  createdAt: string
}

const periodItems = ref(['This month', 'Last month', 'Last 3 months', 'Last 6 months', 'This year', 'Last year'])
const selectedPeriod = ref('This month')

const summaryCards: SummaryCard[] = [{
  label: 'Total Pengajuan',
  value: 128,
  description: 'Semua pengajuan aktif',
  icon: 'i-lucide-files',
  to: '/dashboard/pengajuan',
}, {
  label: 'Perlu Review',
  value: 24,
  description: 'Menunggu keputusan item',
  icon: 'i-lucide-clipboard-check',
  to: '/dashboard/pengajuan',
}, {
  label: 'Siap Dicetak',
  value: 17,
  description: 'Item disetujui dan belum dicetak',
  icon: 'i-lucide-printer',
  to: '/dashboard/cetak-kartu',
}, {
  label: 'Siap Dikirim',
  value: 9,
  description: 'Item sudah dicetak',
  icon: 'i-lucide-send',
  to: '/dashboard/cetak-label-kirim',
}]

const statusSummary: StatusSummary[] = [{
  label: 'Baru',
  value: 24,
  color: 'primary',
}, {
  label: 'Disetujui',
  value: 36,
  color: 'info',
}, {
  label: 'Diprint',
  value: 17,
  color: 'warning',
}, {
  label: 'Dikirim',
  value: 18,
  color: 'success',
}, {
  label: 'Selesai',
  value: 25,
  color: 'neutral',
}, {
  label: 'Ditolak',
  value: 8,
  color: 'error',
}]

const queueItems: QueueItem[] = [{
  label: 'Review pengajuan',
  description: 'Pengajuan menunggu pemeriksaan',
  value: 24,
  icon: 'i-lucide-clipboard-check',
  color: 'warning',
  to: '/dashboard/pengajuan',
}, {
  label: 'Antrean cetak kartu',
  description: 'Item siap masuk proses cetak',
  value: 17,
  icon: 'i-lucide-printer',
  color: 'info',
  to: '/dashboard/cetak-kartu',
}, {
  label: 'Antrean label kirim',
  description: 'Item siap dibuatkan label',
  value: 9,
  icon: 'i-lucide-tags',
  color: 'success',
  to: '/dashboard/cetak-label-kirim',
}]

const recentSubmissions: RecentSubmission[] = [{
  id: 'KG-20261017-0012',
  pemohon: 'Andi Setiawan',
  cabang: 'Jakarta Selatan',
  items: 2,
  status: 'Baru',
  statusColor: 'primary',
  createdAt: '17 Okt 2026, 09:42',
}, {
  id: 'KG-20261017-0011',
  pemohon: 'Siti Rahma',
  cabang: 'Bandung',
  items: 1,
  status: 'Disetujui',
  statusColor: 'info',
  createdAt: '17 Okt 2026, 09:18',
}, {
  id: 'KG-20261016-0010',
  pemohon: 'Budi Santoso',
  cabang: 'Surabaya',
  items: 3,
  status: 'Diprint',
  statusColor: 'warning',
  createdAt: '16 Okt 2026, 16:24',
}, {
  id: 'KG-20261016-0009',
  pemohon: 'Maya Lestari',
  cabang: 'Medan',
  items: 1,
  status: 'Dikirim',
  statusColor: 'success',
  createdAt: '16 Okt 2026, 14:06',
}, {
  id: 'KG-20261015-0008',
  pemohon: 'Rizky Pratama',
  cabang: 'Semarang',
  items: 2,
  status: 'Selesai',
  statusColor: 'neutral',
  createdAt: '15 Okt 2026, 11:37',
}]

const recentSubmissionColumns: TableColumn<RecentSubmission>[] = [{
  accessorKey: 'id',
  header: 'ID Pengajuan',
}, {
  accessorKey: 'pemohon',
  header: 'Pemohon',
}, {
  accessorKey: 'cabang',
  header: 'Cabang',
}, {
  accessorKey: 'items',
  header: 'Item',
}, {
  accessorKey: 'status',
  header: 'Status',
}, {
  accessorKey: 'createdAt',
  header: 'Dibuat',
}]

const totalSubmissions = statusSummary.reduce((total, status) => total + status.value, 0)

function getStatusPercentage(value: number): number {
  return Math.round((value / totalSubmissions) * 100)
}
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Home">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              to="/dashboard/pengajuan"
              icon="i-lucide-list"
              color="neutral"
              variant="soft"
              class="hidden sm:inline-flex"
            >
              Lihat Pengajuan
            </UButton>
            <UButton
              to="/dashboard/pengajuan/create"
              icon="i-lucide-plus"
            >
              Pengajuan Baru
            </UButton>
          </div>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left >
          <USelect 
            v-model="selectedPeriod" 
            :items="periodItems" 
            label="Periode aktif" 
            class="w-48"
          />
        </template>    
      </UDashboardToolbar>
    </template>

    <template #body>
      <HomeStats />
    </template>
  </UDashboardPanel>
</template>
