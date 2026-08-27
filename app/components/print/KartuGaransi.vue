<script setup lang="ts">
import type { CardTypeKey, PrintLayout, WarrantyPrintQueueRow } from '~/types/print'

const PRINT_CLASS = 'is-warranty-card-printing'

const props = defineProps<{
  rows: WarrantyPrintQueueRow[]
  activeLayouts: Record<CardTypeKey, PrintLayout | null>
  onAfterPrint?: () => void
}>()

function createEmptyPrintLayout(type: CardTypeKey): PrintLayout {
  return {
    id: '',
    type,
    name: '',
    offsetX: 0,
    offsetY: 0,
    gapProductModel: 0,
    gapModelSerial: 0,
    isBuiltin: false
  }
}

function getActivePrintLayout(type: CardTypeKey) {
  return props.activeLayouts[type] || createEmptyPrintLayout(type)
}

function getWarrantyPageStyle(row: WarrantyPrintQueueRow) {
  const cardType = row.jenisKartuKey === 'import' ? 'import' : 'local'
  const layout = getActivePrintLayout(cardType)

  return {
    '--warranty-adjust-x': `${layout.offsetX}mm`,
    '--warranty-adjust-y': `${layout.offsetY}mm`,
    '--warranty-gap-product-model': `${layout.gapProductModel}mm`,
    '--warranty-gap-model-serial': `${layout.gapModelSerial}mm`
  }
}

function startPrinting() {
  document.body.classList.add(PRINT_CLASS)
}

function stopPrinting() {
  document.body.classList.remove(PRINT_CLASS)
}

const printBase = usePrintWithFilename('KartuGaransi', () => {
  const first = props.rows[0]
  return first?.printBatchId || first?.key || 'batch'
})

async function print() {
  // 1. Tunggu sampai DOM merefleksikan prop `rows` terbaru.
  await nextTick()

  // 2. Tunggu satu frame agar layout hasil render stabil.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  // 3. Aktifkan class di body untuk men-trigger mode cetak.
  startPrinting()

  // 4. Tunggu 2x requestAnimationFrame. Pola resmi Vue untuk
  //    menunggu browser me-render ulang setelah class ditambahkan
  //    (display:block pada print root via Teleport, dan
  //    visibility:hidden di seluruh UI lain). Tanpa jeda ini,
  //    Chromium bisa membuka dialog hanya dengan halaman
  //    pertama yang sudah terhitung.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })

  // 5. Buka dialog print browser, lalu tunggu sampai dialog
  //    ditutup. `afterprint` fires saat user menutup dialog
  //    (baik Save maupun Cancel), sehingga promise resolve di
  //    saat yang tepat untuk men-reset state UI parent.
  printBase()
  await new Promise<void>((resolve) => {
    const onAfter = () => {
      window.removeEventListener('afterprint', onAfter)
      resolve()
    }
    window.addEventListener('afterprint', onAfter)
  })
}

function handleAfterPrint() {
  stopPrinting()
  props.onAfterPrint?.()
}

onMounted(() => {
  window.addEventListener('afterprint', handleAfterPrint)
})

onBeforeUnmount(() => {
  window.removeEventListener('afterprint', handleAfterPrint)
  stopPrinting()
})

defineExpose({ print })
</script>

<template>
  <!-- Teleport memindahkan print root ke <body> langsung supaya
       saat mode cetak, CSS `body.is-warranty-card-printing > *`
       bisa menyembunyikan semua UI Nuxt (sidebar, panel, dll.)
       tanpa ikut menyembunyikan ancestor dari print root itu
       sendiri (yang akan membuat browser tidak bisa mem-paginate
       multi-halaman). Pola ini mengikuti referensi dashboard.html
       yang juga meletakkan #section-warranty-print di level body. -->
  <Teleport to="body">
    <div class="warranty-card-print-root">
      <section
        v-for="row in rows"
        :key="row.key"
        class="warranty-print-page"
        :class="row.jenisKartuKey === 'import' ? 'import' : 'local'"
        :style="getWarrantyPageStyle(row)"
      >
        <div class="warranty-field warranty-detail-field warranty-product">
          {{ row.produk }}
        </div>
        <div class="warranty-field warranty-detail-field warranty-model">
          {{ row.model }}
        </div>
        <div class="warranty-field warranty-detail-field warranty-serial">
          {{ row.nomorSeri }}
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
/* Wadah disembunyikan di layar, hanya muncul saat mode cetak
   aktif. Saat muncul, biarkan mengalir se-tinggi konten (jangan
   dipaksa 297mm) supaya semua halaman A4 bisa tercetak berurutan. */
.warranty-card-print-root {
  display: none;
}

.warranty-print-page {
  position: relative;
  width: 210mm;
  height: 297mm;
  background: #fff;
  color: #000;
  --warranty-adjust-x: 0mm;
  --warranty-adjust-y: 0mm;
  --warranty-gap-product-model: 0mm;
  --warranty-gap-model-serial: 0mm;
  page-break-inside: avoid;
  break-inside: avoid;
}

.warranty-print-page.local {
  --warranty-base-x: 5mm;
  --warranty-base-y: -5mm;
  --warranty-detail-base-y: -2mm;
}

.warranty-print-page.import {
  --warranty-base-x: 0mm;
  --warranty-base-y: 3mm;
  --warranty-detail-base-y: 0mm;
}

.warranty-field {
  position: absolute;
  transform: translate(
    calc(var(--warranty-base-x, 0mm) + var(--warranty-adjust-x, 0mm)),
    calc(var(--warranty-base-y, 0mm) + var(--warranty-adjust-y, 0mm))
  );
  overflow: hidden;
  white-space: nowrap;
  text-align: center;
  font-family: Arial, sans-serif;
  color: #000;
}

.warranty-detail-field {
  transform: translate(
    calc(var(--warranty-base-x, 0mm) + var(--warranty-adjust-x, 0mm)),
    calc(
      var(--warranty-base-y, 0mm) + var(--warranty-adjust-y, 0mm) +
      var(--warranty-detail-base-y, 0mm) +
      var(--warranty-field-gap-y, 0mm)
    )
  );
}

.warranty-product {
  left: 0mm;
  top: 218.3mm;
  width: 124.6mm;
  height: 6.4mm;
  font-size: 14pt;
  line-height: 6.4mm;
}

.warranty-model {
  left: 0mm;
  top: 236.3mm;
  width: 61.1mm;
  --warranty-field-gap-y: var(--warranty-gap-product-model);
  height: 5.3mm;
  font-size: 10pt;
  line-height: 5.3mm;
}

.warranty-serial {
  left: 73.3mm;
  top: 236.3mm;
  width: 51.3mm;
  --warranty-field-gap-y: calc(var(--warranty-gap-product-model) + var(--warranty-gap-model-serial));
  height: 5.3mm;
  font-size: 10pt;
  line-height: 5.3mm;
}

@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }

  :global(html),
  :global(body) {
    background: #fff !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Saat mode cetak aktif: sembunyikan semua direct child of body
     KECUALI print root. Print root di-Teleport ke body, jadi
     aman dipakai selector `body > *`. */
  :global(body.is-warranty-card-printing > *:not(.warranty-card-print-root)) {
    display: none !important;
  }

  /* Tampilkan kembali khusus pohon kartu garansi. */
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
