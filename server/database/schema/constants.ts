export const PENGAJUAN_STATUSES = [
  'Menunggu Upload',
  'Baru',
  'Disetujui',
  'Ditolak',
  'Diprint',
  'Dikirim',
  'Selesai',
] as const

export const ITEM_DECISION_STATUSES = ['Disetujui', 'Ditolak'] as const
export const WARRANTY_CARD_TYPES = ['Local', 'Import'] as const
export const PRINT_STATUSES = ['Belum Dicetak', 'Printed'] as const
export const SHIP_STATUSES = ['Belum Dikirim', 'Dikirim'] as const

export const MODEL_ORIGINS = ['local', 'import'] as const
export const MODEL_REVIEW_STATUSES = ['verified', 'needs_review'] as const

export const ARCHIVE_FILE_KINDS = ['hardcopy', 'bukti'] as const
export const ARCHIVE_FILE_STATUSES = [
  'pending',
  'downloaded',
  'drive_trashed',
  'missing',
  'error',
] as const

export const SYNC_STATUSES = ['running', 'success', 'failed'] as const
export const SYNC_MODES = ['full', 'changed', 'detail', 'background', 'manual'] as const
