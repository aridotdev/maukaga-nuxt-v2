import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { unlinkSync } from 'node:fs'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { after, before, test } from 'node:test'
import { createEvent } from 'h3'
import { DASHBOARD_PERIODS } from '../shared/types/dashboard'
import { initializeDashboardTestDatabase } from './helpers/dashboard-database'

// Isolate the endpoint's default database from the application's local data.
const databasePath = `/tmp/maukaga-dashboard-endpoint-${randomUUID()}.db`
process.env.DATABASE_URL = `file:${databasePath}`
const { db } = await import('../server/database')
const { auth } = await import('../server/lib/auth')
const { default: dashboardEndpoint } = await import('../server/api/dashboard.get')
const { pengajuan, pengajuanItems } = await import('../server/database/schema')

before(() => initializeDashboardTestDatabase(db))

after(() => {
  db.$client.close()
  unlinkSync(databasePath)
})

function createRequest(url = '/api/dashboard') {
  const request = new IncomingMessage(new Socket())
  request.url = url
  return createEvent(request, new ServerResponse(request))
}

function createSession(role = 'admin', isActive = true) {
  return {
    session: {},
    user: { id: 'dashboard-user', name: 'Dashboard', email: 'dashboard@test.local', role, isActive },
  }
}

function assertStatus(statusCode: number) {
  return (error: unknown): boolean => {
    assert.equal((error as { statusCode?: number }).statusCode, statusCode)
    return true
  }
}

test('dashboard endpoint requires a session before validating the query', async (context) => {
  context.mock.method(auth.api, 'getSession', async () => null)
  await assert.rejects(dashboardEndpoint(createRequest('/api/dashboard?period=invalid')), assertStatus(401))
})

test('dashboard endpoint forbids inactive users and unsupported roles', async (context) => {
  for (const session of [createSession('admin', false), createSession('unknown')]) {
    const mock = context.mock.method(auth.api, 'getSession', async () => session)
    await assert.rejects(dashboardEndpoint(createRequest()), assertStatus(403))
    mock.mock.restore()
  }
})

test('dashboard endpoint rejects invalid and repeated period parameters', async (context) => {
  context.mock.method(auth.api, 'getSession', async () => createSession())
  for (const query of ['period=invalid', 'period=', 'period=This%20month&period=Last%20month']) {
    await assert.rejects(dashboardEndpoint(createRequest(`/api/dashboard?${query}`)), assertStatus(400))
  }
})

test('dashboard endpoint allows all three application roles and all six periods', async (context) => {
  for (const role of ['admin', 'qrcc', 'management']) {
    const mock = context.mock.method(auth.api, 'getSession', async () => createSession(role))
    for (const period of DASHBOARD_PERIODS) {
      const event = createRequest(`/api/dashboard?period=${encodeURIComponent(period)}`)
      const response = await dashboardEndpoint(event)
      assert.equal(response.period, period)
      assert.deepEqual(response.summary, {
        totalPengajuan: 0,
        pengajuanBaru: 0,
        itemDisetujui: 0,
        itemDitolak: 0,
      })
      assert.equal(event.node.res.getHeader('Cache-Control'), 'private, no-store')
    }
    mock.mock.restore()
  }
})

test('dashboard endpoint returns database statistics and defaults to this month', async (context) => {
  context.mock.method(auth.api, 'getSession', async () => createSession())
  const [record] = await db.insert(pengajuan).values({
    idPengajuan: 'ENDPOINT-DASHBOARD',
    nama: 'Pemohon',
    bagian: 'Service',
    cabang: 'Jakarta',
    pemilik: 'Dealer',
    alasanPengajuan: 'Test endpoint',
    tanggalForm: '2020-01-01',
    submittedAt: new Date(),
  }).returning()
  assert.ok(record)
  await db.insert(pengajuanItems).values({
    pengajuanId: record.id,
    noItem: 1,
    model: 'TEST',
    modelNormalized: 'TEST',
    nomorSeri: 'ENDPOINT-1',
    nomorSeriNormalized: 'ENDPOINT-1',
    keputusanItem: 'Disetujui',
  })

  const response = await dashboardEndpoint(createRequest())
  assert.equal(response.period, 'This month')
  assert.deepEqual(response.summary, {
    totalPengajuan: 1,
    pengajuanBaru: 1,
    itemDisetujui: 1,
    itemDitolak: 0,
  })
})
