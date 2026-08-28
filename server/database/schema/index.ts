import { defineRelations } from 'drizzle-orm'
import { archiveFiles } from './archive-files'
import { pengajuan } from './pengajuan'
import { pengajuanItems } from './pengajuan-items'
import { statusLog } from './status-log'

export * from './archive-files'
export * from './config'
export * from './constants'
export * from './email-log'
export * from './email-recipients'
export * from './model-produk'
export * from './pengajuan'
export * from './pengajuan-items'
export * from './print-batch'
export * from './print-layouts'
export * from './status-log'
export * from './sync-log'
export * from './sync-meta'
export * from './user'

export const localSchema = {
  archiveFiles,
  pengajuan,
  pengajuanItems,
  statusLog,
}

export const relations = defineRelations(localSchema, (r) => ({
  pengajuan: {
    archiveFiles: r.many.archiveFiles(),
    items: r.many.pengajuanItems(),
    statusLogs: r.many.statusLog(),
  },
  archiveFiles: {
    pengajuan: r.one.pengajuan({
      from: r.archiveFiles.idPengajuan,
      to: r.pengajuan.idPengajuan,
    }),
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