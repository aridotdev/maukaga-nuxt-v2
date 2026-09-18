export type ModelProdukOrigin = 'local' | 'import'
export type ModelProdukStatus = 'verified' | 'needs_review'

export type ModelProdukRow = {
  id: string
  model: string
  produk: string
  origin: ModelProdukOrigin
  status: ModelProdukStatus
  createdAt: string
  updatedAt: string
}

export type ModelProdukResponse = {
  rows: ModelProdukRow[]
  summary: {
    total: number
    verified: number
    needsReview: number
  }
}
