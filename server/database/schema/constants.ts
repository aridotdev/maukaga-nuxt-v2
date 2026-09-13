export const PENGAJUAN_STATUSES = [
  'Baru',
  'Disetujui',
  'Ditolak',
  'Diprint',
  'Dikirim',
  'Selesai',
] as const

export const ITEM_DECISION_STATUSES = ['Menunggu', 'Disetujui', 'Ditolak'] as const
export const WARRANTY_CARD_TYPES = ['Local', 'Import'] as const
export const ITEM_PRINT_STATUSES = ['Belum Dicetak', 'Dicetak'] as const
export const ITEM_SHIPPING_STATUSES = ['Belum Dikirim', 'Dikirim'] as const

export const MODEL_ORIGINS = ['local', 'import'] as const
export const MODEL_REVIEW_STATUSES = ['verified', 'needs_review'] as const

export const PENGAJUAN_FILE_KINDS = ['hardcopy', 'evidence', 'attachment'] as const
export const BATCH_STATUSES = ['queued', 'completed', 'partial', 'failed'] as const
export const BATCH_ITEM_STATUSES = ['success', 'failed', 'skipped'] as const
export const STATUS_LOG_SCOPES = ['pengajuan', 'item'] as const

export const PRINT_LAYOUT_TYPES = WARRANTY_CARD_TYPES
