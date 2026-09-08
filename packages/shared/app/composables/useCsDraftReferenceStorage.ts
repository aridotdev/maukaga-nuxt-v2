import { normalizePengajuanId } from '../utils'

export type CsDraftReference = {
  idPengajuan: string
  resumeToken: string
  resumeUrl: string
  savedAt: string
}

type SaveDraftReferenceInput = {
  idPengajuan: string
  resumeToken?: string
  resumeUrl?: string
}

const draftStorageKey = 'pengajuan_kartu_garansi_draft'
const emptyDraftReference: CsDraftReference = {
  idPengajuan: '',
  resumeToken: '',
  resumeUrl: '',
  savedAt: ''
}

function normalizeResumeUrl(value: unknown, idPengajuan: string) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  try {
    const base = import.meta.client ? window.location.origin : 'http://localhost'
    const url = new URL(raw, base)
    if (idPengajuan && url.searchParams.has('id')) {
      url.searchParams.set('id', idPengajuan)
    }
    if (idPengajuan && url.searchParams.has('idPengajuan')) {
      url.searchParams.set('idPengajuan', idPengajuan)
    }
    return url.toString()
  } catch {
    return raw
  }
}

export function useCsDraftReferenceStorage() {
  function get(): CsDraftReference {
    if (!import.meta.client) return { ...emptyDraftReference }

    try {
      const saved = JSON.parse(localStorage.getItem(draftStorageKey) || '{}') as Partial<CsDraftReference>

      return {
        idPengajuan: normalizePengajuanId(saved.idPengajuan),
        resumeToken: String(saved.resumeToken || ''),
        resumeUrl: normalizeResumeUrl(saved.resumeUrl, normalizePengajuanId(saved.idPengajuan)),
        savedAt: String(saved.savedAt || '')
      }
    } catch {
      return { ...emptyDraftReference }
    }
  }

  function save(reference: SaveDraftReferenceInput) {
    const idPengajuan = normalizePengajuanId(reference.idPengajuan)
    if (!import.meta.client || !idPengajuan) return

    try {
      localStorage.setItem(draftStorageKey, JSON.stringify({
        idPengajuan,
        resumeToken: reference.resumeToken || '',
        resumeUrl: normalizeResumeUrl(reference.resumeUrl, idPengajuan),
        savedAt: new Date().toISOString()
      }))
    } catch {
      // localStorage can be blocked; the in-memory page state remains usable.
    }
  }

  function remove() {
    if (!import.meta.client) return

    try {
      localStorage.removeItem(draftStorageKey)
    } catch {
      // localStorage can be blocked; the in-memory page state has already changed.
    }
  }

  return {
    get,
    save,
    remove
  }
}
