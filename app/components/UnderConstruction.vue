<script setup lang="ts">
type CenterMode = 'parent' | 'screen'

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  appName?: string
  centerMode?: CenterMode
  progressLabel?: string
  progressStatus?: string
  backLabel?: string
  contactLabel?: string
  contactTo?: string
  showBackButton?: boolean
  showContactButton?: boolean
  showFooter?: boolean
}>(), {
  title: 'Sedang Dalam Pembangunan',
  description: undefined,
  appName: 'Mau KaGa',
  centerMode: 'parent',
  progressLabel: 'Proses Penyiapan Sistem',
  progressStatus: 'Segera Hadir',
  backLabel: 'Kembali ke Halaman Sebelumnya',
  contactLabel: 'Hubungi Tim IT',
  contactTo: undefined,
  showBackButton: true,
  showContactButton: true,
  showFooter: true
})

const router = useRouter()

const sectionClass = computed(() => [
  'relative flex w-full flex-1 items-center justify-center overflow-hidden px-4 py-12 text-slate-700 sm:px-8',
  props.centerMode === 'screen' ? 'min-h-screen' : 'min-h-full',
  props.showFooter ? 'pb-20' : ''
])

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push('/')
}

</script>

<template>
  <section :class="sectionClass">
    <main class="glass-panel relative z-10 w-full max-w-2xl rounded-lg px-6 py-8 text-center sm:px-12 sm:py-12">
      <div class="relative mx-auto mb-8 flex size-32 items-center justify-center">
        <div class="absolute inset-4 rounded-full bg-[#0a192f]/10 blur-xl" />

        <div class="relative z-10 flex size-24 items-center justify-center rounded-lg border border-white/80 bg-white/65 text-[#0a192f] shadow-sm backdrop-blur-md">
          <UIcon
            name="i-lucide-cog"
            class="construction-spin size-14"
          />
        </div>

        <div class="absolute -right-2 bottom-0 z-20 flex size-12 items-center justify-center rounded-lg border-2 border-white bg-sky-100 text-sky-600 shadow-md">
          <UIcon
            name="i-lucide-wrench"
            class="size-6"
          />
        </div>
      </div>

      <h1 class="mb-4 text-3xl font-bold tracking-normal text-[#0a192f] sm:text-4xl">
        {{ title }}
      </h1>
      <p
        v-if="description"
        class="mx-auto mb-8 max-w-lg text-base leading-relaxed text-slate-500 sm:text-lg"
      >
        {{ description }}
      </p>
      <p
        v-else
        class="mx-auto mb-8 max-w-lg text-base leading-relaxed text-slate-500 sm:text-lg"
      >
        Sistem <span class="font-semibold text-[#0a192f]">{{ appName }}</span> sedang diracik dan disempurnakan oleh tim kami. Kami sedang mempersiapkan fitur-fitur baru untuk pengalaman yang lebih baik.
      </p>

      <div class="mx-auto mb-10 w-full max-w-md">
        <div class="mb-2 flex items-center justify-between gap-4 px-1">
          <span class="text-left text-xs font-semibold uppercase tracking-widest text-slate-400">{{ progressLabel }}</span>
          <span class="shrink-0 text-xs font-bold text-[#0a192f]">{{ progressStatus }}</span>
        </div>
        <div class="loading-track h-2.5 w-full rounded-full">
          <div class="loading-bar construction-progress h-full" />
        </div>
      </div>

      <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <UButton
          v-if="showBackButton"
          :label="backLabel"
          icon="i-lucide-arrow-left"
          color="neutral"
          size="lg"
          class="w-full justify-center bg-[#0a192f] text-white shadow-lg shadow-[#0a192f]/20 hover:bg-[#102a43] sm:w-auto"
          @click="goBack"
        />
      </div>
    </main>

  </section>
</template>

<style scoped>
.glass-panel {
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 12px 40px 0 rgba(10, 25, 47, 0.08);
  backdrop-filter: blur(20px);
}

.loading-track {
  position: relative;
  overflow: hidden;
  background: rgba(10, 25, 47, 0.1);
}

.loading-bar {
  position: absolute;
  inset-block: 0;
  border-radius: 9999px;
  background: #0a192f;
}

.construction-spin {
  animation: construction-spin 4s linear infinite;
}

.construction-progress {
  animation: construction-progress 2s ease-in-out infinite;
}

@keyframes construction-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes construction-progress {
  0% {
    left: 0%;
    width: 0%;
  }

  50% {
    left: 0%;
    width: 100%;
  }

  100% {
    left: 100%;
    width: 0%;
  }
}
</style>
