// Locale-aware formatting helpers (auto-imported by Nuxt).
export function formatDate(value: string | Date, locale: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  const d = typeof value === 'string'
    ? (/^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value))
    : value
  return new Intl.DateTimeFormat(locale, opts).format(d)
}

export function relativeTime(value: string, locale: string, now = new Date()): string {
  const diff = (new Date(value).getTime() - now.getTime()) / 1000
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (abs < 60) return rtf.format(0, 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86_400 * 7) return rtf.format(Math.round(diff / 86_400), 'day')
  if (abs < 86_400 * 30) return rtf.format(Math.round(diff / (86_400 * 7)), 'week')
  return rtf.format(Math.round(diff / (86_400 * 30)), 'month')
}

const TAG_TONES = ['violet', 'sky', 'mint', 'coral', 'sun'] as const
export type Tone = typeof TAG_TONES[number]

/** Stable colour for a free-text tag. */
export function toneFor(text: string): Tone {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TAG_TONES[h % TAG_TONES.length]!
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}
