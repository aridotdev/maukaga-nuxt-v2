export type WarrantyCardType = 'Local' | 'Import'
export type WarrantyCardTypeKey = 'local' | 'import'
export type WarrantyCardTypeFilter = 'all' | WarrantyCardTypeKey | 'unset'

export type CardTypeKey = WarrantyCardTypeKey
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
  createdBy?: string
  updatedBy?: string
}

export type PrintLayoutState = {
  layouts: PrintLayout[]
  active: Record<CardTypeKey, string>
  activeLayouts: Record<CardTypeKey, PrintLayout | null>
  savedLayoutId?: string
}

export type AlertState = {
  type: 'success' | 'error' | 'info'
  title: string
  description?: string
} | null

export type WarrantyPrintQueueRow = {
  key: string
  idPengajuan: string
  noItem: number
  produk: string
  model: string
  nomorSeri: string
  jenisKartu: WarrantyCardType | ''
  jenisKartuKey: WarrantyCardTypeKey | ''
  statusCetak: 'Belum Dicetak' | 'Dicetak'
  statusKirim: 'Belum Dikirim' | 'Dikirim'
  nama: string
  bagianCabang: string
  submittedAt: string
}

export type WarrantyPrintQueueResponse = {
  rows: WarrantyPrintQueueRow[]
  summary: {
    total: number
    local: number
    import: number
    unset: number
  }
}

export type WarrantyPrintBatchResult = {
  batchId: string
  count: number
  updated: string[]
  layoutId?: string | null
}

export type ShippingLabelQueueRow = {
  key: string
  idPengajuan: string
  noItem: number
  produk: string
  model: string
  nomorSeri: string
  statusCetak: 'Dicetak'
  statusKirim: 'Belum Dikirim' | 'Dikirim'
  nama: string
  bagianCabang: string
  submittedAt: string
}

export type ShippingLabelQueueResponse = {
  rows: ShippingLabelQueueRow[]
  summary: {
    total: number
    groups: number
  }
}

export type ShippingLabel = {
  nama: string
  bagianCabang: string
  qty: number
}

export type ShippingBatchResult = {
  batchId: string
  count: number
  updated: string[]
}
