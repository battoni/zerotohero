// Plain-text trail format, shared by "Paste a list" and the seeder.
// Spec: docs/spec-mvp.md §4. Pure functions — no Nuxt, no I/O.

import { localIsoDate } from './dates'

export const TRACK_COLORS = ['violet', 'coral', 'sky', 'mint', 'sun'] as const
export const TRACK_VISIBILITIES = ['private', 'friends', 'public'] as const
export type TrackColor = typeof TRACK_COLORS[number]
export type TrackVisibility = typeof TRACK_VISIBILITIES[number]

export const LIMITS = {
  phases: 20,
  milestones: 200,
  trackTitle: 80,
  goal: 280,
  phaseTitle: 60,
  milestoneTitle: 140,
  tag: 24,
} as const

export interface ParsedMilestone {
  title: string
  tag: string | null
  /** YYYY-MM-DD. Due date when open; completion date when `done`. */
  date: string | null
  done: boolean
}

export interface ParsedPhase {
  /** `null` is the default phase for milestones listed before any `## ` heading. */
  title: string | null
  milestones: ParsedMilestone[]
}

export interface ParsedTrack {
  title: string | null
  goal: string | null
  emoji: string | null
  color: TrackColor | null
  due: string | null
  visibility: TrackVisibility | null
  phases: ParsedPhase[]
}

export type ParseErrorCode =
  | 'empty'
  | 'unknown_meta'
  | 'invalid_color'
  | 'invalid_visibility'
  | 'invalid_date'
  | 'future_date'
  | 'too_long'
  | 'too_many_phases'
  | 'too_many_milestones'

export interface ParseError {
  /** 1-based line number. */
  line: number
  code: ParseErrorCode
  value?: string
}

export interface ParseResult {
  track: ParsedTrack
  errors: ParseError[]
}

type MetaKey = 'emoji' | 'color' | 'due' | 'visibility'
const META_LINE = /^\s*(emoji|color|due|visibility)\s*:/
// A tag starts with a letter, so "#42" in "Fix issue #42" stays in the title.
const TAG = /(^|\s)#(\p{L}[\p{L}\p{N}_-]*)/u
const DATE = /(^|\s)@(\d{4}-\d{2}-\d{2})(?=\s|$)/
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function clip(value: string, max: number, line: number, errors: ParseError[]): string {
  const chars = [...value]
  if (chars.length <= max) return value
  errors.push({ line, code: 'too_long', value })
  return chars.slice(0, max).join('').trimEnd()
}

