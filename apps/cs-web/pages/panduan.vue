<script setup lang="ts">
definePageMeta({
  layout: 'cs'
})

type GuideItem = {
  title: string
  description: string
  icon: string
}

const formGuides: GuideItem[] = [
  {
    title: 'Isi data pemohon',
    description: 'Lengkapi nama pemohon, cabang, pemilik barang, tanggal form, alasan pengajuan, dan catatan jika ada.',
    icon: 'i-lucide-user-round'
  },
  {
    title: 'Tambah daftar produk',
    description: 'Masukkan model, nama produk, dan nomor seri. Gunakan tombol tambah item jika pengajuan berisi lebih dari satu unit.',
    icon: 'i-lucide-package-plus'
  },
  {
    title: 'Simpan draft dan cetak',
    description: 'Setelah data benar, simpan draft lalu cetak form untuk ditandatangani secara fisik.',
    icon: 'i-lucide-printer'
  },
  {
    title: 'Upload final submit',
    description: 'Buka halaman Final Submit, muat draft, lalu unggah scan atau foto hard copy yang sudah ditandatangani.',
    icon: 'i-lucide-upload-cloud'
  }
]

const statusGuides: GuideItem[] = [
  {
    title: 'Siapkan nomor seri',
    description: 'Gunakan nomor seri unit yang pernah diajukan, bukan ID pengajuan.',
    icon: 'i-lucide-barcode'
  },
  {
    title: 'Cari status unit',
    description: 'Masukkan nomor seri di halaman Cek Status untuk melihat keputusan unit dan tahap pengajuan kartu garansi.',
    icon: 'i-lucide-search'
  },
  {
    title: 'Baca keterangan status',
    description: 'Jika unit ditolak atau masih menunggu review, ikuti catatan yang tampil atau hubungi admin terkait.',
    icon: 'i-lucide-message-circle-warning'
  }
]
</script>

<template>
  <section class="mx-auto flex min-h-full w-full max-w-350 flex-col gap-6 p-0 sm:p-6 lg:p-8">
    <header class="rounded-xl border border-white/60 bg-white/45 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-xl lg:rounded-2xl lg:p-8">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
          <p class="mb-2 text-xs font-bold uppercase tracking-wider text-dimmed">
            Panduan Pengguna
          </p>
          <h1 class="text-2xl font-bold leading-tight text-highlighted lg:text-3xl">
            Cara Pengajuan Kartu Garansi
          </h1>
          <p class="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            Ikuti panduan singkat ini untuk mengisi form pengajuan, mengirim dokumen final, dan mengecek status kartu garansi unit.
          </p>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row lg:shrink-0">
          <UButton
            to="/new"
            label="Isi Form"
            icon="i-lucide-file-plus-2"
            color="primary"
            size="lg"
            class="justify-center"
          />
          <UButton
            to="/check-status"
            label="Cek Status"
            icon="i-lucide-radar"
            color="neutral"
            variant="outline"
            size="lg"
            class="justify-center"
          />
        </div>
      </div>
    </header>

    <div class="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <section class="rounded-xl border border-white/60 bg-white/45 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-xl lg:rounded-2xl lg:p-8">
        <div class="mb-6 flex items-center gap-3 border-b border-muted pb-4">
          <div class="flex size-10 items-center justify-center rounded-full border border-muted bg-default/60 text-highlighted shadow-sm">
            <UIcon name="i-lucide-clipboard-list" class="size-5" />
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-dimmed">
              Pengisian Form
            </p>
            <h2 class="text-xl font-bold text-highlighted">
              Alur Pengajuan
            </h2>
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div
            v-for="(item, index) in formGuides"
            :key="item.title"
            class="rounded-xl border border-muted bg-default/45 p-4 shadow-sm backdrop-blur-sm"
          >
            <div class="mb-4 flex items-center gap-3">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UIcon :name="item.icon" class="size-5" />
              </div>
              <span class="font-mono text-sm font-bold text-dimmed">
                {{ String(index + 1).padStart(2, '0') }}
              </span>
            </div>
            <h3 class="text-base font-bold text-highlighted">
              {{ item.title }}
            </h3>
            <p class="mt-2 text-sm leading-relaxed text-muted">
              {{ item.description }}
            </p>
          </div>
        </div>
      </section>

      <aside class="flex flex-col gap-6">
        <section class="rounded-xl border border-white/60 bg-white/45 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-xl lg:rounded-2xl lg:p-8">
          <div class="mb-6 flex items-center gap-3 border-b border-muted pb-4">
            <div class="flex size-10 items-center justify-center rounded-xl border border-muted bg-default/60 text-highlighted shadow-sm">
              <UIcon name="i-lucide-radar" class="size-5" />
            </div>
            <div>
              <p class="text-xs font-bold uppercase tracking-wider text-dimmed">
                Cek Status
              </p>
              <h2 class="text-xl font-bold text-highlighted">
                Pantau Unit
              </h2>
            </div>
          </div>

          <div class="space-y-4">
            <div
              v-for="item in statusGuides"
              :key="item.title"
              class="flex gap-3 rounded-xl border border-muted bg-default/40 p-4 shadow-sm backdrop-blur-sm"
            >
              <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UIcon :name="item.icon" class="size-4" />
              </div>
              <div>
                <h3 class="text-sm font-bold text-highlighted">
                  {{ item.title }}
                </h3>
                <p class="mt-1 text-xs leading-relaxed text-muted">
                  {{ item.description }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-white/60 bg-white/45 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-xl lg:rounded-2xl lg:p-8">
          <div class="flex items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UIcon name="i-lucide-info" class="size-5" />
            </div>
            <div>
              <h2 class="text-base font-bold text-highlighted">
                Tips Singkat
              </h2>
              <p class="mt-2 text-sm leading-relaxed text-muted">
                Pastikan nomor seri terbaca jelas dan dokumen final sudah ditandatangani sebelum diupload agar proses verifikasi lebih lancar.
              </p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </section>
</template>
