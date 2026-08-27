import { defineRelations } from 'drizzle-orm'

// 2. Impor tabel secara langsung dari file masing-masing (bukan dari index.ts) 
// untuk menghindari circular dependency pada TypeScript
import { pengajuan } from './pengajuan'
import { pengajuanItems } from './pengajuan-items'
import { statusLog } from './status-log'

// 1. Ekspor semua skema tabel individual
export * from './config'
export * from './email-log'
export * from './email-recipients'
export * from './model-produk'
export * from './pengajuan'
export * from './pengajuan-items'
export * from './print-batch'
export * from './print-layouts'
export * from './status-log'
export * from './user'


// 3. Gabungkan dalam satu objek skema lokal untuk relasi v2
const schema = {
  pengajuan,
  pengajuanItems,
  statusLog,
}

export const relations = defineRelations(schema, (r) => ({
  pengajuan: {
    items: r.many.pengajuanItems(),
    statusLogs: r.many.statusLog(),
  },
  pengajuanItems: {
    pengajuan: r.one.pengajuan({
      from: r.pengajuanItems.idPengajuan,
      to: r.pengajuan.idPengajuan,
    }),
  },
  statusLog: {
    pengajuan: r.one.pengajuan({
      from: r.statusLog.idPengajuan,
      to: r.pengajuan.idPengajuan,
    }),
  },
}))