function isStructured(lines: string[]): boolean {
  return lines.some(l => /^\s*#{1,2}(\s|$)/.test(l) || ITEM.test(l) || /^\s*>/.test(l))
}

function parseMilestone(raw: string, done: boolean, line: number, errors: ParseError[]): ParsedMilestone | null {
  let text = raw
  let tag: string | null = null
  let date: string | null = null

  const tagMatch = text.match(TAG)
  if (tagMatch) {
    tag = clip(tagMatch[2]!, LIMITS.tag, line, errors)
    text = text.replace(tagMatch[0], tagMatch[1]!)
  }
  const dateMatch = text.match(DATE)
  if (dateMatch) {
    if (isValidDate(dateMatch[2]!)) date = dateMatch[2]!
    else errors.push({ line, code: 'invalid_date', value: dateMatch[2] })
    text = text.replace(dateMatch[0], dateMatch[1]!)
  }
  // `\#` and `\@` are literal characters written by toTrackList.
  const title = text.replace(/\\([#@])/g, '$1').replace(/\s+/g, ' ').trim()
  if (!title) return null
  return { title: clip(title, LIMITS.milestoneTitle, line, errors), tag, date, done }
}

function parseMeta(line: string, lineNo: number, track: ParsedTrack, errors: ParseError[]) {
  for (const part of line.split('|')) {
    const idx = part.indexOf(':')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (!value) continue
    switch (key as MetaKey) {
      case 'emoji':
        track.emoji = [...value].slice(0, 8).join('')
        break
      case 'color':
        if ((TRACK_COLORS as readonly string[]).includes(value.toLowerCase())) track.color = value.toLowerCase() as TrackColor
        else errors.push({ line: lineNo, code: 'invalid_color', value })
        break
      case 'due':
        if (isValidDate(value)) track.due = value
        else errors.push({ line: lineNo, code: 'invalid_date', value })
        break
      case 'visibility':
        if ((TRACK_VISIBILITIES as readonly string[]).includes(value.toLowerCase())) track.visibility = value.toLowerCase() as TrackVisibility
        else errors.push({ line: lineNo, code: 'invalid_visibility', value })
        break
      default:
        errors.push({ line: lineNo, code: 'unknown_meta', value: key })
    }
  }
}

export interface ParseOptions {
  /** Reference for "done in the future" checks; `null` skips them (demo seeds are re-dated). */
  now?: Date | null
}

export function parseTrackList(input: string, options: ParseOptions = {}): ParseResult {
  const errors: ParseError[] = []
  const now = options.now === undefined ? new Date() : options.now
  // Completion dates are the user's calendar days: nothing after today, local time.
  const latestDone = now ? localIsoDate(now) : null
  const track: ParsedTrack = { title: null, goal: null, emoji: null, color: null, due: null, visibility: null, phases: [] }
  const lines = input.replace(/\r\n?/g, '\n').split('\n')
  const structured = isStructured(lines)

  let current: ParsedPhase | null = null
  let milestoneCount = 0
  let seenContent = false
  let phaseLimitHit = false
  let milestoneLimitHit = false

  const phaseFor = (): ParsedPhase => {
    if (!current) {
      current = { title: null, milestones: [] }
      track.phases.push(current)
    }
    return current
  }

  const addMilestone = (raw: string, done: boolean, lineNo: number) => {
    if (phaseLimitHit && current === null) return
    if (milestoneCount >= LIMITS.milestones) {
      if (!milestoneLimitHit) errors.push({ line: lineNo, code: 'too_many_milestones' })
      milestoneLimitHit = true
      return
    }
    const m = parseMilestone(raw, done, lineNo, errors)
    if (!m) return
    if (m.done && m.date && latestDone && m.date > latestDone) {
      errors.push({ line: lineNo, code: 'future_date', value: m.date })
      m.date = null
    }
    phaseFor().milestones.push(m)
    milestoneCount += 1
  }

  lines.forEach((rawLine, i) => {
    const lineNo = i + 1
    const line = rawLine.trim()
    if (!line) return

    if (!structured) {
      addMilestone(line, false, lineNo)
      return
    }

    if (/^#(\s|$)/.test(line)) {
      const title = line.slice(1).trim()
      if (track.title === null && title) track.title = clip(title, LIMITS.trackTitle, lineNo, errors)
      return
    }
    if (/^##(\s|$)/.test(line)) {
      seenContent = true
      if (track.phases.length >= LIMITS.phases) {
        if (!phaseLimitHit) errors.push({ line: lineNo, code: 'too_many_phases' })
        phaseLimitHit = true
        current = null
        return
      }
      const title = clip(line.replace(/^##\s*/, '').trim(), LIMITS.phaseTitle, lineNo, errors)
      current = { title: title || null, milestones: [] }
      track.phases.push(current)
      return
    }
    if (/^>/.test(line)) {
      const goal = line.replace(/^>\s?/, '').trim()
      if (goal) track.goal = clip(track.goal ? `${track.goal} ${goal}` : goal, LIMITS.goal, lineNo, errors)
      return
    }
    if (!seenContent && META_LINE.test(line)) {
      parseMeta(line, lineNo, track, errors)
      return
    }
    const item = line.match(ITEM)
    seenContent = true
    if (phaseLimitHit && current === null) return
    if (item) addMilestone(item[2]!, (item[1] ?? ' ').toLowerCase() === 'x', lineNo)
    else addMilestone(line, false, lineNo)
  })

  if (milestoneCount === 0 && track.phases.length === 0) {
    errors.push({ line: 1, code: 'empty' })
  }
  return { track, errors }
}

export function toTrackList(track: ParsedTrack): string {
  const out: string[] = []
  if (track.title) out.push(`# ${track.title}`)
  if (track.goal) out.push(`> ${track.goal}`)
  const meta: string[] = []
  if (track.emoji) meta.push(`emoji: ${track.emoji}`)
  if (track.color) meta.push(`color: ${track.color}`)
  if (track.due) meta.push(`due: ${track.due}`)
  if (track.visibility) meta.push(`visibility: ${track.visibility}`)
  if (meta.length) out.push(meta.join(' | '))
  if (out.length) out.push('')

  track.phases.forEach((phase, i) => {
    if (phase.title !== null) out.push(`## ${phase.title}`)
    else if (i > 0) out.push('##')
    for (const m of phase.milestones) {
      const safe = m.title.replace(/(^|\s)([#@])/g, '$1\\$2')
      const parts = [`- [${m.done ? 'x' : ' '}] ${safe}`]
      if (m.tag) parts.push(`#${m.tag}`)
      if (m.date) parts.push(`@${m.date}`)
      out.push(parts.join(' '))
    }
  })
  return `${out.join('\n').trimEnd()}\n`
}
