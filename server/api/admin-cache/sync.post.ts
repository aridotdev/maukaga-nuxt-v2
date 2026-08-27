export default defineEventHandler(async (event) => {
  const session = await requireAdminCacheSession(event)
  const body = await readBody<Record<string, unknown>>(event)
  const mode = String(body.mode || 'background')
  const idPengajuan = String(body.idPengajuan || '').trim()

  if (mode === 'delete') {
    if (!idPengajuan) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID Pengajuan wajib diisi.'
      })
    }

    await syncAdminCache({ token: session.token, mode: 'delete', idPengajuan })
    return getAdminCacheStatus()
  }

  if ((mode === 'detail' || mode === 'changed') && idPengajuan) {
    return syncAdminCache({ token: session.token, mode, idPengajuan })
  }

  if (mode === 'full') {
    return triggerAdminCacheSync({ token: session.token, mode: 'full' })
  }

  return triggerAdminCacheSync({ token: session.token, mode: 'background' })
})
