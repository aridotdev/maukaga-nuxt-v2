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
  it('injects server session token into archive sync payload', async () => {
    let syncInput: Record<string, unknown> | null = null

    const result = await runArchiveSyncForAdmin(
      {} as H3Event,
      {
        mode: 'detail',
        idPengajuan: 'P-1',
        token: 'client-token',
      },
      {
        requireAdminSession: async () => adminSession,
        getRuntimeConfig: () => ({
          appsScriptApiUrl: 'https://gas.test',
          archiveFileDirectory: '/tmp/archive',
          public: { archiveFileBasePath: '/arsip_file' },
        }),
        sync: async (input) => {
          syncInput = input
          return { success: true }
        },
      },
    )

    assert.deepEqual(result, { success: true })
    assert.equal(syncInput?.mode, 'detail')
    assert.equal(syncInput?.idPengajuan, 'P-1')
    assert.equal(syncInput?.token, 'server-token')
  })

  it('rejects invalid archive sync JSON body', async () => {
    await assert.rejects(
      () => runArchiveSyncForAdmin(
        {} as H3Event,
        '{invalid-json',
        {
          requireAdminSession: async () => adminSession,
          getRuntimeConfig: () => ({ appsScriptApiUrl: 'https://gas.test' }),
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
