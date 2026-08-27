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

export function useCsDraftReferenceStorage() {
  function get(): CsDraftReference {
    if (!import.meta.client) return { ...emptyDraftReference }

    try {
      const saved = JSON.parse(localStorage.getItem(draftStorageKey) || '{}') as Partial<CsDraftReference>

      return {
        idPengajuan: String(saved.idPengajuan || ''),
        resumeToken: String(saved.resumeToken || ''),
        resumeUrl: String(saved.resumeUrl || ''),
        savedAt: String(saved.savedAt || '')
      }
    } catch {
      return { ...emptyDraftReference }
    }
  }

  function save(reference: SaveDraftReferenceInput) {
    if (!import.meta.client || !reference.idPengajuan) return

    try {
      localStorage.setItem(draftStorageKey, JSON.stringify({
        idPengajuan: reference.idPengajuan,
        resumeToken: reference.resumeToken || '',
        resumeUrl: reference.resumeUrl || '',
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
