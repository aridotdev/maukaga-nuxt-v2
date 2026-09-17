<script setup lang="ts">
import type { WarrantyPrintQueueRow } from '~/types/print'

const PRINT_BODY_CLASS = 'is-warranty-card-printing'

defineProps<{
  rows: WarrantyPrintQueueRow[]
}>()

let resolvePrint: (() => void) | null = null
let printFallback: ReturnType<typeof setTimeout> | null = null

async function print() {
  await nextTick()
  await waitForAnimationFrame()

  document.body.classList.add(PRINT_BODY_CLASS)
  await waitForAnimationFrame()
  await waitForAnimationFrame()

  await new Promise<void>((resolve) => {
    resolvePrint = resolve
    try {
      window.print()
    } finally {
      printFallback = setTimeout(finishPrint, 500)
    }
  })
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function handleAfterPrint() {
  finishPrint()
}

function finishPrint() {
  if (printFallback) {
    clearTimeout(printFallback)
    printFallback = null
  }

  document.body.classList.remove(PRINT_BODY_CLASS)
  resolvePrint?.()
  resolvePrint = null
}

onMounted(() => {
  window.addEventListener('afterprint', handleAfterPrint)
})

onBeforeUnmount(() => {
  window.removeEventListener('afterprint', handleAfterPrint)
  finishPrint()
})

defineExpose({ print })
</script>

<template>
  <Teleport to="body">
    <div class="warranty-card-print-root">
      <section
        v-for="row in rows"
        :key="row.key"
        class="warranty-print-page"
        :class="row.jenisKartuKey === 'import' ? 'import' : 'local'"
      >
        <div class="warranty-field warranty-product">
          {{ row.produk }}
        </div>
        <div class="warranty-field warranty-model">
          {{ row.model }}
        </div>
        <div class="warranty-field warranty-serial">
          {{ row.nomorSeri }}
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.warranty-card-print-root {
  display: none;
}

.warranty-print-page {
  position: relative;
  width: 210mm;
  height: 297mm;
  background: #fff;
  color: #000;
  page-break-inside: avoid;
  break-inside: avoid;
}

.warranty-print-page.local {
  --warranty-base-x: 5mm;
  --warranty-base-y: -5mm;
}

.warranty-print-page.import {
  --warranty-base-x: 0mm;
  --warranty-base-y: 3mm;
}

.warranty-field {
  position: absolute;
  overflow: hidden;
  white-space: nowrap;
  text-align: center;
  font-family: Arial, sans-serif;
  color: #000;
  transform: translate(var(--warranty-base-x), var(--warranty-base-y));
}

.warranty-product {
  left: 0mm;
  top: 216mm;
  width: 125mm;
  height: 7mm;
  font-size: 14pt;
  line-height: 7mm;
}

.warranty-model {
  left: 0mm;
  top: 235mm;
  width: 62mm;
  height: 6mm;
  font-size: 10pt;
  line-height: 6mm;
}

.warranty-serial {
  left: 73mm;
  top: 235mm;
  width: 52mm;
  height: 6mm;
  font-size: 10pt;
  line-height: 6mm;
}

@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }

  :global(html),
  :global(body) {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  :global(body.is-warranty-card-printing > *:not(.warranty-card-print-root)) {
    display: none !important;
  }

  :global(body.is-warranty-card-printing .warranty-card-print-root) {
    display: block !important;
  }

  .warranty-print-page {
    page-break-after: always;
    break-after: page;
  }

  .warranty-print-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
}
</style>
