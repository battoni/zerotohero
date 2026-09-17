// In-memory repository for demo mode. Mirrors the Supabase rules (visibility,
// ownership, activities, kudos) so the product behaves the same without a backend.
// Pure: no Nuxt imports, so unit tests can load it directly.
import { parseTrackList } from '../../shared/utils/track-list'
import type {
  Evidence, FeedItem, FriendState, Friends, Locale, Milestone, Phase, Profile,
  ProfileDetail, Track, TrackDetail, TrackInput, TrackSummary,
} from '../../shared/types/domain'
import { RepoError, type DataRepository } from './types'

interface Friendship { requesterId: string, addresseeId: string, status: 'pending' | 'accepted' }
interface Activity { id: string, type: FeedItem['type'], actorId: string, trackId: string, milestoneId: string | null, createdAt: string }
interface StoredTrack extends Track { phases: Phase[] }

export interface DemoState {
  version: 1
  meId: string
  profiles: Profile[]
  tracks: StoredTrack[]
  evidences: Evidence[]
  friendships: Friendship[]
  follows: { userId: string, trackId: string }[]
  activities: Activity[]
  kudos: { activityId: string, userId: string }[]
}

export interface DemoStorage {
  load(): DemoState | null
  save(state: DemoState): void
}

export const DEMO_ME = 'u-alex'

const PEOPLE: Profile[] = [
  { id: DEMO_ME, handle: 'alex', displayName: 'Alex', avatarUrl: null, locale: 'en', onboarded: true },
  { id: 'u-ana', handle: 'ana', displayName: 'Ana', avatarUrl: null, locale: 'pt-BR', onboarded: true },
  { id: 'u-rafa', handle: 'rafa', displayName: 'Rafa', avatarUrl: null, locale: 'pt-BR', onboarded: true },
  { id: 'u-luiza', handle: 'luiza', displayName: 'Lu', avatarUrl: null, locale: 'en', onboarded: true },
  { id: 'u-bruno', handle: 'bruno', displayName: 'Bruno', avatarUrl: null, locale: 'pt-BR', onboarded: true },
  { id: 'u-carla', handle: 'carla', displayName: 'Carla', avatarUrl: null, locale: 'en', onboarded: true },
]

const DAY = 86_400_000

