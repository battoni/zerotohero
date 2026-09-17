import { describe, expect, it } from 'vitest'
import { completionAt, isFutureDate, localIsoDate } from '../../shared/utils/dates'

describe('dates', () => {
  it('uses the local calendar day', () => {
    const lateEvening = new Date(2026, 8, 17, 23, 30)
    expect(localIsoDate(lateEvening)).toBe('2026-09-17')
    expect(isFutureDate('2026-09-17', lateEvening)).toBe(false)
    expect(isFutureDate('2026-09-18', lateEvening)).toBe(true)
  })

  it('never dates a completion after now', () => {
    const morning = new Date(2026, 8, 17, 8, 0)
    expect(completionAt('2026-09-17', morning)).toBe(morning.toISOString())
    expect(completionAt('2026-09-10', morning)).toBe(new Date(2026, 8, 10, 12, 0).toISOString())
  })
})
