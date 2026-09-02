import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { H3Event } from 'h3'
import type {
  LocalConfigRecord,
  LocalConfigRepository,
} from '../../server/repositories/config-repository'
import type {
  PrintLayoutRecord,
  PrintLayoutsRepository,
  UpsertPrintLayoutInput,
} from '../../server/repositories/print-layouts-repository'
import {
  deleteAdminPrintLayout,
  listAdminPrintLayouts,
  saveAdminPrintLayout,
  setActiveAdminPrintLayout,
} from '../../server/services/admin-print-layouts-service'
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

function createLayoutRecord(input: UpsertPrintLayoutInput): PrintLayoutRecord {
  return {
    ...input,
    createdAt: new Date(input.createdAtGas || '2026-09-01T00:00:00.000Z'),
    updatedAt: new Date(input.updatedAtGas || '2026-09-01T00:00:00.000Z'),
  }
}

function createLayoutRepository(initialRecords: PrintLayoutRecord[] = []) {
  let records = [...initialRecords]

  const repository: PrintLayoutsRepository = {
    listLayouts: async () => [...records],
    findLayoutById: async id => records.find(record => record.id === id) || null,
    upsertLayout: async (input) => {
      const existing = records.find(record => record.id === input.id)
      const record = createLayoutRecord({
        ...input,
        createdAtGas: existing?.createdAtGas || input.createdAtGas,
      })
      const index = records.findIndex(item => item.id === input.id)

      if (index >= 0) records[index] = record
      else records.push(record)

      return record
    },
    deleteLayout: async (id) => {
      records = records.filter(record => record.id !== id)
    },
  }

  return {
    repository,
    getRecords: () => records,
  }
}

function createConfigRepository(initialValues: Record<string, string> = {}) {
  const values = { ...initialValues }
  const now = new Date('2026-09-01T00:00:00.000Z')

  const repository: LocalConfigRepository = {
    listConfig: async () => Object.entries(values).map(([key, value]) => ({
      key,
      value,
      createdAt: now,
      updatedAt: now,
    }) satisfies LocalConfigRecord),
    getValue: async key => values[key] || '',
    getValues: async keys => Object.fromEntries(keys.map(key => [key, values[key] || ''])),
    setValue: async (key, value) => {
      values[key] = value === null || value === undefined ? '' : String(value)
    },
    setValues: async (nextValues) => {
      for (const [key, value] of Object.entries(nextValues)) {
        values[key] = value === null || value === undefined ? '' : String(value)
      }
    },
  }

  return {
    repository,
    values,
  }
}

function createDependencies(session: AdminSession = adminSession) {
  const layouts = createLayoutRepository()
  const config = createConfigRepository()

  return {
    layoutRepository: layouts.repository,
    configRepository: config.repository,
    requireAdminSession: async () => session,
    getLayoutRecords: layouts.getRecords,
    configValues: config.values,
  }
}

function assertRejectsWithStatus(action: () => Promise<unknown>, statusCode: number) {
  return assert.rejects(action, (error: unknown) => {
    assert.equal((error as { statusCode?: number }).statusCode, statusCode)
    return true
  })
}

describe('admin print layouts service', () => {
  it('returns built-in defaults and stores active layout keys in local config', async () => {
    const dependencies = createDependencies()

    const state = await listAdminPrintLayouts(createEvent(), dependencies)

    assert.deepEqual(state.active, {
      local: 'local-default',
      import: 'import-default',
    })
    assert.equal(state.layouts.length, 2)
    assert.equal(state.activeLayouts.local?.id, 'local-default')
    assert.equal(dependencies.configValues.ACTIVE_PRINT_LAYOUT_LOCAL, 'local-default')
    assert.equal(dependencies.configValues.ACTIVE_PRINT_LAYOUT_IMPORT, 'import-default')
  })

  it('saves a custom layout and activates it through local config', async () => {
    const dependencies = createDependencies()

    const saved = await saveAdminPrintLayout(createEvent(), {
      layout: {
        type: 'local',
        name: 'Local Geser Kanan',
        offsetX: 1.5,
        offsetY: -0.5,
        gapProductModel: 0.25,
        gapModelSerial: 0.75,
      },
    }, dependencies)

    const savedLayoutId = saved.savedLayoutId || ''
    assert.match(savedLayoutId, /^local-/)
    assert.equal(saved.layouts.find(layout => layout.id === savedLayoutId)?.updatedBy, 'Admin User')

    const active = await setActiveAdminPrintLayout(createEvent(), {
      type: 'local',
      id: savedLayoutId,
    }, dependencies)

    assert.equal(active.active.local, savedLayoutId)
    assert.equal(active.activeLayouts.local?.offsetX, 1.5)
    assert.equal(dependencies.configValues.ACTIVE_PRINT_LAYOUT_LOCAL, savedLayoutId)
  })

  it('blocks deleting built-in and active custom layouts', async () => {
    const dependencies = createDependencies()

    await assertRejectsWithStatus(
      () => deleteAdminPrintLayout(createEvent(), 'local-default', dependencies),
      400,
    )

    const saved = await saveAdminPrintLayout(createEvent(), {
      layout: { type: 'import', name: 'Import Custom' },
    }, dependencies)
    const savedLayoutId = saved.savedLayoutId || ''

    await setActiveAdminPrintLayout(createEvent(), { type: 'import', id: savedLayoutId }, dependencies)
    await assertRejectsWithStatus(
      () => deleteAdminPrintLayout(createEvent(), savedLayoutId, dependencies),
      400,
    )
  })

  it('allows deleting an inactive custom layout', async () => {
    const dependencies = createDependencies()
    const saved = await saveAdminPrintLayout(createEvent(), {
      layout: { type: 'local', name: 'Local Custom' },
    }, dependencies)

    const state = await deleteAdminPrintLayout(createEvent(), saved.savedLayoutId, dependencies)

    assert.equal(dependencies.getLayoutRecords().length, 0)
    assert.equal(state.layouts.some(layout => layout.id === saved.savedLayoutId), false)
  })

  it('requires admin or qrcc access', async () => {
    const dependencies = createDependencies(managementSession)

    await assertRejectsWithStatus(
      () => listAdminPrintLayouts(createEvent(), dependencies),
      403,
    )
  })
})
