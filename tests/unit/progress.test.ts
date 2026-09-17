import { describe, expect, it } from 'vitest'
import { completedThisWeek, forecastFinish, heatLevel, percent, progressOf, startOfWeek, weeklyCounts } from '../../shared/utils/progress'

const now = new Date('2026-09-17T12:00:00')

describe('progress', () => {
  it('computes percent safely', () => {
    expect(percent(3, 10)).toBe(30)
    expect(percent(0, 0)).toBe(0)
    expect(percent(2, 3)).toBe(67)
  })

  it('summarises items', () => {
    expect(progressOf([{ completed_at: 'x' }, { completed_at: null }])).toEqual({ done: 1, total: 2, percent: 50 })
  })

  it('forecasts from the recent pace', () => {
    // 4 done in the last 28 days → 1 per week; 2 left → 14 days.
    const items = [
      ...['2026-09-01', '2026-09-05', '2026-09-10', '2026-09-15'].map(d => ({ completed_at: `${d}T10:00:00` })),
      { completed_at: null },
      { completed_at: null },
    ]
    const eta = forecastFinish(items, now)!
    expect(Math.round((eta.getTime() - now.getTime()) / 86_400_000)).toBe(14)
  })

  it('has no forecast without pace or without remaining work', () => {
    expect(forecastFinish([{ completed_at: null }], now)).toBeNull()
    expect(forecastFinish([{ completed_at: '2026-09-10T00:00:00' }], now)).toBeNull()
    expect(forecastFinish([{ completed_at: '2025-01-01T00:00:00' }, { completed_at: null }], now)).toBeNull()
  })

  it('starts weeks on Monday', () => {
    expect(startOfWeek(now).getDay()).toBe(1)
    expect(startOfWeek(new Date('2026-09-20T23:00:00')).getDate()).toBe(14)
  })

  it('buckets completions per week, newest last', () => {
    const counts = weeklyCounts(['2026-09-16T08:00:00', '2026-09-14T08:00:00', '2026-09-08T08:00:00', '2020-01-01T00:00:00'], now, 4)
    expect(counts).toEqual([0, 0, 1, 2])
  })

  it('maps counts to heat levels', () => {
    expect([0, 1, 2, 3].map(c => heatLevel(c, 3))).toEqual([0, 1, 2, 3])
    expect(heatLevel(5, 0)).toBe(0)
  })

  it('counts the last 7 days', () => {
    expect(completedThisWeek(['2026-09-16T00:00:00', '2026-09-09T00:00:00', '2026-09-18T00:00:00'], now)).toBe(1)
  })
})
