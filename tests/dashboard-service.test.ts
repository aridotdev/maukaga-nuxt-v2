import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { unlinkSync } from 'node:fs'
import { test } from 'node:test'
import { createMaukagaDatabase, type MaukagaDatabase } from '../server/database'
import {
  pengajuan,
  pengajuanItems,
  type Pengajuan,
  type PengajuanItem,
} from '../server/database/schema'
import {
  getDashboardSummary,
  resolveDashboardPeriod,
} from '../server/services/dashboard-service'
import { DASHBOARD_PERIODS, type DashboardPeriod } from '../shared/types/dashboard'
import { initializeDashboardTestDatabase } from './helpers/dashboard-database'

const now = new Date('2026-10-17T03:00:00Z')
const timeZone = 'Asia/Jakarta'

async function createTestDatabase() {
  const databasePath = `/tmp/maukaga-dashboard-${randomUUID()}.db`
  const database = createMaukagaDatabase(`file:${databasePath}`)
  await initializeDashboardTestDatabase(database)
  return {
    database,
    cleanup: () => {
      database.$client.close()
      unlinkSync(databasePath)
    },
  }
}

async function seedSubmission(
  database: MaukagaDatabase,
  id: string,
  timestamp: string,
  decisions: PengajuanItem['keputusanItem'][] = [],
  overrides: Partial<Pick<Pengajuan, 'status' | 'submittedAt' | 'createdAt' | 'deletedAt'>> = {},
): Promise<void> {
  const [record] = await database.insert(pengajuan).values({
    idPengajuan: id,
    nama: 'Pemohon Dashboard',
    bagian: 'Service',
    cabang: 'Jakarta',
    pemilik: 'Dealer Dashboard',
    alasanPengajuan: 'Test statistik',
    tanggalForm: '2020-01-01',
    submittedAt: new Date(timestamp),
    createdAt: new Date(timestamp),
    ...overrides,
  }).returning()
  assert.ok(record)

  if (decisions.length) {
    await database.insert(pengajuanItems).values(decisions.map((decision, index) => ({
      pengajuanId: record.id,
      noItem: index + 1,
      model: 'TEST',
      modelNormalized: 'TEST',
      nomorSeri: `${id}-${index}`,
      nomorSeriNormalized: `${id}-${index}`,
      keputusanItem: decision,
    })))
  }
}

test('resolves all dashboard periods using Jakarta calendar boundaries', () => {
  const expected: Record<DashboardPeriod, [string, string]> = {
    'This month': ['2026-09-30T17:00:00.000Z', '2026-10-31T17:00:00.000Z'],
    'Last month': ['2026-08-31T17:00:00.000Z', '2026-09-30T17:00:00.000Z'],
    'Last 3 months': ['2026-07-31T17:00:00.000Z', '2026-10-31T17:00:00.000Z'],
    'Last 6 months': ['2026-04-30T17:00:00.000Z', '2026-10-31T17:00:00.000Z'],
    'This year': ['2025-12-31T17:00:00.000Z', '2026-12-31T17:00:00.000Z'],
    'Last year': ['2024-12-31T17:00:00.000Z', '2025-12-31T17:00:00.000Z'],
  }

  for (const period of DASHBOARD_PERIODS) {
    const range = resolveDashboardPeriod(period, now, timeZone)
    assert.deepEqual([range.from.toISOString(), range.to.toISOString()], expected[period], period)
  }
})

test('handles local month rollover, year rollover, leap years, and daylight saving', () => {
  const november = resolveDashboardPeriod('This month', new Date('2026-10-31T18:00:00Z'), timeZone)
  assert.equal(november.from.toISOString(), '2026-10-31T17:00:00.000Z')

  const january = resolveDashboardPeriod('Last 3 months', new Date('2027-01-01T01:00:00Z'), timeZone)
  assert.equal(january.from.toISOString(), '2026-10-31T17:00:00.000Z')
  assert.equal(january.to.toISOString(), '2027-01-31T17:00:00.000Z')

  const february = resolveDashboardPeriod('Last month', new Date('2024-03-15T00:00:00Z'), timeZone)
  assert.equal((february.to.getTime() - february.from.getTime()) / 86_400_000, 29)

  const newYork = resolveDashboardPeriod('This month', new Date('2026-11-17T03:00:00Z'), 'America/New_York')
  assert.equal(newYork.from.toISOString(), '2026-11-01T04:00:00.000Z')
  assert.equal(newYork.to.toISOString(), '2026-12-01T05:00:00.000Z')
})

