import { readArchiveChart, readArchiveDashboard, readArchiveDetail } from '../utils/archive-dashboard'
import { readArchiveSyncStatus, runArchiveSync } from '../utils/archive-sync'

export type ArchiveRuntimeConfig = {
  appsScriptApiUrl?: string
  archiveFileDirectory?: string
  public?: {
    archiveFileBasePath?: string
  }
}

export function getArchiveDashboard(query: Record<string, unknown>) {
  return readArchiveDashboard(query)
}

export function getArchiveChart(query: Record<string, unknown>) {
  return readArchiveChart(query)
}

export function getArchiveDetail(idPengajuan: string) {
  return readArchiveDetail(idPengajuan)
}

export function getArchiveSyncStatus() {
  return readArchiveSyncStatus()
}

export function syncArchive(
  input: Record<string, unknown>,
  runtimeConfig: ArchiveRuntimeConfig,
) {
  return runArchiveSync(input, { runtimeConfig })
}
