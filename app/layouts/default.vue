<script setup lang="ts">
const isMobileMenuOpen = ref(false)
const { label: appVersionLabel, title: appVersionTitle } = useAppBuildInfo()
const desktopNavLinkClass = [
  'rounded-full border border-transparent bg-transparent px-4 py-1.5',
  'text-xs font-semibold text-[#0F172A]',
  'transition-all duration-300 ease-out',
  'hover:border-white/60 hover:bg-white/40 hover:shadow-sm hover:backdrop-blur-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A]/30 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent',
].join(' ')
</script>

<template>
  <div
    class="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[linear-gradient(135deg,#DDE4E8_0%,#F0F4F8_100%)] p-6 antialiased selection:bg-slate-200 md:p-8 font-[Inter,sans-serif]"
  >
    <!-- BACKGROUND ILLUSTRATION & GEOMETRIC SHAPES -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <!-- SVG Mesh Grid & Certificate Shield Illustration Line Art -->
      <svg
        class="absolute h-full w-full text-slate-300/40"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id="layout-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="currentColor"
              stroke-width="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#layout-grid)" />

        <!-- Abstract Guilloche/Security Lines -->
        <path
          d="M-100,200 Q 300,50 700,400 T 1500,200 T 2100,600"
          fill="none"
          stroke="rgba(15, 23, 42, 0.04)"
          stroke-width="3"
        />
        <path
          d="M-100,250 Q 300,100 700,450 T 1500,250 T 2100,650"
          fill="none"
          stroke="rgba(15, 23, 42, 0.03)"
          stroke-width="2"
        />
        <path
          d="M-100,300 Q 300,150 700,500 T 1500,300 T 2100,700"
          fill="none"
          stroke="rgba(15, 23, 42, 0.02)"
          stroke-width="1.5"
        />
      </svg>

      <!-- Floating Soft Glass Orbs -->
      <div
        class="pointer-events-none absolute left-[-5%] top-[-10%] z-0 h-[60vw] w-[60vw] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.12)_0%,rgba(255,255,255,0)_70%)] opacity-[0.65] md:h-[45vw] md:w-[45vw]"
      />
      <div
        class="pointer-events-none absolute bottom-[-15%] right-[-5%] z-0 h-[70vw] w-[70vw] rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.06)_0%,rgba(255,255,255,0)_70%)] opacity-[0.65] md:h-[50vw] md:w-[50vw]"
      />

      <!-- Central Graphic Behind Page Content -->
      <div
        class="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-slate-900 opacity-[0.03] md:block"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-150 w-150"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      </div>
    </div>

    <!-- HEADER BRANDING -->
    <header class="relative z-10 mx-auto mt-2 flex w-full max-w-7xl items-center justify-between gap-4">
      <NuxtLink
        to="/"
        class="flex items-center gap-3 rounded-2xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#0F172A]/30 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent"
        aria-label="Kembali ke halaman utama Mau KaGa"
      >
        <!-- App Logo Box -->
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0F172A] shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div class="hidden lg:flex items-start gap-2">
          <h1 class="text-2xl font-bold leading-tight tracking-tight text-[#0F172A]">Mau KaGa</h1>
        </div>
      </NuxtLink>

      <div class="hidden items-center gap-2 md:flex">
        <NuxtLink
          to="/check-status"
          :class="desktopNavLinkClass"
        >
          Cek Status Pengajuan
        </NuxtLink>
        <NuxtLink
          to="/final-submit"
          :class="desktopNavLinkClass"
        >
          Final Submit
        </NuxtLink>
        <NuxtLink
          to="/print-ulang"
          :class="desktopNavLinkClass"
        >
          Print Ulang Pengajuan
        </NuxtLink>
        <NuxtLink
          to="/panduan"
          :class="desktopNavLinkClass"
        >
          Panduan Pengguna
        </NuxtLink>
        
      </div>

      <button
        type="button"
        class="group flex h-10 w-10 items-center justify-center rounded-xl border border-white/60 bg-white/40 text-[#0F172A] shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:bg-white/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A]/30 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent md:hidden"
        aria-label="Buka menu"
        :aria-expanded="isMobileMenuOpen"
        @click="isMobileMenuOpen = true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 transform-gpu transition-transform duration-300 ease-out group-hover:scale-110 group-active:scale-95"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
    </header>

    <div
      class="fixed inset-0 z-30 bg-[#0F172A]/20 backdrop-blur-sm transition-opacity duration-300 ease-out md:hidden"
      :class="isMobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'"
      :aria-hidden="!isMobileMenuOpen"
      :inert="!isMobileMenuOpen"
      @click.self="isMobileMenuOpen = false"
    >
      <nav
        class="ml-auto flex h-full w-[min(78vw,20rem)] transform-gpu flex-col gap-3 border-l border-white/60 bg-white/70 px-6 pb-6 pt-8 shadow-[0_24px_48px_rgba(15,23,42,0.16)] backdrop-blur-2xl transition-all duration-300 ease-out"
        :class="isMobileMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'"
        aria-label="Menu mobile"
      >
        <button
          type="button"
          class="group mb-3 flex h-10 w-10 items-center justify-center self-end rounded-xl border border-white/60 bg-white/50 text-[#0F172A] shadow-sm transition-all duration-300 ease-out hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A]/30"
          aria-label="Tutup menu"
          @click="isMobileMenuOpen = false"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 transform-gpu transition-transform duration-300 ease-out group-hover:rotate-90 group-hover:scale-110 group-active:scale-95"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <NuxtLink
          to="/check-status"
          class="rounded-2xl border border-white/60 bg-white/45 px-4 py-3 text-sm font-semibold text-[#0F172A] shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:bg-white/70"
          @click="isMobileMenuOpen = false"
        >
          Cek Status Pengajuan
        </NuxtLink>
        <NuxtLink
          to="/final-submit"
          class="rounded-2xl border border-white/60 bg-white/45 px-4 py-3 text-sm font-semibold text-[#0F172A] shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:bg-white/70"
          @click="isMobileMenuOpen = false"
        >
          Final Submit
        </NuxtLink>
        <NuxtLink
          to="/print-ulang"
          class="rounded-2xl border border-white/60 bg-white/45 px-4 py-3 text-sm font-semibold text-[#0F172A] shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:bg-white/70"
          @click="isMobileMenuOpen = false"
        >
          Print Ulang Pengajuan
        </NuxtLink>
        <NuxtLink
          to="/panduan"
          class="rounded-2xl border border-white/60 bg-white/45 px-4 py-3 text-sm font-semibold text-[#0F172A] shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:bg-white/70"
          @click="isMobileMenuOpen = false"
        >
          Panduan Pengguna
        </NuxtLink>
        <div class="mt-auto rounded-xl border border-white/60 bg-white/45 px-4 py-3 font-mono text-[11px] font-semibold text-[#64748B] shadow-sm">
          v{{ appVersionLabel }}
        </div>
      </nav>
    </div>

    <main class="relative z-10 mx-auto flex w-full max-w-400 flex-1 flex-col py-10">
      <slot />
    </main>

    <!-- FOOTER -->
    <footer class="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-1 pb-2 text-center text-xs font-medium text-[#64748B]">
      <span>&copy; 2026 Mau KaGa QRCC System. All rights reserved.</span>
      <span class="font-mono" :title="appVersionTitle">v{{ appVersionLabel }}</span>
    </footer>
  </div>
</template>
