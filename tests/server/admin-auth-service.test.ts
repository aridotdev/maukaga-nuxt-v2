import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { H3Event } from 'h3'
import {
  requireAdminSessionWithDependencies,
} from '../../server/services/admin-auth-service'

function createEvent() {
  return {
    context: {},
    node: {
      req: {
        headers: {},
      },
    },
  } as H3Event
}

describe('admin auth service', () => {
  it('rejects requests without session', async () => {
    await assert.rejects(
      () => requireAdminSessionWithDependencies(createEvent(), {
        resolveSession: async () => null,
      }),
      (error: unknown) => {
        assert.equal((error as { statusCode?: number }).statusCode, 401)
        return true
      },
    )
  })

  it('validates active admin session and caches it per event', async () => {
    const event = createEvent()
    let userCalls = 0

    const dependencies = {
      resolveSession: async () => {
        userCalls += 1
        return {
          token: 'admin-token',
          user: {
            id: 'user-1',
            email: 'admin@example.test',
            name: 'Admin User',
            role: 'admin',
            isActive: true,
          },
        }
      },
    }

    const first = await requireAdminSessionWithDependencies(event, dependencies)
    const second = await requireAdminSessionWithDependencies(event, dependencies)

    assert.equal(first, second)
    assert.equal(first.token, 'admin-token')
    assert.equal(first.role, 'admin')
    assert.equal(userCalls, 1)
  })

  it('rejects inactive or invalid-role profiles', async () => {
    const event = createEvent()

    await assert.rejects(
      () => requireAdminSessionWithDependencies(event, {
        resolveSession: async () => ({
          token: 'inactive-token',
          user: {
            id: 'user-1',
            email: 'admin@example.test',
            name: 'Admin User',
            role: 'viewer',
            isActive: true,
          },
        }),
      }),
      (error: unknown) => {
        assert.equal((error as { statusCode?: number }).statusCode, 403)
        return true
      },
    )
  })
})