let seq = 0
function newId(prefix: string): string {
  seq += 1
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${seq}`
  return `${prefix}-${rnd}`
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/** Builds the initial demo world from the seed markdown files, with dates shifted so the latest one is "yesterday". */
export function buildDemoState(files: Record<string, string>, now: Date): DemoState {
  const state: DemoState = {
    version: 1,
    meId: DEMO_ME,
    profiles: clone(PEOPLE),
    tracks: [],
    evidences: [],
    friendships: [
      { requesterId: 'u-ana', addresseeId: DEMO_ME, status: 'accepted' },
      { requesterId: DEMO_ME, addresseeId: 'u-rafa', status: 'accepted' },
      { requesterId: 'u-luiza', addresseeId: DEMO_ME, status: 'accepted' },
      { requesterId: 'u-bruno', addresseeId: DEMO_ME, status: 'pending' },
    ],
    follows: [],
    activities: [],
    kudos: [],
  }

  const parsed = Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, text]) => {
      const file = path.split('/').pop() ?? path
      const handle = file.split('.')[0]!
      return { handle, slug: file.replace(/\.md$/, ''), track: parseTrackList(text).track }
    })

  const allDates = parsed.flatMap(p => p.track.phases.flatMap(ph => ph.milestones.map(m => m.date).filter((d): d is string => !!d)))
  const latest = allDates.length ? Math.max(...allDates.map(d => Date.parse(`${d}T00:00:00Z`))) : now.getTime()
  const shift = now.getTime() - DAY - latest

  for (const { handle, slug, track } of parsed) {
    const owner = state.profiles.find(p => p.handle === handle)
    if (!owner) continue
    const trackId = `t-${slug}`
    const phases: Phase[] = track.phases.map((ph, pi) => ({
      id: `${trackId}-p${pi}`,
      title: ph.title ?? 'General',
      position: pi,
      milestones: ph.milestones.map((m, mi) => {
        const shifted = m.date ? new Date(Date.parse(`${m.date}T15:00:00Z`) + shift).toISOString() : null
        return {
          id: `${trackId}-p${pi}-m${mi}`,
          phaseId: `${trackId}-p${pi}`,
          title: m.title,
          tag: m.tag,
          position: mi,
          dueDate: m.done ? null : m.date,
          completedAt: m.done ? (shifted ?? new Date(now.getTime() - 3 * DAY).toISOString()) : null,
          timeSpentMinutes: m.done ? 60 : null,
        }
      }),
    }))
    state.tracks.push({
      id: trackId,
      ownerId: owner.id,
      title: track.title ?? slug,
      goal: track.goal,
      emoji: track.emoji ?? '🎯',
      color: track.color ?? 'violet',
      targetDate: track.due,
      visibility: track.visibility ?? 'private',
      sourceTrackId: null,
      copiesCount: { 'ana': 21, 'rafa': 12, 'luiza': 7, 'alex': 4 }[handle] ?? 0,
      createdAt: new Date(now.getTime() - 150 * DAY).toISOString(),
      phases,
    })
  }

  // Activities from the seeded completions.
  for (const t of state.tracks) {
    const done = t.phases.flatMap(p => p.milestones).filter(m => m.completedAt).sort((a, b) => a.completedAt!.localeCompare(b.completedAt!))
    if (done.length) state.activities.push({ id: `a-${t.id}-start`, type: 'track_started', actorId: t.ownerId, trackId: t.id, milestoneId: null, createdAt: done[0]!.completedAt! })
    for (const m of done) state.activities.push({ id: `a-${m.id}`, type: 'milestone_completed', actorId: t.ownerId, trackId: t.id, milestoneId: m.id, createdAt: m.completedAt! })
    const all = t.phases.flatMap(p => p.milestones)
    if (all.length && done.length === all.length) {
      state.activities.push({ id: `a-${t.id}-done`, type: 'track_completed', actorId: t.ownerId, trackId: t.id, milestoneId: null, createdAt: done[done.length - 1]!.completedAt! })
    }
  }

  // Follows and a few cheers so the social screens are not empty.
  const mine = state.tracks.find(t => t.ownerId === DEMO_ME && t.visibility === 'public')
  if (mine) {
    for (const u of ['u-ana', 'u-rafa', 'u-luiza']) {
      state.follows.push({ userId: u, trackId: mine.id })
      state.activities.push({ id: `a-follow-${u}`, type: 'track_followed', actorId: u, trackId: mine.id, milestoneId: null, createdAt: new Date(now.getTime() - 4 * DAY).toISOString() })
    }
  }
  const rafaDone = state.activities.find(a => a.type === 'track_completed' && a.actorId === 'u-rafa')
  if (rafaDone) for (const u of [DEMO_ME, 'u-ana', 'u-luiza']) state.kudos.push({ activityId: rafaDone.id, userId: u })
  const myLatest = state.activities.filter(a => a.actorId === DEMO_ME && a.type === 'milestone_completed').at(-1)
  if (myLatest) state.kudos.push({ activityId: myLatest.id, userId: 'u-ana' })

  // A note on the portfolio spec so the trail shows evidence.
  const spec = mine?.phases.flatMap(p => p.milestones).find(m => m.completedAt && m.tag === 'spec')
  if (spec) {
    state.evidences.push({
      id: 'e-spec', milestoneId: spec.id, kind: 'note', url: null, fileName: null,
      body: 'One page per project: goal, users, three screens, what is out of scope.',
      learned: 'Writing the edge cases first changed the data model.', createdAt: spec.completedAt!,
    })
  }
  return state
}

export function localStorageDemo(key = 'zth_demo_v1'): DemoStorage {
  return {
    load() {
      try {
        const raw = globalThis.localStorage?.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw) as DemoState
        return parsed.version === 1 ? parsed : null
      }
      catch {
        return null
      }
    },
    save(state) {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(state))
      }
      catch {
        // Private mode or quota: the demo keeps working in memory.
      }
    },
  }
}

export function createDemoRepository(opts: { files: Record<string, string>, now?: () => Date, storage?: DemoStorage }): DataRepository & { reset(): void } {
  const now = opts.now ?? (() => new Date())
  let state: DemoState = opts.storage?.load() ?? buildDemoState(opts.files, now())
  const persist = () => opts.storage?.save(state)

  const me = () => state.profiles.find(p => p.id === state.meId)!
  const profileOf = (id: string) => state.profiles.find(p => p.id === id)!
  const areFriends = (a: string, b: string) => state.friendships.some(f => f.status === 'accepted'
    && ((f.requesterId === a && f.addresseeId === b) || (f.requesterId === b && f.addresseeId === a)))
  const canView = (t: StoredTrack) => t.ownerId === state.meId || t.visibility === 'public'
    || (t.visibility === 'friends' && areFriends(t.ownerId, state.meId))
  const trackById = (id: string) => state.tracks.find(t => t.id === id)
  const findMilestone = (id: string) => {
    for (const t of state.tracks) {
      for (const p of t.phases) {
        const m = p.milestones.find(x => x.id === id)
        if (m) return { track: t, phase: p, milestone: m }
      }
    }
    return null
  }
  const ownedMilestone = (id: string) => {
    const found = findMilestone(id)
    if (!found || !canView(found.track)) throw new RepoError('not_found')
    if (found.track.ownerId !== state.meId) throw new RepoError('forbidden')
    return found
  }
  const milestonesOf = (t: StoredTrack) => [...t.phases].sort((a, b) => a.position - b.position)
    .flatMap(p => [...p.milestones].sort((a, b) => a.position - b.position))

  const summary = (t: StoredTrack): TrackSummary => {
    const ms = milestonesOf(t)
    const done = ms.filter(m => m.completedAt)
    const { phases: _phases, ...track } = t
    return {
      ...clone(track),
      owner: clone(profileOf(t.ownerId)),
      total: ms.length,
      done: done.length,
      nextMilestoneTitle: ms.find(m => !m.completedAt)?.title ?? null,
      lastCompletedAt: done.map(m => m.completedAt!).sort().at(-1) ?? null,
    }
  }

  const recordCompletion = (t: StoredTrack, m: Milestone) => {
    if (!state.activities.some(a => a.trackId === t.id && a.type === 'track_started')) {
      state.activities.push({ id: newId('a'), type: 'track_started', actorId: t.ownerId, trackId: t.id, milestoneId: null, createdAt: m.completedAt! })
    }
    state.activities.push({ id: newId('a'), type: 'milestone_completed', actorId: t.ownerId, trackId: t.id, milestoneId: m.id, createdAt: m.completedAt! })
    const all = milestonesOf(t)
    if (all.every(x => x.completedAt)) {
      state.activities.push({ id: newId('a'), type: 'track_completed', actorId: t.ownerId, trackId: t.id, milestoneId: null, createdAt: m.completedAt! })
    }
  }

  const dropActivities = (pred: (a: Activity) => boolean) => {
    const gone = new Set(state.activities.filter(pred).map(a => a.id))
    state.activities = state.activities.filter(a => !gone.has(a.id))
    state.kudos = state.kudos.filter(k => !gone.has(k.activityId))
  }

  const validate = (input: TrackInput) => {
    if (!input.title.trim() || [...input.title].length > 80) throw new RepoError('invalid', 'title')
    if (!input.phases.length) throw new RepoError('invalid', 'phases')
    for (const p of input.phases) {
      if (!p.title.trim()) throw new RepoError('invalid', 'phase_title')
      for (const m of p.milestones) if (!m.title.trim()) throw new RepoError('invalid', 'milestone_title')
    }
  }

  const repo: DataRepository & { reset(): void } = {
    mode: 'demo',

    reset() {
      state = buildDemoState(opts.files, now())
      persist()
    },

    async me() {
      return clone(me())
    },

    async updateProfile(patch) {
      const p = me()
      if (patch.handle !== undefined) {
        const handle = patch.handle.toLowerCase()
        if (!/^[a-z0-9_]{3,20}$/.test(handle)) throw new RepoError('invalid', 'handle')
        if (state.profiles.some(x => x.id !== p.id && x.handle === handle)) throw new RepoError('handle_taken')
        p.handle = handle
      }
      if (patch.displayName !== undefined) p.displayName = patch.displayName?.trim() || null
      if (patch.locale !== undefined) p.locale = patch.locale as Locale
      if (patch.onboarded) p.onboarded = true
      persist()
      return clone(p)
    },

    async listMyTracks() {
      return state.tracks.filter(t => t.ownerId === state.meId)
        .map(summary)
        .sort((a, b) => (b.lastCompletedAt ?? b.createdAt).localeCompare(a.lastCompletedAt ?? a.createdAt))
    },

    async getTrack(id) {
      const t = trackById(id)
      if (!t || !canView(t)) return null
      const followers = state.follows.filter(f => f.trackId === id).map(f => clone(profileOf(f.userId)))
      const ms = milestonesOf(t)
      const recentEvidence = state.evidences
        .filter(e => ms.some(m => m.id === e.milestoneId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5)
        .map(e => ({ ...clone(e), milestoneTitle: ms.find(m => m.id === e.milestoneId)!.title }))
      return {
        ...summary(t),
        phases: clone([...t.phases].sort((a, b) => a.position - b.position)
          .map(p => ({ ...p, milestones: [...p.milestones].sort((a, b) => a.position - b.position) }))),
        followers,
        isFollowing: state.follows.some(f => f.trackId === id && f.userId === state.meId),
        isOwner: t.ownerId === state.meId,
        recentEvidence,
      } satisfies TrackDetail
    },

    async createTrack(input) {
      validate(input)
      const id = newId('t')
      const at = now().toISOString()
      const track: StoredTrack = {
        id,
        ownerId: state.meId,
        title: input.title.trim(),
        goal: input.goal?.trim() || null,
        emoji: input.emoji || '🎯',
        color: input.color,
        targetDate: input.targetDate,
        visibility: input.visibility,
        sourceTrackId: null,
        copiesCount: 0,
        createdAt: at,
        phases: input.phases.map((p, pi) => {
          const phaseId = newId('p')
          return {
            id: phaseId,
            title: p.title.trim(),
            position: pi,
            milestones: p.milestones.map((m, mi) => ({
              id: newId('m'), phaseId, title: m.title.trim(), tag: m.tag, position: mi,
              dueDate: m.dueDate, completedAt: m.completedAt ?? null, timeSpentMinutes: null,
            })),
          }
        }),
      }
      state.tracks.push(track)
      for (const m of milestonesOf(track).filter(x => x.completedAt)) recordCompletion(track, m)
      persist()
      return id
    },

    async updateTrack(id, input) {
      validate(input)
      const t = trackById(id)
      if (!t || t.ownerId !== state.meId) throw new RepoError('not_found')
      const existing = new Map(milestonesOf(t).map(m => [m.id, m]))
      const phaseIds = new Set(t.phases.map(p => p.id))
      t.title = input.title.trim()
      t.goal = input.goal?.trim() || null
      t.emoji = input.emoji || '🎯'
      t.color = input.color
      t.targetDate = input.targetDate
      t.visibility = input.visibility
      const kept = new Set<string>()
      t.phases = input.phases.map((p, pi) => {
        if (p.id && !phaseIds.has(p.id)) throw new RepoError('invalid', 'phase')
        const phaseId = p.id ?? newId('p')
        return {
          id: phaseId,
          title: p.title.trim(),
          position: pi,
          milestones: p.milestones.map((m, mi) => {
            const prev = m.id ? existing.get(m.id) : undefined
            if (m.id && !prev) throw new RepoError('invalid', 'milestone')
            if (prev) kept.add(prev.id)
            return {
              id: prev?.id ?? newId('m'),
              phaseId,
              title: m.title.trim(),
              tag: m.tag,
              position: mi,
              dueDate: m.dueDate,
              completedAt: prev ? prev.completedAt : (m.completedAt ?? null),
              timeSpentMinutes: prev?.timeSpentMinutes ?? null,
            }
          }),
        }
      })
      const removed = [...existing.keys()].filter(k => !kept.has(k))
      dropActivities(a => a.milestoneId !== null && removed.includes(a.milestoneId))
      state.evidences = state.evidences.filter(e => !removed.includes(e.milestoneId))
      persist()
    },

    async deleteTrack(id) {
      const t = trackById(id)
      if (!t || t.ownerId !== state.meId) throw new RepoError('not_found')
      const ms = new Set(milestonesOf(t).map(m => m.id))
      state.tracks = state.tracks.filter(x => x.id !== id)
      state.follows = state.follows.filter(f => f.trackId !== id)
      state.evidences = state.evidences.filter(e => !ms.has(e.milestoneId))
      dropActivities(a => a.trackId === id)
      for (const other of state.tracks) if (other.sourceTrackId === id) other.sourceTrackId = null
      persist()
    },

    async completeMilestone(milestoneId, input) {
      const { track, milestone } = ownedMilestone(milestoneId)
      if (milestone.completedAt) return
      milestone.completedAt = input?.completedAt ?? now().toISOString()
      milestone.timeSpentMinutes = input?.timeSpentMinutes ?? null
      const ev = input?.evidence
      if (ev) {
        state.evidences.push({
          id: newId('e'),
          milestoneId,
          kind: ev.kind,
          url: ev.url?.trim() || null,
          body: ev.body?.trim() || null,
          learned: ev.learned?.trim() || null,
          fileName: ev.file?.name ?? null,
          createdAt: milestone.completedAt,
        })
      }
      recordCompletion(track, milestone)
      persist()
    },

    async reopenMilestone(milestoneId) {
      const { track, milestone } = ownedMilestone(milestoneId)
      if (!milestone.completedAt) return
      milestone.completedAt = null
      milestone.timeSpentMinutes = null
      state.evidences = state.evidences.filter(e => e.milestoneId !== milestoneId)
      dropActivities(a => (a.type === 'milestone_completed' && a.milestoneId === milestoneId)
        || (a.type === 'track_completed' && a.trackId === track.id))
      persist()
    },

    async setFollowing(trackId, following) {
      const t = trackById(trackId)
      if (!t || !canView(t)) throw new RepoError('not_found')
      const has = state.follows.some(f => f.trackId === trackId && f.userId === state.meId)
      if (following && !has) {
        state.follows.push({ userId: state.meId, trackId })
        state.activities.push({ id: newId('a'), type: 'track_followed', actorId: state.meId, trackId, milestoneId: null, createdAt: now().toISOString() })
      }
      if (!following && has) {
        state.follows = state.follows.filter(f => !(f.trackId === trackId && f.userId === state.meId))
        dropActivities(a => a.type === 'track_followed' && a.trackId === trackId && a.actorId === state.meId)
      }
      persist()
    },

    async explore({ search, filter = 'popular' }) {
      const q = search?.trim().toLowerCase()
      let list = state.tracks.filter(t => t.visibility !== 'private' && canView(t))
      if (filter === 'friends') list = list.filter(t => t.ownerId !== state.meId && areFriends(t.ownerId, state.meId))
      if (q) list = list.filter(t => [t.title, t.goal ?? '', ...milestonesOf(t).map(m => m.tag ?? '')].some(s => s.toLowerCase().includes(q)))
      const out = list.map(summary)
      if (filter === 'recent') out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      else out.sort((a, b) => b.copiesCount - a.copiesCount || a.title.localeCompare(b.title))
      return out
    },

    async copyTrack(id) {
      const src = trackById(id)
      if (!src || !canView(src)) throw new RepoError('not_found')
      const newTrackId = newId('t')
      const copy: StoredTrack = {
        ...clone(src),
        id: newTrackId,
        ownerId: state.meId,
        targetDate: null,
        visibility: 'private',
        sourceTrackId: src.id,
        copiesCount: 0,
        createdAt: now().toISOString(),
        phases: src.phases.map((p) => {
          const phaseId = newId('p')
          return {
            ...clone(p),
            id: phaseId,
            milestones: p.milestones.map(m => ({ ...clone(m), id: newId('m'), phaseId, completedAt: null, timeSpentMinutes: null, dueDate: null })),
          }
        }),
      }
      state.tracks.push(copy)
      src.copiesCount += 1
      persist()
      return newTrackId
    },

    async friends(): Promise<Friends> {
      const accepted: Profile[] = []
      const incoming: Profile[] = []
      const outgoing: Profile[] = []
      for (const f of state.friendships) {
        if (f.requesterId !== state.meId && f.addresseeId !== state.meId) continue
        const other = profileOf(f.requesterId === state.meId ? f.addresseeId : f.requesterId)
        if (f.status === 'accepted') accepted.push(clone(other))
        else if (f.addresseeId === state.meId) incoming.push(clone(other))
        else outgoing.push(clone(other))
      }
      return { friends: accepted, incoming, outgoing }
    },

    async searchProfiles(query) {
      const q = query.trim().toLowerCase().replace(/^@/, '')
      if (!q) return []
      return state.profiles
        .filter(p => p.id !== state.meId && (p.handle.includes(q) || (p.displayName ?? '').toLowerCase().includes(q)))
        .slice(0, 10)
        .map(clone)
    },

    async requestFriend(userId) {
      if (userId === state.meId || !state.profiles.some(p => p.id === userId)) throw new RepoError('invalid')
      const existing = state.friendships.find(f => (f.requesterId === userId && f.addresseeId === state.meId) || (f.requesterId === state.meId && f.addresseeId === userId))
      if (existing) {
        if (existing.status === 'pending' && existing.addresseeId === state.meId) existing.status = 'accepted'
      }
      else {
        state.friendships.push({ requesterId: state.meId, addresseeId: userId, status: 'pending' })
      }
      persist()
    },

    async respondFriend(userId, accept) {
      const f = state.friendships.find(x => x.requesterId === userId && x.addresseeId === state.meId && x.status === 'pending')
      if (!f) throw new RepoError('not_found')
      if (accept) f.status = 'accepted'
      else state.friendships = state.friendships.filter(x => x !== f)
      persist()
    },

    async removeFriend(userId) {
      state.friendships = state.friendships.filter(f => !((f.requesterId === userId && f.addresseeId === state.meId) || (f.requesterId === state.meId && f.addresseeId === userId)))
      persist()
    },

    async feed() {
      return state.activities
        .filter((a) => {
          const t = trackById(a.trackId)
          if (!t) return false
          return a.actorId === state.meId || (areFriends(a.actorId, state.meId) && canView(t))
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 50)
        .map((a): FeedItem => {
          const t = trackById(a.trackId)!
          const kudos = state.kudos.filter(k => k.activityId === a.id)
          return {
            id: a.id,
            type: a.type,
            actor: clone(profileOf(a.actorId)),
            track: { id: t.id, title: t.title, emoji: t.emoji, color: t.color },
            milestoneTitle: a.milestoneId ? (findMilestone(a.milestoneId)?.milestone.title ?? null) : null,
            createdAt: a.createdAt,
            kudosCount: kudos.length,
            kudosByMe: kudos.some(k => k.userId === state.meId),
          }
        })
    },

    async setKudos(activityId, on) {
      const a = state.activities.find(x => x.id === activityId)
      const t = a && trackById(a.trackId)
      if (!a || !t || !(a.actorId === state.meId || (areFriends(a.actorId, state.meId) && canView(t)))) throw new RepoError('not_found')
      if (a.actorId === state.meId) throw new RepoError('forbidden')
      const has = state.kudos.some(k => k.activityId === activityId && k.userId === state.meId)
      if (on && !has) state.kudos.push({ activityId, userId: state.meId })
      if (!on && has) state.kudos = state.kudos.filter(k => !(k.activityId === activityId && k.userId === state.meId))
      persist()
    },

    async profile(handle) {
      const p = state.profiles.find(x => x.handle === handle.toLowerCase())
      if (!p) return null
      let friendState: FriendState = 'none'
      if (p.id === state.meId) friendState = 'self'
      else if (areFriends(p.id, state.meId)) friendState = 'friends'
      else {
        const f = state.friendships.find(x => (x.requesterId === p.id && x.addresseeId === state.meId) || (x.requesterId === state.meId && x.addresseeId === p.id))
        if (f) friendState = f.requesterId === state.meId ? 'outgoing' : 'incoming'
      }
      const visible = state.tracks.filter(t => t.ownerId === p.id && canView(t))
      const ms = visible.flatMap(milestonesOf)
      const ids = new Set(ms.map(m => m.id))
      const ev = state.evidences.filter(e => ids.has(e.milestoneId))
      const summaries = visible.map(summary)
      return {
        profile: clone(p),
        friendState,
        completedAt: ms.map(m => m.completedAt).filter((x): x is string => !!x),
        evidenceCount: ev.length,
        certificateCount: ev.filter(e => e.kind === 'certificate').length,
        activeTracks: summaries.filter(s => s.done < s.total).length,
        finishedTracks: summaries.filter(s => s.total > 0 && s.done === s.total).length,
        tracks: summaries,
      } satisfies ProfileDetail
    },
  }
  return repo
}
