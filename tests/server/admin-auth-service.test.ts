import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { H3Event } from 'h3'
import {
  requireAdminBearerToken,
  requireAdminSessionWithDependencies,
} from '../../server/services/admin-auth-service'

function createEvent(authorization?: string) {
  return {
    context: {},
    node: {
      req: {
        headers: authorization ? { authorization } : {},
      },
    },
  } as H3Event
}

describe('admin auth service', () => {
  it('rejects requests without bearer token', () => {
    assert.throws(
      () => requireAdminBearerToken(createEvent()),
      (error: unknown) => {
        assert.equal((error as { statusCode?: number }).statusCode, 401)
        return true
      },
    )
  })

  it('validates active admin session and caches it per event', async () => {
    const event = createEvent('Bearer admin-token')
    let userCalls = 0
    let profileCalls = 0

    const dependencies = {
      getRuntimeConfig: () => ({
        supabaseUrl: 'https://supabase.test',
        supabasePublishableKey: 'publishable-key',
      }),
      fetchAuthUser: async () => {
        userCalls += 1
        return { id: 'user-1', email: 'admin@example.test' }
      },
      fetchAdminProfile: async () => {
        profileCalls += 1
        return { role: 'admin', is_active: true, full_name: 'Admin User' }
      },
    }

    const first = await requireAdminSessionWithDependencies(event, dependencies)
    const second = await requireAdminSessionWithDependencies(event, dependencies)

    assert.equal(first, second)
    assert.equal(first.token, 'admin-token')
    assert.equal(first.role, 'admin')
    assert.equal(userCalls, 1)
    assert.equal(profileCalls, 1)
  })

  it('rejects inactive or invalid-role profiles', async () => {
    const event = createEvent('Bearer inactive-token')

    await assert.rejects(
      () => requireAdminSessionWithDependencies(event, {
        getRuntimeConfig: () => ({
          supabaseUrl: 'https://supabase.test',
          supabasePublishableKey: 'publishable-key',
        }),
        fetchAuthUser: async () => ({ id: 'user-1' }),
        fetchAdminProfile: async () => ({ role: 'viewer', is_active: true, full_name: null }),
      }),
      (error: unknown) => {
        assert.equal((error as { statusCode?: number }).statusCode, 403)
        return true
      },
    )
  })
})
