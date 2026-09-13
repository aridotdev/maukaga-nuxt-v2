import { defineRelations } from 'drizzle-orm'
import { auditLog } from './audit-log'
import { config } from './config'
import { dailySequence } from './daily-sequence'
import { emailLog } from './email-log'
import { emailRecipients } from './email-recipients'
import { modelProduk } from './model-produk'
import { pengajuanFiles } from './pengajuan-files'
import { pengajuanItems } from './pengajuan-items'
import { pengajuan } from './pengajuan'
import { printBatchItems, printBatches } from './print-batch'
import { printLayouts } from './print-layouts'
import { shippingBatchItems, shippingBatches } from './shipping-batch'
import { statusLog } from './status-log'
import { account, session, user, verification } from './user'

export * from './audit-log'
export * from './config'
export * from './constants'
export * from './daily-sequence'
export * from './email-log'
export * from './email-recipients'
export * from './model-produk'
export * from './pengajuan-files'
export * from './pengajuan-items'
export * from './pengajuan'
export * from './print-batch'
export * from './print-layouts'
export * from './shipping-batch'
export * from './status-log'
export * from './user'

export const databaseSchema = {
  account,
  auditLog,
  config,
  dailySequence,
  emailLog,
  emailRecipients,
  modelProduk,
  pengajuan,
  pengajuanFiles,
  pengajuanItems,
  printBatchItems,
  printBatches,
  printLayouts,
  session,
  shippingBatchItems,
  shippingBatches,
  statusLog,
  user,
  verification,
}

export const relations = defineRelations(databaseSchema, (r) => ({
  pengajuan: {
    items: r.many.pengajuanItems(),
    files: r.many.pengajuanFiles(),
    statusLogs: r.many.statusLog(),
  },
  pengajuanItems: {
    pengajuan: r.one.pengajuan({
      from: r.pengajuanItems.pengajuanId,
      to: r.pengajuan.id,
    }),
    modelProduk: r.one.modelProduk({
      from: r.pengajuanItems.modelProdukId,
      to: r.modelProduk.id,
    }),
    statusLogs: r.many.statusLog(),
    printBatchItems: r.many.printBatchItems(),
    shippingBatchItems: r.many.shippingBatchItems(),
  },
  pengajuanFiles: {
    pengajuan: r.one.pengajuan({
      from: r.pengajuanFiles.pengajuanId,
      to: r.pengajuan.id,
    }),
  },
  modelProduk: {
    items: r.many.pengajuanItems(),
  },
  statusLog: {
    pengajuan: r.one.pengajuan({
      from: r.statusLog.pengajuanId,
      to: r.pengajuan.id,
    }),
    item: r.one.pengajuanItems({
      from: r.statusLog.itemId,
      to: r.pengajuanItems.id,
    }),
  },
  printBatches: {
    layout: r.one.printLayouts({
      from: r.printBatches.layoutId,
      to: r.printLayouts.id,
    }),
    items: r.many.printBatchItems(),
  },
  printBatchItems: {
    batch: r.one.printBatches({
      from: r.printBatchItems.batchId,
      to: r.printBatches.id,
    }),
    item: r.one.pengajuanItems({
      from: r.printBatchItems.itemId,
      to: r.pengajuanItems.id,
    }),
  },
  shippingBatches: {
    items: r.many.shippingBatchItems(),
  },
  shippingBatchItems: {
    batch: r.one.shippingBatches({
      from: r.shippingBatchItems.batchId,
      to: r.shippingBatches.id,
    }),
    item: r.one.pengajuanItems({
      from: r.shippingBatchItems.itemId,
      to: r.pengajuanItems.id,
    }),
  },
}))
