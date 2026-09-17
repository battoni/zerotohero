// Progress maths shared by cards, the trail page and the profile heatmap. Pure.

export interface Completable {
  completed_at: string | null
}

export function percent(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}

export function progressOf(items: Completable[]): { done: number, total: number, percent: number } {
  const done = items.filter(i => i.completed_at !== null).length
  return { done, total: items.length, percent: percent(done, items.length) }
}

const DAY = 86_400_000

/**
 * Projected finish date from the recent pace: completions in the last `windowDays`,
 * spread over that window. `null` when there is nothing left or no recent pace.
 */
export function forecastFinish(items: Completable[], now: Date, windowDays = 28): Date | null {
  const remaining = items.filter(i => i.completed_at === null).length
  if (remaining === 0) return null
  const since = now.getTime() - windowDays * DAY
  const recent = items.filter(i => i.completed_at !== null && new Date(i.completed_at).getTime() >= since).length
  if (recent === 0) return null
  const perDay = recent / windowDays
  return new Date(now.getTime() + Math.ceil(remaining / perDay) * DAY)
}

/** Monday 00:00 (local) of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const offset = (r.getDay() + 6) % 7
  r.setDate(r.getDate() - offset)
  return r
}

/** Completion counts per week, oldest first; the last bucket is the current week. */
export function weeklyCounts(completedAt: string[], now: Date, weeks = 20): number[] {
  const current = startOfWeek(now).getTime()
  const counts = Array.from({ length: weeks }, () => 0)
  for (const iso of completedAt) {
    const week = startOfWeek(new Date(iso)).getTime()
    const diff = Math.round((current - week) / (7 * DAY))
    if (diff >= 0 && diff < weeks) counts[weeks - 1 - diff]! += 1
  }
  return counts
}

/** Heat level 0–3 relative to the busiest week. */
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 {
  if (count <= 0 || max <= 0) return 0
  const ratio = count / max
  if (ratio <= 1 / 3) return 1
  if (ratio <= 2 / 3) return 2
  return 3
}

/** Completions in the last 7 days. */
export function completedThisWeek(completedAt: string[], now: Date): number {
  const since = now.getTime() - 7 * DAY
  return completedAt.filter(iso => {
    const t = new Date(iso).getTime()
    return t >= since && t <= now.getTime()
  }).length
}
