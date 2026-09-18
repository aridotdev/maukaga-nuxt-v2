<script setup lang="ts">
import type { ShippingLabel } from '~/types/print'
import { chunkShippingLabels } from '~/utils/print'

const PRINT_BODY_CLASS = 'is-shipping-label-printing'

const props = defineProps<{
  labels: ShippingLabel[]
}>()

const pages = computed(() => chunkShippingLabels(props.labels))

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
    <div class="shipping-label-print-root">
      <section
        v-for="(page, pageIndex) in pages"
        :key="`shipping-page-${pageIndex}`"
        class="shipping-label-print-page"
      >
        <article
          v-for="label in page"
          :key="`${label.bagianCabang}::${label.nama}`"
          class="shipping-label"
        >
          <p class="shipping-label-name">
            {{ label.nama }}
          </p>
          <p class="shipping-label-branch">
            {{ label.bagianCabang }}
          </p>
        </article>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.shipping-label-print-root {
  display: none;
}

.shipping-label-print-page {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(3, 60mm);
  grid-template-rows: repeat(5, 50mm);
  gap: 4mm 5mm;
  width: 210mm;
  min-height: 297mm;
  padding: 10mm;
  background: #fff;
  color: #000;
  page-break-inside: avoid;
  break-inside: avoid;
}

.shipping-label {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4mm;
  width: 60mm;
  height: 50mm;
  padding: 5mm 4mm;
  border: 1px solid #cbd5e1;
  background: #fff;
  font-family: Arial, sans-serif;
  text-align: center;
  overflow-wrap: anywhere;
}

.shipping-label-name {
  margin: 0;
  font-size: 20pt;
  font-weight: 700;
  line-height: 1.1;
}

.shipping-label-branch {
  margin: 0;
  font-size: 13pt;
  line-height: 1.2;
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

  :global(body.is-shipping-label-printing > *:not(.shipping-label-print-root)) {
    display: none !important;
  }

  :global(body.is-shipping-label-printing .shipping-label-print-root) {
    display: block !important;
  }

  .shipping-label-print-page {
    page-break-after: always;
    break-after: page;
  }

  .shipping-label-print-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
}
</style>
