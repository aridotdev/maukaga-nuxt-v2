export type ApiResult<T> = {
  success: boolean
  data?: T
  error?: string
}

export type CardTypeKey = 'local' | 'import'
export type CardTypeFilter = 'all' | CardTypeKey | 'unset'

export type WarrantyPrintQueueRow = {
  key: string
  idPengajuan: string
  noItem: string | number
  produk: string
  model: string
  nomorSeri: string
  jenisKartu: 'Local' | 'Import' | ''
  jenisKartuKey: CardTypeKey | ''
  statusCetak: 'Belum Dicetak' | 'Printed' | string
  printBatchId: string
  printedAt: string
  printedBy: string
  reprintCount: number
  statusKirim: 'Belum Dikirim' | 'Dikirim' | string
  shippedAt: string
  shippedBy: string
  shipBatchId: string
  nama: string
  bagianCabang: string
  timestampSubmit: string
}

export type WarrantyPrintQueueResponse = {
  rows: WarrantyPrintQueueRow[]
  summary: {
    total: number
    local: number
    import: number
    belumJenisKartu: number
    printed: number
  }
}

export type PrintLayout = {
  id: string
  type: CardTypeKey
  name: string
  offsetX: number
  offsetY: number
  gapProductModel: number
  gapModelSerial: number
  isBuiltin: boolean
  createdAt?: string
  updatedAt?: string
  updatedBy?: string
}

export type PrintLayoutState = {
  layouts: PrintLayout[]
  active: Record<CardTypeKey, string>
  activeLayouts: Record<CardTypeKey, PrintLayout | null>
  savedLayoutId?: string
}

export type ShippingLabel = {
  cabang: string
  nama: string
  qty: number
}

export type AlertState = {
  type: 'success' | 'error' | 'info' | 'loading'
  title: string
  description?: string
  batchId?: string
} | null
