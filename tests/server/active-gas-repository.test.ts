import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { callActiveGasAction } from '../../server/repositories/active-gas-repository'

const originalFetch = globalThis.fetch

describe('active GAS repository', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('does not allow payload to override server action or token', async () => {
    let requestBody: Record<string, unknown> | null = null

    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 })
    }

    await callActiveGasAction(
      { appsScriptApiUrl: 'https://gas.test' },
      'getDashboard',
      'server-token',
      {
        action: 'deleteEverything',
        token: 'client-token',
        page: 1,
      },
    )

    assert.equal(requestBody?.action, 'getDashboard')
    assert.equal(requestBody?.token, 'server-token')
    assert.equal(requestBody?.page, 1)
  })
})
