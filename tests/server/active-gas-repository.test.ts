import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { callActiveGasAction } from '../../server/repositories/active-gas-repository'
import { createGasBridgeSignature } from '../../server/utils/gas-bridge'

const originalFetch = globalThis.fetch
const adminActor = {
  userId: 'user-1',
  email: 'admin@example.test',
  role: 'admin',
  fullName: 'Admin User',
}

describe('active GAS repository', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('signs GAS requests and does not allow payload to override bridge fields', async () => {
    let requestBody: Record<string, unknown> | null = null

    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 })
    }

    await callActiveGasAction(
      { appsScriptApiUrl: 'https://gas.test', gasBridgeSecret: 'bridge-secret' },
      'getDashboard',
      adminActor,
      {
        action: 'deleteEverything',
        token: 'client-token',
        bridge: { actor: { role: 'qrcc' } },
        bridgeSignature: 'client-signature',
        page: 1,
      },
    )

    const body = requestBody
    assert.ok(body)
    assert.equal(body.action, 'getDashboard')
    assert.equal('token' in body, false)
    assert.equal(body.page, 1)
    assert.notEqual(body.bridgeSignature, 'client-signature')

    const bridge = body.bridge as Record<string, unknown>
    const actor = bridge.actor as Record<string, unknown>
    assert.equal(bridge.version, 'v1')
    assert.equal(actor.role, 'admin')
    assert.equal(actor.email, 'admin@example.test')
    assert.match(String(body.bridgeSignature), /^[a-f0-9]{64}$/)

    const { bridgeSignature, ...unsignedPayload } = body
    assert.equal(bridgeSignature, createGasBridgeSignature(unsignedPayload, 'bridge-secret'))
  })

  it('requires GAS bridge secret before calling fetch', async () => {
    let gasCalls = 0

    globalThis.fetch = async () => {
      gasCalls += 1
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    await assert.rejects(
      () => callActiveGasAction(
        { appsScriptApiUrl: 'https://gas.test' },
        'getDashboard',
        adminActor,
      ),
      /GAS_BRIDGE_SECRET/,
    )

    assert.equal(gasCalls, 0)
  })
})
