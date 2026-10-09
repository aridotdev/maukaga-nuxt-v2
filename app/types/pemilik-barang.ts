export type PemilikBarangRow = {
  id: string
  nama: string
  createdAt: string
  updatedAt: string
}

export type PemilikBarangResponse = {
  rows: PemilikBarangRow[]
}
