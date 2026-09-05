import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createEvent, type H3Event } from 'h3'
import { readArchiveDashboardForAdmin, runArchiveSyncForAdmin } from '../../server/services/archive-service'
import { readArchiveDashboard } from '../../server/utils/archive-dashboard'

const adminSession = {
  token: 'server-token',
  userId: 'user-1',
  role: 'admin' as const,
  fullName: 'Admin User',
}

describe('archive service', () => {
  it('uses default local dashboard filters when only pagination is provided', async () => {
    let selectCount = 0
    const database = {
      select: () => ({
        from: () => {
          selectCount += 1
          if (selectCount === 1) {
            return {
              orderBy: async () => [],
            }
          }

          return []
        },
      }),
    }

    const result = await readArchiveDashboard(
      { page: '1', pageSize: '20' },
      database as never,
    )

    assert.equal(result.page, 1)
    assert.equal(result.pageSize, 20)
    assert.equal(result.totalRows, 0)
    assert.deepEqual(result.rows, [])
    assert.equal(result.source, 'archive')
  })

  it('forwards archive dashboard queries for the local pengajuan list route', async () => {
    let forwardedQuery: Record<string, unknown> | null = null
    const event = createEvent({
      url: '/api/archive/pengajuan?page=2&pageSize=15&search=test&itemDecision=pending&status=Baru&sortBy=nama&sortDirection=asc'
    } as never, {} as never)

    await readArchiveDashboardForAdmin(
      event as H3Event,
      {
        requireAdminSession: async () => adminSession,
        getDashboard: async (query) => {
          forwardedQuery = query
          return {
            summary: {
              total: 0,
              totalItems: 0,
              baru: 0,
              disetujui: 0,
              ditolak: 0,
              diprint: 0,
              dikirim: 0,
              selesai: 0,
              itemDisetujui: 0,
              itemDitolak: 0,
            },
            rows: [],
            totalRows: 0,
            page: 2,
            pageSize: 15,
            admin: 'Arsip Lokal',
            source: 'archive' as const,
          }
        },
      },
    )

    assert.deepEqual(Object.fromEntries(Object.entries(forwardedQuery || {})), {
      page: '2',
      pageSize: '15',
      search: 'test',
      itemDecision: 'pending',
      status: 'Baru',
      sortBy: 'nama',
      sortDirection: 'asc',
    })
  })

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
