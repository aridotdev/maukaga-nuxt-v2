<template>
  <UCard class="shrink-0" :ui="{ body: 'px-0! pt-0! pb-3!' }">
    <template #header>
      <div class="flex flex-col gap-4">
        <div>
          <p class="text-xs text-muted uppercase mb-1.5">
            Tren Qty Item Pengajuan
          </p>
          <p class="text-3xl text-highlighted font-semibold">
            ---
          </p>
        </div>

        <div class="grid gap-2 sm:grid-cols-3">
          <div class="rounded-md border border-muted px-3 py-2">
            <p class="text-xs font-medium text-muted">
              Total Item Diajukan
            </p>
            <p class="mt-1 text-lg font-semibold text-highlighted">
              ---
            </p>
          </div>
          <div class="rounded-md border border-muted px-3 py-2">
            <p class="text-xs font-medium text-muted">
              Disetujui
            </p>
            <p class="mt-1 text-lg font-semibold text-highlighted">
              ---
            </p>
          </div>
          <div class="rounded-md border border-muted px-3 py-2">
            <p class="text-xs font-medium text-muted">
              Ditolak
            </p>
            <p class="mt-1 text-lg font-semibold text-highlighted">
              ---
            </p>
          </div>
        </div>
      </div>
    </template>

    <div class="h-96" />
  </UCard>
</template>
