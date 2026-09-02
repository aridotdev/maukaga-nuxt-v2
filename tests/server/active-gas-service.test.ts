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

})
