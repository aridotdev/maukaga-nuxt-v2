import type {
  RejectedUnitLetterViewModel,
  RejectedUnitLetterViewModelItem,
} from '../services/rejected-unit-letter-service'

export const REJECTED_UNIT_LETTER_TITLE = 'SURAT PERMOHONAN KARTU GARANSI'
export const REJECTED_UNIT_LETTER_OPENING = 'Saya sebagai pemohon :'
export const REJECTED_UNIT_LETTER_DETAIL_INTRO =
  'Dengan pengajuan Kartu garansi dengan data dibawah ini :'
export const REJECTED_UNIT_LETTER_STATEMENT_HEADING =
  'Menyatakan hal-hal sebagai berikut :'
export const REJECTED_UNIT_LETTER_CLOSING =
  'Demikian surat ini saya buat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.'

export const REJECTED_UNIT_LETTER_TABLE_HEADERS = [
  'No. Item',
  'Pemilik',
  'Nama Model',
  'Nama Produk',
  'Nomor Seri',
  'Keputusan Awal',
  'Alasan',
] as const

export const REJECTED_UNIT_LETTER_SIGNATURE_LABELS = {
  awareness: 'Mengetahui',
  applicant: 'Pemohon',
  departmentHead: 'Department Head',
} as const

const SINGLE_UNIT_STATEMENTS = [
  'Telah mengetahui bahwa unit barang yang tercantum dalam data di atas ini sudah pernah dilakukan proses perbaikan / servis oleh pihak Customer Service (CS)',
  'Menyatakan bahwa unit tersebut belum pernah dijual ke end user dan masih milik toko/dealer',
  'Bahwa saya bertanggung jawab penuh atas pengajuan penerbitan kartu garansi baru ini beserta segala konsekuensi administratif maupun teknis yang timbul di kemudian hari terkait unit tersebut',
  'Mohon untuk dapat diterbitkan kembali Kartu garansi sesuai data diatas',
] as const

const MULTIPLE_UNIT_STATEMENTS = [
  'Telah mengetahui bahwa unit-unit barang yang tercantum dalam data di atas ini sudah pernah dilakukan proses perbaikan / servis oleh pihak Customer Service (CS)',
  'Menyatakan bahwa unit-unit tersebut belum pernah dijual ke end user dan masih milik toko/dealer',
  'Bahwa saya bertanggung jawab penuh atas pengajuan penerbitan kartu garansi baru ini beserta segala konsekuensi administratif maupun teknis yang timbul di kemudian hari terkait unit-unit tersebut',
  'Mohon untuk dapat diterbitkan kembali Kartu garansi sesuai data diatas',
] as const

export interface RejectedUnitLetterTemplateField {
  label: string
  value: string
}

export interface RejectedUnitLetterTemplateRow {
  noItem: string
  pemilik: string
  model: string
  produk: string
  nomorSeri: string
  keputusanAwal: string
  alasan: string
}

export interface RejectedUnitLetterTemplate {
  title: string
  opening: string
  letterNumber: RejectedUnitLetterTemplateField
  applicantFields: RejectedUnitLetterTemplateField[]
  detailIntro: string
  tableHeaders: readonly string[]
  tableRows: RejectedUnitLetterTemplateRow[]
  statementHeading: string
  statements: readonly string[]
  closing: string
  signature: {
    awareness: string
    placeDate: string
    applicantName: string
    applicantLabel: string
    departmentHeadLabel: string
  }
}

export function createRejectedUnitLetterTemplate(
  viewModel: RejectedUnitLetterViewModel,
): RejectedUnitLetterTemplate {
  const isMultipleUnit = viewModel.items.length > 1

  return {
    title: REJECTED_UNIT_LETTER_TITLE,
    opening: REJECTED_UNIT_LETTER_OPENING,
    letterNumber: {
      label: 'Nomor Surat',
      value: viewModel.nomorSurat,
    },
    applicantFields: [
      { label: 'ID Pengajuan', value: viewModel.idPengajuan },
      { label: 'Tanggal', value: viewModel.tanggalSurat },
      { label: 'Nama', value: viewModel.namaPemohon },
      { label: 'Bagian', value: viewModel.bagian },
      { label: 'Cabang', value: viewModel.cabang },
    ],
    detailIntro: REJECTED_UNIT_LETTER_DETAIL_INTRO,
    tableHeaders: REJECTED_UNIT_LETTER_TABLE_HEADERS,
    tableRows: viewModel.items.map(createTableRow),
    statementHeading: REJECTED_UNIT_LETTER_STATEMENT_HEADING,
    statements: isMultipleUnit
      ? MULTIPLE_UNIT_STATEMENTS
      : SINGLE_UNIT_STATEMENTS,
    closing: REJECTED_UNIT_LETTER_CLOSING,
    signature: {
      awareness: REJECTED_UNIT_LETTER_SIGNATURE_LABELS.awareness,
      placeDate: `${viewModel.tempatTandaTangan}, ${viewModel.tanggalTandaTangan}`,
      applicantName: viewModel.namaPemohon,
      applicantLabel: REJECTED_UNIT_LETTER_SIGNATURE_LABELS.applicant,
      departmentHeadLabel: REJECTED_UNIT_LETTER_SIGNATURE_LABELS.departmentHead,
    },
  }
}

function createTableRow(
  item: RejectedUnitLetterViewModelItem,
): RejectedUnitLetterTemplateRow {
  return {
    noItem: String(item.noItem),
    pemilik: item.pemilik,
    model: item.model,
    produk: item.produk,
    nomorSeri: item.nomorSeri,
    keputusanAwal: item.keputusanAwal,
    alasan: item.alasan,
  }
}
