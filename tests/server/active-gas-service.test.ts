import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { H3Event } from 'h3'
import { callActiveGasResult } from '../../server/services/active-gas-service'

const adminSession = {
  token: 'server-token',
  userId: 'user-1',
  role: 'admin' as const,
  fullName: 'Admin User',
}

describe('active GAS service', () => {
  it('forwards only allowlisted active actions and resolves aliases', async () => {
    let forwardedAction = ''
    let forwardedToken = ''

    const result = await callActiveGasResult(
      {} as H3Event,
      'markWarrantyCardsPrinted',
      { ids: ['P-1'] },
      {
        requireAdminSession: async () => adminSession,
        getRuntimeConfig: () => ({ appsScriptApiUrl: 'https://gas.test' }),
        callGasAction: async (_runtimeConfig, action, token) => {
          forwardedAction = action
          forwardedToken = token
          return { success: true, data: { ok: true } }
        },
      },
    )

    assert.deepEqual(result, { success: true, data: { ok: true } })
    assert.equal(forwardedAction, 'markWarrantyItemsPrinted')
    assert.equal(forwardedToken, 'server-token')
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
          getRuntimeConfig: () => ({ appsScriptApiUrl: 'https://gas.test' }),
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
})