test('counts submissions once, counts mixed item decisions, and excludes soft-deleted records', async () => {
  const fixture = await createTestDatabase()
  const { database } = fixture
  try {
    await seedSubmission(database, 'START', '2026-09-30T17:00:00Z', [
      'Disetujui', 'Disetujui', 'Ditolak', 'Menunggu',
    ])
    await seedSubmission(database, 'COMPLETED', '2026-10-10T03:00:00Z', ['Disetujui'], { status: 'Selesai' })
    await seedSubmission(database, 'NO-ITEMS', '2026-10-12T03:00:00Z')
    await seedSubmission(database, 'FALLBACK', '2026-10-13T03:00:00Z', ['Ditolak'], { submittedAt: null })
    await seedSubmission(database, 'BEFORE', '2026-09-30T16:59:59.999Z', ['Disetujui'])
    await seedSubmission(database, 'END', '2026-10-31T17:00:00Z', ['Ditolak'])
    await seedSubmission(database, 'DELETED', '2026-10-14T03:00:00Z', ['Disetujui', 'Ditolak'], { deletedAt: now })
    await seedSubmission(database, 'SUBMITTED-EARLIER', '2026-09-10T03:00:00Z', ['Disetujui'], { createdAt: now })

    const result = await getDashboardSummary({ period: 'This month' }, { database, now, timeZone })
    assert.equal(result.period, 'This month')
    assert.equal(result.range.timeZone, timeZone)
    assert.deepEqual(result.summary, {
      totalPengajuan: 4,
      pengajuanBaru: 3,
      itemDisetujui: 3,
      itemDitolak: 2,
    })
  } finally {
    fixture.cleanup()
  }
})

test('changes all four statistics for each selected period', async () => {
  const fixture = await createTestDatabase()
  const { database } = fixture
  try {
    for (const month of ['2026-10', '2026-09', '2026-08', '2026-05', '2026-04', '2026-01', '2025-12', '2024-12']) {
      await seedSubmission(database, month, `${month}-15T03:00:00Z`, ['Disetujui', 'Ditolak'])
    }

    const totals: Record<DashboardPeriod, number> = {
      'This month': 1,
      'Last month': 1,
      'Last 3 months': 3,
      'Last 6 months': 4,
      'This year': 6,
      'Last year': 1,
    }
    for (const period of DASHBOARD_PERIODS) {
      const result = await getDashboardSummary({ period }, { database, now, timeZone })
      const count = totals[period]
      assert.deepEqual(result.summary, {
        totalPengajuan: count,
        pengajuanBaru: count,
        itemDisetujui: count,
        itemDitolak: count,
      }, period)
    }
  } finally {
    fixture.cleanup()
  }
})

test('defaults to this month and returns zeroes for an empty database', async () => {
  const fixture = await createTestDatabase()
  const { database } = fixture
  try {
    const result = await getDashboardSummary({}, { database, now, timeZone })
    assert.equal(result.period, 'This month')
    assert.deepEqual(result.summary, {
      totalPengajuan: 0,
      pengajuanBaru: 0,
      itemDisetujui: 0,
      itemDitolak: 0,
    })
  } finally {
    fixture.cleanup()
  }
})

test('rejects unsupported and repeated period query values', async () => {
  for (const period of ['', 'All time', ['This month', 'Last month'], 123, null]) {
    await assert.rejects(getDashboardSummary({ period }, { now, timeZone }), { name: 'ZodError' })
  }
})
