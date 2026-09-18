<script setup lang="ts">
import type { ShippingLabel } from '~/types/print'
import { chunkShippingLabels } from '~/utils/print'

const PRINT_BODY_CLASS = 'is-shipping-label-printing'

const props = defineProps<{
  labels: ShippingLabel[]
}>()

const pages = computed(() => chunkShippingLabels(props.labels, 24))

function getBranchClasses(cabang: string) {
  const branchLength = String(cabang || '').trim().length

  return {
    'shipping-label-branch--compact': branchLength >= 15,
    'shipping-label-branch--tight': branchLength >= 24,
  }
}

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
  <div class="shipping-label-print-root">
    <section
      v-for="(page, pageIndex) in pages"
      :key="pageIndex"
      class="shipping-label-print-page shipping-label-sheet"
    >
      <article
        v-for="label in page"
        :key="`${label.bagianCabang}-${label.nama}`"
        class="shipping-label-card"
      >
        <div class="shipping-label-recipient">
          <div
            class="shipping-label-branch"
            :class="getBranchClasses(label.bagianCabang)"
          >
            {{ label.bagianCabang }}
          </div>
          <div class="shipping-label-name">
            {{ label.nama }}
          </div>
        </div>
        <div class="shipping-label-qty-row">
          <span>QTY ITEM</span>
          <strong>{{ label.qty }}</strong>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.shipping-label-print-root {
  display: none;
}

.shipping-label-sheet {
  width: 210mm;
  min-height: 297mm;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(3, 60mm);
  grid-auto-rows: 30mm;
  align-content: start;
  justify-content: center;
  padding: 10mm;
  background: #fff;
  color: #0f172a;
}

.shipping-label-card {
  width: 60mm;
  height: 30mm;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  break-inside: avoid;
  page-break-inside: avoid;
  border: 1px solid #cbd5e1;
  padding: 3mm 3mm 2.5mm;
  background: #fff;
  font-family: Arial, sans-serif;
}

.shipping-label-branch {
  display: -webkit-box;
  max-height: 2.1em;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: 0;
  text-transform: uppercase;
}

.shipping-label-branch--compact {
  max-height: 2.16em;
  font-size: 15px;
  line-height: 1.08;
}

.shipping-label-branch--tight {
  max-height: 2.2em;
  font-size: 13px;
  line-height: 1.1;
}

.shipping-label-recipient {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.5mm;
}

.shipping-label-name {
  overflow-wrap: anywhere;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: 0;
  color: #334155;
}

.shipping-label-qty-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2mm;
  border-top: 1px solid #cbd5e1;
  padding-top: 1.5mm;
}

.shipping-label-qty-row span {
  font-size: 7px;
  font-weight: 700;
  line-height: 1;
  color: #475569;
}

.shipping-label-qty-row strong {
  font-size: 22px;
  font-weight: 800;
  line-height: 0.85;
  color: #0f172a;
}

@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }

  :global(body.is-shipping-label-printing) {
    background: #fff !important;
  }

  :global(body.is-shipping-label-printing *) {
    visibility: hidden !important;
  }

  :global(body.is-shipping-label-printing .shipping-label-print-root),
  :global(body.is-shipping-label-printing .shipping-label-print-root *) {
    visibility: visible !important;
  }

  :global(body.is-shipping-label-printing .shipping-label-print-root) {
    display: block !important;
    position: absolute !important;
    inset: 0 auto auto 0 !important;
    width: 210mm !important;
    min-height: 297mm !important;
    background: #fff !important;
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
