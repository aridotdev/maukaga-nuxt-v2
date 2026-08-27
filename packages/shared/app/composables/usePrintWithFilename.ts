/**
 * Mengubah `document.title` menjadi `${prefix}_${id}` saat memicu dialog print,
 * sehingga Chrome/Edge/Opera mengisi default filename "Save as PDF" dengan id
 * dokumen. Title dikembalikan ke nilai awal lewat event `afterprint`
 * (fallback `setTimeout` 1 detik untuk kasus dialog dibatalkan).
 *
 * @param prefix Label dokumen, mis. "Pengajuan" / "KartuGaransi" / "LabelCabang"
 * @param getId Fungsi lazy yang mengembalikan id dokumen terbaru
 */
export function usePrintWithFilename(prefix: string, getId: () => string) {
  const buildFilename = () => {
    const rawId = String(getId() || '').trim()
    const safeId = rawId
      .replace(/[^A-Za-z0-9-]+/g, '_')
      .replace(/^_+|_+$/g, '')
    return safeId ? `${prefix}_${safeId}` : prefix
  }

  return () => {
    if (typeof document === 'undefined') return

    const previousTitle = document.title
    document.title = buildFilename()

    const restore = () => {
      if (document.title !== previousTitle) document.title = previousTitle
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.setTimeout(restore, 1000)

    window.print()
  }
}
