import type { ApiResult, AlertState, WarrantyPrintQueueResponse, WarrantyPrintQueueRow } from '~/types/print'
import { getPrintRowKey } from '~/utils/print'

type QueueSource = (params?: Record<string, unknown>) => Promise<ApiResult<WarrantyPrintQueueResponse>>

type UseWarrantyPrintQueueOptions = {
  /**
   * Pemilih baris user. Dipakai bersama agar pruneSelection bisa membersihkan
   * kunci yang sudah tidak ada di queue terbaru.
   */
  selectedKeys: Ref<Set<string>>
  /**
   * Loader utama. Biasanya wrapper tipis di atas callApi yang sudah pre-bound
   * dengan action + payload default. Terima params tambahan (mis. statusKirim)
   * agar bisa dipakai ulang untuk filter lain.
   */
  fetchQueue: QueueSource
  /**
   * Normalisasi baris. Pemanggil bisa menambahkan key, sort, atau default value.
   * Default: hanya inject key via getPrintRowKey.
   */
  normalize?: (rows: WarrantyPrintQueueRow[]) => WarrantyPrintQueueRow[]
}

/**
 * State & aksi bersama untuk kedua halaman antrean cetak/label.
 *
 * Tanggung jawab composable:
 * - fetch, simpan, dan prune queue
 * - kelola alert halaman (loading / success / error)
 * - tangani error 401 dengan mengarahkan ke /login
 *
 * Yang TIDAK dilakukan di sini (di-handle halaman):
 * - filter & sort baris (per halaman berbeda)
 * - kolom tabel & selection-checkbox state machine
 * - alur print fisik (cetak-kartu vs cetak-label beda layout)
 */
export function useWarrantyPrintQueue(options: UseWarrantyPrintQueueOptions) {
  const router = useRouter()
  const toast = useToast()
  const { callApi } = useAppsScriptApi()

  const printQueue = ref<WarrantyPrintQueueRow[]>([])
  const isQueueLoading = ref(false)
  const queueLoadError = ref('')
  const pageAlert = ref<AlertState>(null)

  const normalize = options.normalize ?? defaultNormalize

  function defaultNormalize(rows: WarrantyPrintQueueRow[]): WarrantyPrintQueueRow[] {
    return rows.map((row) => ({ ...row, key: getPrintRowKey(row) }))
  }

  function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : String(error || fallback)
  }

  function notify(title: string, color: 'success' | 'error' | 'info', description?: string) {
    toast.add({
      title,
      description,
      color,
      icon: color === 'success' ? 'i-lucide-circle-check' : color === 'error' ? 'i-lucide-circle-alert' : 'i-lucide-info',
      duration: color === 'error' ? 7000 : 4000
    })
  }

  async function redirectIfUnauthorized(message: string) {
    if (!message.includes('Unauthorized')) return

    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_nama')
    sessionStorage.removeItem('admin_username')
    await router.push('/login')
  }

  function setPageAlert(alert: AlertState) {
    pageAlert.value = alert
  }

  /**
   * Set baris antrean secara manual. Dipakai ketika data berasal dari
   * beberapa sumber API yang perlu digabung (mis. fallback pattern di
   * halaman label). Otomatis menormalisasi + prune selection.
   */
  function setQueue(rows: WarrantyPrintQueueRow[]) {
    printQueue.value = normalize(rows)
    pruneSelection()
  }

  async function loadQueue(params: Record<string, unknown> = {}, showLoading = true) {
    isQueueLoading.value = true
    queueLoadError.value = ''

    if (showLoading) {
      pageAlert.value = {
        type: 'loading',
        title: 'Memuat antrean',
        description: 'Mengambil data dari Google Sheet.'
      }
    }

    try {
      const result = await options.fetchQueue(params)
      if (!result.success || !result.data) throw new Error(result.error || 'Gagal memuat antrean')

      setQueue(result.data.rows || [])

      if (showLoading && pageAlert.value?.type === 'loading') {
        pageAlert.value = null
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Antrean belum bisa dimuat')
      queueLoadError.value = message
      pageAlert.value = { type: 'error', title: 'Antrean belum bisa dimuat', description: message }
      await redirectIfUnauthorized(message)
    } finally {
      isQueueLoading.value = false
    }
  }

  function pruneSelection() {
    const activeKeys = new Set(printQueue.value.map((row) => getPrintRowKey(row)))
    options.selectedKeys.value = new Set(
      Array.from(options.selectedKeys.value).filter((key) => activeKeys.has(key))
    )
  }

  function toggleVisiblePrintRows(visibleKeys: string[], checked: boolean) {
    const next = new Set(options.selectedKeys.value)
    visibleKeys.forEach((key) => {
      if (checked) next.add(key)
      else next.delete(key)
    })
    options.selectedKeys.value = next
  }

  async function withApiError<T>(work: () => Promise<T>, fallback: string): Promise<T | undefined> {
    try {
      return await work()
    } catch (error) {
      const message = getErrorMessage(error, fallback)
      pageAlert.value = { type: 'error', title: fallback, description: message }
      notify(fallback, 'error', message)
      await redirectIfUnauthorized(message)
      return undefined
    }
  }

  return {
    printQueue,
    isQueueLoading,
    queueLoadError,
    pageAlert,
    setPageAlert,
    setQueue,
    loadQueue,
    pruneSelection,
    toggleVisiblePrintRows,
    withApiError,
    notify,
    callApi
  }
}
