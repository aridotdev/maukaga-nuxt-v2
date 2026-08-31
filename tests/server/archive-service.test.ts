import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { H3Event } from 'h3'
import { runArchiveSyncForAdmin } from '../../server/services/archive-service'

const adminSession = {
  token: 'server-token',
  userId: 'user-1',
  role: 'admin' as const,
  fullName: 'Admin User',
}

describe('archive service', () => {
  it('injects bridge actor into archive sync payload and strips client bridge fields', async () => {
    let syncInput: Record<string, unknown> | null = null

    const result = await runArchiveSyncForAdmin(
      {} as H3Event,
      {
        mode: 'detail',
        idPengajuan: 'P-1',
        action: 'deleteEverything',
        token: 'client-token',
        bridge: { actor: { role: 'qrcc' } },
        bridgeActor: { role: 'qrcc' },
        bridgeSignature: 'client-signature',
      },
      {
        requireAdminSession: async () => adminSession,
        getRuntimeConfig: () => ({
          appsScriptApiUrl: 'https://gas.test',
          gasBridgeSecret: 'bridge-secret',
          archiveFileDirectory: '/tmp/archive',
          public: { archiveFileBasePath: '/arsip_file' },
        }),
        sync: async (input) => {
          syncInput = input
          return { success: true }
        },
      },
    )

    const input = syncInput
    assert.ok(input)
    assert.deepEqual(result, { success: true })
    assert.equal(input.mode, 'detail')
    assert.equal(input.idPengajuan, 'P-1')
    assert.deepEqual(input.bridgeActor, adminSession)
    assert.equal('action' in input, false)
    assert.equal('token' in input, false)
    assert.equal('bridge' in input, false)
    assert.equal('bridgeSignature' in input, false)
  })

  it('rejects invalid archive sync JSON body', async () => {
    await assert.rejects(
      () => runArchiveSyncForAdmin(
        {} as H3Event,
        '{invalid-json',
        {
          requireAdminSession: async () => adminSession,
          getRuntimeConfig: () => ({ appsScriptApiUrl: 'https://gas.test', gasBridgeSecret: 'bridge-secret' }),
          sync: async () => ({ success: true }),
        },
      ),
      (error: unknown) => {
        assert.equal((error as { statusCode?: number }).statusCode, 400)
        return true
      },
    )
  })
})
