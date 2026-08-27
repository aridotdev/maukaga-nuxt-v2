<script setup lang="ts">
definePageMeta({
  layout: 'cs'
})

defineOptions({
  name: 'CsNotFoundPage'
})
</script>

<template>
  <section class="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-5 p-6 text-center">
    <div class="flex size-14 items-center justify-center rounded-xl bg-white/70 text-[#0F172A] shadow-sm backdrop-blur-xl">
      <UIcon name="i-lucide-circle-alert" class="size-7" />
    </div>

    <div class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight text-[#0F172A]">
        Halaman tidak ditemukan
      </h1>
      <p class="text-sm leading-relaxed text-[#64748B]">
        Periksa kembali alamat halaman atau kembali ke portal utama.
      </p>
    </div>

    <UButton
      label="Kembali ke Portal"
      to="/"
      color="neutral"
      variant="solid"
      icon="i-lucide-arrow-left"
    />
  </section>
</template>
