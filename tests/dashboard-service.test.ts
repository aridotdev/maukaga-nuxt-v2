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
  overrides: Partial<Pick<Pengajuan, 'status' | 'submittedAt' | 'createdAt' | 'deletedAt' | 'nama' | 'bagian' | 'cabang'>> = {},
  model = 'TEST',
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
      model,
      modelNormalized: model.toUpperCase(),
      nomorSeri: `${id}-${index}`,
      nomorSeriNormalized: `${id}-${index}`,
      keputusanItem: decision,
    })))
  }
}

test('shows five newest submissions and ranks models and applicants within the selected period', async () => {
  const fixture = await createTestDatabase()
  const { database } = fixture
  try {
    await seedSubmission(database, 'A', '2026-10-10T03:00:00Z', ['Disetujui', 'Menunggu'], { nama: 'Ana' }, 'MODEL A')
    await seedSubmission(database, 'B', '2026-10-11T03:00:00Z', ['Ditolak'], { nama: 'Ana', submittedAt: null }, 'MODEL A')
    await seedSubmission(database, 'C', '2026-10-12T03:00:00Z', ['Menunggu'], { nama: 'Budi', cabang: 'Bandung' }, 'MODEL B')
    await seedSubmission(database, 'D', '2026-10-13T03:00:00Z', ['Menunggu'], { nama: 'Ana', cabang: 'Bandung' }, 'MODEL C')
    await seedSubmission(database, 'E', '2026-10-14T03:00:00Z', ['Disetujui'], { nama: 'Cici' }, 'MODEL A')
    await seedSubmission(database, 'F', '2026-10-15T03:00:00Z', ['Menunggu'], { nama: 'Dedi' }, 'MODEL D')
    await seedSubmission(database, 'DELETED', '2026-10-16T03:00:00Z', ['Menunggu'], { nama: 'Ana', deletedAt: now }, 'MODEL A')
    await seedSubmission(database, 'BEFORE', '2026-09-29T03:00:00Z', ['Menunggu'], { nama: 'Ana' }, 'MODEL A')

    const result = await getDashboardSummary({ period: 'This month' }, { database, now, timeZone })
    assert.deepEqual(result.recentSubmissions.map(row => row.idPengajuan), ['F', 'E', 'D', 'C', 'B'])
    assert.deepEqual(result.recentSubmissions.map(row => row.itemCount), [1, 1, 1, 1, 1])
    assert.deepEqual(result.topModels, [
      { model: 'MODEL A', itemCount: 4 },
      { model: 'MODEL B', itemCount: 1 },
      { model: 'MODEL C', itemCount: 1 },
      { model: 'MODEL D', itemCount: 1 },
    ])
    assert.deepEqual(result.topPemohon, [
      { nama: 'Ana', bagian: 'Service', cabang: 'Jakarta', submissionCount: 2 },
      { nama: 'Ana', bagian: 'Service', cabang: 'Bandung', submissionCount: 1 },
      { nama: 'Budi', bagian: 'Service', cabang: 'Bandung', submissionCount: 1 },
      { nama: 'Cici', bagian: 'Service', cabang: 'Jakarta', submissionCount: 1 },
      { nama: 'Dedi', bagian: 'Service', cabang: 'Jakarta', submissionCount: 1 },
    ])

    const lastMonth = await getDashboardSummary({ period: 'Last month' }, { database, now, timeZone })
    assert.deepEqual(lastMonth.recentSubmissions.map(row => row.idPengajuan), ['BEFORE'])
    assert.deepEqual(lastMonth.topModels, [{ model: 'MODEL A', itemCount: 1 }])
  } finally {
    fixture.cleanup()
  }
})

test('resolves all dashboard periods using Jakarta calendar boundaries', () => {
  const expected: Record<DashboardPeriod, [string, string]> = {
    'This month': ['2026-09-30T17:00:00.000Z', '2026-10-31T17:00:00.000Z'],
    'Last month': ['2026-08-31T17:00:00.000Z', '2026-09-30T17:00:00.000Z'],
    'Last 3 months': ['2026-07-31T17:00:00.000Z', '2026-10-31T17:00:00.000Z'],
    'Last 6 months': ['2026-04-30T17:00:00.000Z', '2026-10-31T17:00:00.000Z'],
    'This year': ['2025-12-31T17:00:00.000Z', '2026-12-31T17:00:00.000Z'],
    'Last year': ['2024-12-31T17:00:00.000Z', '2025-12-31T17:00:00.000Z'],
    'All time': ['1970-01-01T00:00:00.000Z', '2026-10-17T03:00:00.000Z'],
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
      'All time': 8,
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
  for (const period of ['', ['This month', 'Last month'], 123, null]) {
    await assert.rejects(getDashboardSummary({ period }, { now, timeZone }), { name: 'ZodError' })
  }
})
