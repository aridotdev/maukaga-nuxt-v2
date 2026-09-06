import { getQuery, type H3Event } from 'h3'
import { requireAdminSession } from './admin-auth-service'
import { getLocalWarrantyPrintQueue } from '../repositories/local-warranty-print-queue-repository'

type LocalWarrantyPrintQueueServiceDependencies = {
  requireAdminSession?: typeof requireAdminSession
  getQueue?: typeof getLocalWarrantyPrintQueue
}

const defaultLocalWarrantyPrintQueueDependencies = {
  requireAdminSession,
  getQueue: getLocalWarrantyPrintQueue,
} satisfies Required<LocalWarrantyPrintQueueServiceDependencies>

function resolveLocalWarrantyPrintQueueDependencies(
  dependencies: LocalWarrantyPrintQueueServiceDependencies = {},
) {
  return {
    ...defaultLocalWarrantyPrintQueueDependencies,
    ...dependencies,
  }
}

export async function readLocalWarrantyPrintQueueForAdmin(
  event: H3Event,
  dependencies: LocalWarrantyPrintQueueServiceDependencies = {},
) {
  const resolved = resolveLocalWarrantyPrintQueueDependencies(dependencies)
  await resolved.requireAdminSession(event)
  return await resolved.getQueue(getQuery(event))
}
