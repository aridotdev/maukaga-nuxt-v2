import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { H3Event } from 'h3'
import type {
  AdminMemberRecord,
  AdminMembersRepository,
  CreateAdminMemberInput,
  UpdateAdminMemberInput,
} from '../../server/repositories/admin-members-repository'
import {
  bootstrapFirstAdmin,
  createAdminMember,
  listAdminMembers,
  updateAdminMember,
} from '../../server/services/admin-members-service'
import type { AdminSession } from '../../server/services/admin-auth-service'

const adminSession = {
  token: 'admin-token',
  userId: 'admin-1',
  email: 'admin@example.test',
  role: 'admin',
  fullName: 'Admin User',
} satisfies AdminSession

const managementSession = {
  ...adminSession,
  userId: 'management-1',
  role: 'management',
} satisfies AdminSession

function createEvent() {
  return { context: {} } as H3Event
}

function createRecord(
  overrides: Partial<AdminMemberRecord> & Pick<AdminMemberRecord, 'id' | 'email'>,
): AdminMemberRecord {
  return {
    name: overrides.email,
    role: 'qrcc',
    isActive: true,
    createdAt: new Date('2026-08-30T00:00:00.000Z'),
    ...overrides,
  }
}

function createRepository(records: AdminMemberRecord[] = []) {
  let createdInput: CreateAdminMemberInput | null = null

  const repository: AdminMembersRepository = {
    countUsers: async () => records.length,
    countActiveAdmins: async (excludeUserId) => records.filter((record) => {
      return record.id !== excludeUserId && record.role === 'admin' && record.isActive
    }).length,
    listUsers: async () => [...records].sort((a, b) => a.email.localeCompare(b.email)),
    findUserById: async (id) => records.find(record => record.id === id) ?? null,
    findUserByEmail: async (email) => records.find(record => record.email === email) ?? null,
    createUserWithCredential: async (input) => {
      createdInput = input

      const record = createRecord({
        id: `user-${records.length + 1}`,
        email: input.email,
        name: input.name,
        role: input.role,
      })

      records.push(record)
      return record
    },
    updateUser: async (id, input: UpdateAdminMemberInput) => {
      const record = records.find(item => item.id === id)
      if (!record) return null

      if (input.name !== undefined) record.name = input.name
      if (input.role !== undefined) record.role = input.role
      if (input.isActive !== undefined) record.isActive = input.isActive

      return record
    },
  }

  return {
    repository,
    getCreatedInput: () => createdInput,
  }
}

function assertRejectsWithStatus(action: () => Promise<unknown>, statusCode: number) {
  return assert.rejects(action, (error: unknown) => {
    assert.equal((error as { statusCode?: number }).statusCode, statusCode)
    return true
  })
}

describe('admin members service', () => {
  it('bootstraps the first local admin with a Better Auth compatible password hash', async () => {
    const { repository, getCreatedInput } = createRepository()

    const result = await bootstrapFirstAdmin(
      {
        email: ' OWNER@Example.Test ',
        full_name: 'Owner',
        password: 'password-123',
        bootstrapToken: 'secret',
      },
      {
        repository,
        hashPassword: async password => `hashed:${password}`,
        env: {
          NODE_ENV: 'production',
          ADMIN_BOOTSTRAP_TOKEN: 'secret',
        },
      },
    )

    assert.equal(result.email, 'owner@example.test')
    assert.equal(result.role, 'admin')
    assert.equal(result.is_active, true)
    assert.deepEqual(getCreatedInput(), {
      email: 'owner@example.test',
      name: 'Owner',
      role: 'admin',
      passwordHash: 'hashed:password-123',
    })
  })

  it('blocks bootstrap after a user already exists', async () => {
    const { repository } = createRepository([
      createRecord({ id: 'admin-1', email: 'admin@example.test', role: 'admin' }),
    ])

    await assertRejectsWithStatus(
      () => bootstrapFirstAdmin(
        {
          email: 'owner@example.test',
          password: 'password-123',
          bootstrapToken: 'secret',
        },
        {
          repository,
          hashPassword: async password => `hashed:${password}`,
          env: {
            NODE_ENV: 'production',
            ADMIN_BOOTSTRAP_TOKEN: 'secret',
          },
        },
      ),
      409,
    )
  })

  it('requires admin role to list or create members', async () => {
    const { repository } = createRepository()
    const dependencies = {
      repository,
      requireAdminSession: async () => managementSession,
      hashPassword: async password => `hashed:${password}`,
    }

    await assertRejectsWithStatus(
      () => listAdminMembers(createEvent(), dependencies),
      403,
    )
    await assertRejectsWithStatus(
      () => createAdminMember(
        createEvent(),
        {
          email: 'qrcc@example.test',
          password: 'password-123',
          role: 'qrcc',
        },
        dependencies,
      ),
      403,
    )
  })

  it('creates local members and rejects duplicate emails', async () => {
    const { repository } = createRepository()
    const dependencies = {
      repository,
      requireAdminSession: async () => adminSession,
      hashPassword: async password => `hashed:${password}`,
    }

    const created = await createAdminMember(
      createEvent(),
      {
        email: ' QRCC@Example.Test ',
        password: 'password-123',
        role: 'qrcc',
      },
      dependencies,
    )

    assert.equal(created.email, 'qrcc@example.test')
    assert.equal(created.full_name, 'qrcc@example.test')

    await assertRejectsWithStatus(
      () => createAdminMember(
        createEvent(),
        {
          email: 'qrcc@example.test',
          password: 'password-456',
          role: 'qrcc',
        },
        dependencies,
      ),
      409,
    )
  })

  it('prevents disabling or demoting the last active admin', async () => {
    const { repository } = createRepository([
      createRecord({ id: 'admin-1', email: 'admin@example.test', role: 'admin' }),
      createRecord({ id: 'qrcc-1', email: 'qrcc@example.test', role: 'qrcc' }),
    ])

    const dependencies = {
      repository,
      requireAdminSession: async () => adminSession,
    }

    await assertRejectsWithStatus(
      () => updateAdminMember(createEvent(), 'admin-1', { is_active: false }, dependencies),
      400,
    )
    await assertRejectsWithStatus(
      () => updateAdminMember(createEvent(), 'admin-1', { role: 'management' }, dependencies),
      400,
    )
  })
})
