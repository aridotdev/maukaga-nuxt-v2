import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { H3Event } from 'h3'
import { callActiveGasData, callActiveGasResult } from '../../server/services/active-gas-service'

const adminSession = {
  token: 'server-token',
  userId: 'user-1',
  role: 'admin' as const,
  fullName: 'Admin User',
}

describe('active GAS service', () => {
  it('forwards only allowlisted active actions and resolves aliases', async () => {
    let forwardedAction = ''
    let forwardedActor: unknown = null

    const result = await callActiveGasResult(
      {} as H3Event,
      'markWarrantyCardsPrinted',
      { ids: ['P-1'] },
      {
        requireAdminSession: async () => adminSession,
        getRuntimeConfig: () => ({ appsScriptApiUrl: 'https://gas.test', gasBridgeSecret: 'bridge-secret' }),
        callGasAction: async (_runtimeConfig, action, actor) => {
          forwardedAction = action
          forwardedActor = actor
          return { success: true, data: { ok: true } }
        },
      },
    )

    assert.deepEqual(result, { success: true, data: { ok: true } })
    assert.equal(forwardedAction, 'markWarrantyItemsPrinted')
    assert.deepEqual(forwardedActor, adminSession)
  })

  it('blocks non-allowlisted active actions before calling GAS', async () => {
    let gasCalls = 0

    await assert.rejects(
      () => callActiveGasResult(
        {} as H3Event,
        'deleteEverything',
        {},
        {
          requireAdminSession: async () => adminSession,
          getRuntimeConfig: () => ({ appsScriptApiUrl: 'https://gas.test', gasBridgeSecret: 'bridge-secret' }),
          callGasAction: async () => {
            gasCalls += 1
            return { success: true }
          },
        },
      ),
      (error: unknown) => {
        assert.equal((error as { statusCode?: number }).statusCode, 404)
        return true
      },
    )

    assert.equal(gasCalls, 0)
  })
  it('blocks retired print layout actions before calling GAS', async () => {
    let gasCalls = 0

    for (const action of ['getPrintLayouts', 'savePrintLayout', 'deletePrintLayout', 'setActivePrintLayout']) {
      await assert.rejects(
        () => callActiveGasResult(
          {} as H3Event,
          action,
          {},
          {
            requireAdminSession: async () => adminSession,
            getRuntimeConfig: () => ({ appsScriptApiUrl: 'https://gas.test', gasBridgeSecret: 'bridge-secret' }),
            callGasAction: async () => {
              gasCalls += 1
              return { success: true }
            },
          },
        ),
        (error: unknown) => {
          assert.equal((error as { statusCode?: number }).statusCode, 404)
          return true
        },
      )
    }

    assert.equal(gasCalls, 0)
  })

  it('normalizes active detail archive links to proxy URLs', async () => {
    const detail = await callActiveGasData(
      {} as H3Event,
      'getDetail',
      { idPengajuan: 'KG-20260903-0001' },
      {
        requireAdminSession: async () => adminSession,
        getRuntimeConfig: () => ({ appsScriptApiUrl: 'https://gas.test', gasBridgeSecret: 'bridge-secret' }),
        callGasAction: async () => ({
          success: true,
          data: {
            idPengajuan: 'KG-20260903-0001',
            hardcopyArchivePath: '/arsip_file/KG-20260903-0001_hardcopy.pdf',
            evidenceArchivePaths: ['/arsip_file/KG-20260903-0001_bukti_01.jpg'],
          },
        }),
      },
    )

    assert.equal(detail.fileHardCopyUrl, '/api/active/pengajuan/KG-20260903-0001/file?kind=hardcopy')
    assert.equal(detail.fileHardCopyId, '/arsip_file/KG-20260903-0001_hardcopy.pdf')
    assert.deepEqual(detail.evidenceAttachmentUrls, ['/api/active/pengajuan/KG-20260903-0001/file?kind=bukti&sequence=1'])
  })

  it('allows archive file proxy action', async () => {
    let forwardedAction = ''

    await callActiveGasResult(
      {} as H3Event,
      'getArchiveFile',
      { idPengajuan: 'KG-20260903-0001', kind: 'hardcopy' },
      {
        requireAdminSession: async () => adminSession,
        getRuntimeConfig: () => ({ appsScriptApiUrl: 'https://gas.test', gasBridgeSecret: 'bridge-secret' }),
        callGasAction: async (_runtimeConfig, action) => {
          forwardedAction = action
          return { success: true, data: { fileName: 'x.pdf', mimeType: 'application/pdf', base64: 'AA==' } }
        },
      },
    )

    assert.equal(forwardedAction, 'getArchiveFile')
  })

})
