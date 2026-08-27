<script setup lang="ts">
definePageMeta({
  layout: 'cs'
})

defineOptions({
  name: 'CsForbiddenPage'
})
</script>

<template>
  <main class="flex min-h-full items-center justify-center px-6 py-12">
    <section class="flex w-full max-w-md flex-col items-center gap-5 text-center">
      <div class="flex size-14 items-center justify-center rounded-lg bg-error/10 text-error">
        <UIcon name="i-lucide-shield-x" class="size-7" />
      </div>

      <div class="space-y-2">
        <h1 class="text-4xl font-bold text-highlighted">
          403
        </h1>
        <p class="text-muted">
          Kamu tidak punya akses ke halaman ini.
        </p>
      </div>

      <UButton
        label="Kembali ke Portal"
        to="/"
        color="neutral"
        variant="soft"
        icon="i-lucide-arrow-left"
      />
    </section>
  </main>
</template>
