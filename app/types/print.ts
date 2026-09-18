export type WarrantyCardType = 'Local' | 'Import'
export type WarrantyCardTypeKey = 'local' | 'import'
export type WarrantyCardTypeFilter = 'all' | WarrantyCardTypeKey | 'unset'

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
