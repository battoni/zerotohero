// Calendar dates as the user sees them (local time), and completion timestamps built from them.

/** YYYY-MM-DD of `d` in the local time zone (toISOString would give tomorrow in the evening west of UTC). */
export function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** True when a YYYY-MM-DD completion date is after today, local time. */
export function isFutureDate(date: string, now: Date = new Date()): boolean {
  return date > localIsoDate(now)
}

/**
 * Timestamp for "done on this day": local noon, never later than now,
 * so a completion dated today doesn't land in the future.
 */
export function completionAt(date: string, now: Date = new Date()): string {
  const noon = new Date(`${date}T12:00:00`)
  return new Date(Math.min(noon.getTime(), now.getTime())).toISOString()
}
