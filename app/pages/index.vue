<script setup lang="ts">
definePageMeta({
  layout: 'cs'
})

// const glassCardClass = 'group flex cursor-pointer flex-col items-center justify-between rounded-3xl border border-white/60 bg-white/45 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-2xl transition-all duration-400 ease-out hover:-translate-y-2.5 hover:scale-[1.02] hover:border-white/80 hover:bg-white/65 hover:shadow-[0_24px_48px_rgba(15,23,42,0.08)] md:p-8'
// const iconContainerClass = 'mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/60 text-[#0F172A] shadow-sm transition-all duration-400 ease-out group-hover:scale-110 group-hover:rotate-3 group-hover:bg-[#0F172A] group-hover:text-white md:mb-8 md:h-14 md:w-14'
const actionButtonClass = 'flex max-w-lg items-center justify-center gap-2 rounded-full border border-transparent bg-[#0F172A] lg:px-10 lg:py-6 px-5 py-3 text-lg font-semibold text-white shadow-sm transition-all duration-400 ease-out group-hover:scale-[1.02] group-hover:border-white/80 group-hover:bg-white/65 group-hover:text-[#0F172A] group-hover:shadow-[0_24px_48px_rgba(15,23,42,0.08)] group-hover:backdrop-blur-2xl md:w-auto'
</script>

<template>
  <!-- LAUNCHER CENTRAL PORTAL -->
  <section class="mx-auto flex w-full flex-1 flex-col items-center justify-center lg:py-10 md:py-0 gap-20">
    <!-- Title & Greeting Section -->
    <div class="mb-8 max-w-2xl px-4 text-center md:mb-12">
      <NuxtLink
        to="/login"
        class="inline-block w-fit flex-none self-center rounded-full border border-white/60 bg-white/40 px-4 py-1.5 text-xs font-semibold text-[#0F172A] shadow-sm backdrop-blur-sm"
      >
        Internal Portal QRCC - Cabang / CS
      </NuxtLink>
      <h2 class="my-3 text-3xl font-bold tracking-tight text-[#0F172A] md:mb-4 md:text-5xl lg:leading-16">
        Selamat Datang di Portal Kartu Garansi
      </h2>
      <p class="mt-4 text-sm text-[#64748B] md:text-base">
        Pusat pengelolaan dan pengajuan cetak ulang kartu garansi
      </p>
      
    </div>

    <!-- MAIN CTA -->
    <div class="flex flex-col max-w-4xl gap-6 items-center">
      <!-- CTA BUAT PERMINTAAN BARU -->
      <NuxtLink to="/new" class="group">
        <span :class="actionButtonClass">
          <span class="lg:text-2xl">Buat Permintaan Baru</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="lg:h-8 lg:w-8 h-6 w-6 transition-transform duration-400 ease-out group-hover:scale-[1.02]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </span>
      </NuxtLink>

      <p class="text-sm text-[#64748B] md:text-base text-center">
        Atau 
        <NuxtLink to="/check-status" class="font-semibold text-[#0F172A] underline hover:no-underline">
          Cek Status Pengajuan
        </NuxtLink>
        kartu garansi yang telah dibuat sebelumnya.
      </p>
    </div>
  </section>
</template>
