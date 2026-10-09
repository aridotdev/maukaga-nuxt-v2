export type PemohonRow = {
  id: string
  nama: string
  bagian: string
  cabang: string
  email: string | null
  nomorHp: string | null
  createdAt: string
  updatedAt: string
}

export type PemohonResponse = {
  rows: PemohonRow[]
}
