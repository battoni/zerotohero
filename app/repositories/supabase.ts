// Supabase-backed repository. Row Level Security decides visibility; this file only
// shapes queries and maps rows to domain types. Composite writes go through the
// create_track / update_track / copy_track RPCs so they stay atomic.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~~/shared/types/database'
import type {
  CompleteInput, Evidence, FeedItem, FriendState, Friends, Milestone, Phase, Profile, ProfileDetail,
  Track, TrackDetail, TrackInput, TrackSummary,
} from '~~/shared/types/domain'
import { RepoError, type DataRepository } from './types'

type Client = SupabaseClient<Database>
type Tables = Database['public']['Tables']
type ProfileRow = Tables['profiles']['Row']
type TrackRow = Tables['tracks']['Row']
type MilestoneRow = Tables['milestones']['Row']
type EvidenceRow = Tables['evidences']['Row']
type ProgressRow = Database['public']['Views']['track_progress']['Row']

interface PgError { code?: string, message: string }

function fail(error: PgError | null): void {
  if (!error) return
  if (error.code === '23505') throw new RepoError('handle_taken', error.message)
  if (error.code === '23514' || error.code === '22023' || error.code === '22P02') throw new RepoError('invalid', error.message)
  if (error.code === 'P0002' || error.code === 'PGRST116') throw new RepoError('not_found', error.message)
  if (error.code === '42501') throw new RepoError('forbidden', error.message)
  throw new RepoError('network', error.message)
}

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  handle: r.handle,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  locale: r.locale,
  onboarded: r.onboarded_at !== null,
})

const toTrack = (r: TrackRow): Track => ({
  id: r.id,
  ownerId: r.owner_id,
  title: r.title,
  goal: r.goal,
  emoji: r.emoji,
  color: r.color,
  targetDate: r.target_date,
  visibility: r.visibility,
  sourceTrackId: r.source_track_id,
  copiesCount: r.copies_count,
  createdAt: r.created_at,
})

const toMilestone = (r: MilestoneRow): Milestone => ({
  id: r.id,
  phaseId: r.phase_id,
  title: r.title,
  tag: r.tag,
  position: r.position,
  dueDate: r.due_date,
  completedAt: r.completed_at,
  timeSpentMinutes: r.time_spent_minutes,
  evidenceCount: 0,
})

const toEvidence = (r: EvidenceRow): Evidence => ({
  id: r.id,
  milestoneId: r.milestone_id,
  kind: r.kind,
  url: r.url,
  body: r.body,
  learned: r.learned,
  fileName: r.storage_path ? (r.storage_path.split('/').pop() ?? null)?.replace(/^\d+-/, '') ?? null : null,
  hasFile: r.storage_path !== null,
  createdAt: r.created_at,
})

const toPayload = (input: TrackInput) => ({
  title: input.title.trim(),
  goal: input.goal?.trim() || null,
  emoji: input.emoji,
  color: input.color,
  target_date: input.targetDate,
  visibility: input.visibility,
  phases: input.phases.map(p => ({
    ...(p.id ? { id: p.id } : {}),
    title: p.title.trim(),
    milestones: p.milestones.map(m => ({
      ...(m.id ? { id: m.id } : {}),
      title: m.title.trim(),
      tag: m.tag,
      due_date: m.dueDate,
      ...(m.completedAt ? { completed_at: m.completedAt } : {}),
    })),
  })),
})

/** PostgREST `or()` filters break on commas and parentheses; keep the search literal. */
const safeTerm = (q: string) => q.replace(/[,()*%\\]/g, ' ').trim()

export function createSupabaseRepository(client: Client): DataRepository {
  let cachedUid: string | null = null
  const uid = async (): Promise<string> => {
    if (cachedUid) return cachedUid
    const { data } = await client.auth.getUser()
    if (!data.user) throw new RepoError('forbidden', 'not signed in')
    cachedUid = data.user.id
    return cachedUid
  }
  client.auth.onAuthStateChange(() => {
    cachedUid = null
  })

  const profilesByIds = async (ids: string[]): Promise<Map<string, Profile>> => {
    const unique = [...new Set(ids)]
    if (!unique.length) return new Map()
    const { data, error } = await client.from('profiles').select('*').in('id', unique)
    fail(error)
    return new Map((data ?? []).map(r => [r.id, toProfile(r)]))
  }

  const summaries = async (rows: TrackRow[]): Promise<TrackSummary[]> => {
    if (!rows.length) return []
    const ids = rows.map(r => r.id)
    const [{ data: progress, error }, owners] = await Promise.all([
      client.from('track_progress').select('*').in('track_id', ids),
      profilesByIds(rows.map(r => r.owner_id)),
    ])
    fail(error)
    const byId = new Map((progress ?? []).map((p: ProgressRow) => [p.track_id, p]))
    return rows.map((r) => {
      const p = byId.get(r.id)
      return {
        ...toTrack(r),
        owner: owners.get(r.owner_id)!,
        total: p?.total ?? 0,
        done: p?.done ?? 0,
        nextMilestoneTitle: p?.next_milestone_title ?? null,
        lastCompletedAt: p?.last_completed_at ?? null,
      }
    })
  }

  const friendIds = async (me: string): Promise<string[]> => {
    const { data, error } = await client.from('friendships').select('*').eq('status', 'accepted')
    fail(error)
    return (data ?? []).map(f => (f.requester_id === me ? f.addressee_id : f.requester_id))
  }

  return {
    mode: 'supabase',

    async me() {
      const { data: auth } = await client.auth.getUser()
      if (!auth.user) return null
      const { data, error } = await client.from('profiles').select('*').eq('id', auth.user.id).maybeSingle()
      fail(error)
      return data ? toProfile(data) : null
    },

    async updateProfile(patch) {
      const me = await uid()
      const update: Tables['profiles']['Update'] = {}
      if (patch.handle !== undefined) update.handle = patch.handle.toLowerCase()
      if (patch.displayName !== undefined) update.display_name = patch.displayName?.trim() || null
      if (patch.locale !== undefined) update.locale = patch.locale
      if (patch.onboarded) update.onboarded_at = new Date().toISOString()
      const { data, error } = await client.from('profiles').update(update).eq('id', me).select('*').single()
      fail(error)
      return toProfile(data!)
    },

    async listMyTracks() {
      const me = await uid()
      const { data, error } = await client.from('tracks').select('*')
        .eq('owner_id', me).is('archived_at', null).order('updated_at', { ascending: false })
      fail(error)
      const list = await summaries(data ?? [])
      return list.sort((a, b) => (b.lastCompletedAt ?? b.createdAt).localeCompare(a.lastCompletedAt ?? a.createdAt))
    },

    async getTrack(id) {
      const me = await uid()
      const { data: row, error } = await client.from('tracks').select('*').eq('id', id).maybeSingle()
      fail(error)
      if (!row) return null
      const [[summary], phasesRes, msRes, followsRes] = await Promise.all([
        summaries([row]),
        client.from('phases').select('*').eq('track_id', id).order('position'),
        client.from('milestones').select('*').eq('track_id', id).order('position'),
        client.from('track_follows').select('*').eq('track_id', id),
      ])
      fail(phasesRes.error)
      fail(msRes.error)
      fail(followsRes.error)
      const milestones = (msRes.data ?? []).map(toMilestone)
      const phases: Phase[] = (phasesRes.data ?? []).map(p => ({
        id: p.id,
        title: p.title,
        position: p.position,
        milestones: milestones.filter(m => m.phaseId === p.id),
      }))
      const followerIds = (followsRes.data ?? []).map(f => f.user_id)
      const followers = await profilesByIds(followerIds)

      let recentEvidence: TrackDetail['recentEvidence'] = []
      if (milestones.length) {
        const { data: ev, error: evError } = await client.from('evidences').select('*')
          .in('milestone_id', milestones.map(m => m.id)).order('created_at', { ascending: false })
        fail(evError)
        for (const e of ev ?? []) {
          const m = milestones.find(x => x.id === e.milestone_id)
          if (m) m.evidenceCount += 1
        }
        recentEvidence = (ev ?? []).slice(0, 5).map(e => ({
          ...toEvidence(e),
          milestoneTitle: milestones.find(m => m.id === e.milestone_id)?.title ?? '',
        }))
      }

      return {
        ...summary!,
        phases,
        followers: followerIds.map(fid => followers.get(fid)).filter((p): p is Profile => !!p),
        isFollowing: followerIds.includes(me),
        isOwner: row.owner_id === me,
        recentEvidence,
      }
    },

    async createTrack(input) {
      const { data, error } = await client.rpc('create_track', { payload: toPayload(input) })
      fail(error)
      return data as string
    },

    async updateTrack(id, input) {
      const { error } = await client.rpc('update_track', { p_id: id, payload: toPayload(input) })
      fail(error)
    },

    async deleteTrack(id) {
      const { error } = await client.from('tracks').delete().eq('id', id)
      fail(error)
    },

    async completeMilestone(milestoneId, input?: CompleteInput) {
      const me = await uid()
      const ev = input?.evidence
      // Upload first; the RPC then completes the milestone and records the evidence atomically.
      let storagePath: string | null = null
      if (ev?.file) {
        const safeName = ev.file.name.replace(/[^\w.-]+/g, '_').slice(-80)
        storagePath = `${me}/${milestoneId}/${Date.now()}-${safeName}`
        const { error: upError } = await client.storage.from('evidence').upload(storagePath, ev.file, { contentType: ev.file.type })
        if (upError) throw new RepoError('network', upError.message)
      }
      const { error } = await client.rpc('complete_milestone', {
        p_id: milestoneId,
        p_completed_at: input?.completedAt ?? null,
        p_minutes: input?.timeSpentMinutes ?? null,
        p_evidence: ev
          ? { kind: ev.kind, url: ev.url?.trim() || null, body: ev.body?.trim() || null, learned: ev.learned?.trim() || null, storage_path: storagePath }
          : null,
      })
      if (error && storagePath) await client.storage.from('evidence').remove([storagePath])
      fail(error)
    },

    async reopenMilestone(milestoneId) {
      const { error } = await client.from('milestones')
        .update({ completed_at: null, time_spent_minutes: null }).eq('id', milestoneId)
      fail(error)
      const { data: removed, error: evError } = await client.from('evidences').delete()
        .eq('milestone_id', milestoneId).select('storage_path')
      fail(evError)
      // Best effort: the evidence row is gone either way; a leftover file is only storage.
      const paths = (removed ?? []).map(r => r.storage_path).filter((p): p is string => !!p)
      if (paths.length) await client.storage.from('evidence').remove(paths)
    },

    async setFollowing(trackId, following) {
      const me = await uid()
      if (following) {
        const { error } = await client.from('track_follows').upsert({ user_id: me, track_id: trackId }, { ignoreDuplicates: true })
        fail(error)
      }
      else {
        const { error } = await client.from('track_follows').delete().eq('user_id', me).eq('track_id', trackId)
        fail(error)
      }
    },

    async explore({ search, filter = 'popular' }) {
      const me = await uid()
      let q = client.from('tracks').select('*').in('visibility', ['public', 'friends']).is('archived_at', null)
      const term = search ? safeTerm(search) : ''
      if (term) q = q.or(`title.ilike.%${term}%,goal.ilike.%${term}%`)
      if (filter === 'friends') {
        const ids = await friendIds(me)
        if (!ids.length) return []
        q = q.in('owner_id', ids)
      }
      q = filter === 'recent'
        ? q.order('created_at', { ascending: false })
        : q.order('copies_count', { ascending: false }).order('title')
      const { data, error } = await q.limit(60)
      fail(error)
      return summaries(data ?? [])
    },

    async copyTrack(id) {
      const { data, error } = await client.rpc('copy_track', { source: id })
      fail(error)
      return data as string
    },

    async friends(): Promise<Friends> {
      const me = await uid()
      const { data, error } = await client.from('friendships').select('*')
      fail(error)
      const rows = data ?? []
      const people = await profilesByIds(rows.map(f => (f.requester_id === me ? f.addressee_id : f.requester_id)))
      const other = (f: Tables['friendships']['Row']) => people.get(f.requester_id === me ? f.addressee_id : f.requester_id)
      const pick = (pred: (f: Tables['friendships']['Row']) => boolean) =>
        rows.filter(pred).map(other).filter((p): p is Profile => !!p)
      return {
        friends: pick(f => f.status === 'accepted'),
        incoming: pick(f => f.status === 'pending' && f.addressee_id === me),
        outgoing: pick(f => f.status === 'pending' && f.requester_id === me),
      }
    },

    async searchProfiles(query) {
      const me = await uid()
      const term = safeTerm(query.replace(/^@/, ''))
      if (!term) return []
      const { data, error } = await client.from('profiles').select('*')
        .neq('id', me).or(`handle.ilike.%${term}%,display_name.ilike.%${term}%`).limit(10)
      fail(error)
      return (data ?? []).map(toProfile)
    },

    async requestFriend(userId) {
      const me = await uid()
      const { data: incoming, error } = await client.from('friendships').select('*')
        .eq('requester_id', userId).eq('addressee_id', me).maybeSingle()
      fail(error)
      if (incoming) {
        if (incoming.status === 'pending') {
          const { error: upError } = await client.from('friendships')
            .update({ status: 'accepted', responded_at: new Date().toISOString() })
            .eq('requester_id', userId).eq('addressee_id', me)
          fail(upError)
        }
        return
      }
      const { error: insError } = await client.from('friendships').insert({ requester_id: me, addressee_id: userId })
      if (insError?.code === '23505') return
      fail(insError)
    },

    async respondFriend(userId, accept) {
      const me = await uid()
      if (accept) {
        const { error } = await client.from('friendships')
          .update({ status: 'accepted', responded_at: new Date().toISOString() })
          .eq('requester_id', userId).eq('addressee_id', me)
        fail(error)
      }
      else {
        const { error } = await client.from('friendships').delete().eq('requester_id', userId).eq('addressee_id', me)
        fail(error)
      }
    },

    async removeFriend(userId) {
      const me = await uid()
      const { error } = await client.from('friendships').delete()
        .or(`and(requester_id.eq.${me},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${me})`)
      fail(error)
    },

    async feed() {
      const me = await uid()
      const { data, error } = await client.from('activities').select('*').order('created_at', { ascending: false }).limit(50)
      fail(error)
      const acts = data ?? []
      if (!acts.length) return []
      const trackIds = [...new Set(acts.map(a => a.track_id))]
      const msIds = acts.map(a => a.milestone_id).filter((x): x is string => !!x)
      const [people, tracksRes, msRes, kudosRes] = await Promise.all([
        profilesByIds(acts.map(a => a.actor_id)),
        client.from('tracks').select('id,title,emoji,color').in('id', trackIds),
        msIds.length ? client.from('milestones').select('id,title').in('id', msIds) : Promise.resolve({ data: [], error: null }),
        client.from('kudos').select('*').in('activity_id', acts.map(a => a.id)),
      ])
      fail(tracksRes.error)
      fail(msRes.error)
      fail(kudosRes.error)
      const tracks = new Map((tracksRes.data ?? []).map(t => [t.id, t]))
      const titles = new Map((msRes.data ?? []).map(m => [m.id, m.title]))
      const kudos = kudosRes.data ?? []
      return acts.flatMap((a): FeedItem[] => {
        const t = tracks.get(a.track_id)
        const actor = people.get(a.actor_id)
        if (!t || !actor) return []
        const mine = kudos.filter(k => k.activity_id === a.id)
        return [{
          id: a.id,
          type: a.type,
          actor,
          track: { id: t.id, title: t.title, emoji: t.emoji, color: t.color },
          milestoneTitle: a.milestone_id ? (titles.get(a.milestone_id) ?? null) : null,
          createdAt: a.created_at,
          kudosCount: mine.length,
          kudosByMe: mine.some(k => k.user_id === me),
        }]
      })
    },

    async setKudos(activityId, on) {
      const me = await uid()
      if (on) {
        const { error } = await client.from('kudos').insert({ activity_id: activityId, user_id: me })
        if (error?.code === '23505') return
        fail(error)
      }
      else {
        const { error } = await client.from('kudos').delete().eq('activity_id', activityId).eq('user_id', me)
        fail(error)
      }
    },

    async profile(handle) {
      const me = await uid()
      const { data: row, error } = await client.from('profiles').select('*').eq('handle', handle.toLowerCase()).maybeSingle()
      fail(error)
      if (!row) return null
      let friendState: FriendState = 'none'
      if (row.id === me) {
        friendState = 'self'
      }
      else {
        const { data: f, error: fError } = await client.from('friendships').select('*')
          .or(`and(requester_id.eq.${me},addressee_id.eq.${row.id}),and(requester_id.eq.${row.id},addressee_id.eq.${me})`)
          .maybeSingle()
        fail(fError)
        if (f) friendState = f.status === 'accepted' ? 'friends' : f.requester_id === me ? 'outgoing' : 'incoming'
      }
      const { data: trackRows, error: tError } = await client.from('tracks').select('*')
        .eq('owner_id', row.id).is('archived_at', null).order('updated_at', { ascending: false })
      fail(tError)
      const tracks = await summaries(trackRows ?? [])
      const ids = tracks.map(t => t.id)
      let completedAt: string[] = []
      let evidenceCount = 0
      let certificateCount = 0
      if (ids.length) {
        const { data: ms, error: mError } = await client.from('milestones').select('id,completed_at')
          .in('track_id', ids).not('completed_at', 'is', null)
        fail(mError)
        completedAt = (ms ?? []).map(m => m.completed_at!).filter(Boolean)
        const msIds = (ms ?? []).map(m => m.id)
        if (msIds.length) {
          const { data: ev, error: eError } = await client.from('evidences').select('kind').in('milestone_id', msIds)
          fail(eError)
          evidenceCount = ev?.length ?? 0
          certificateCount = (ev ?? []).filter(e => e.kind === 'certificate').length
        }
      }
      return {
        profile: toProfile(row),
        friendState,
        completedAt,
        evidenceCount,
        certificateCount,
        activeTracks: tracks.filter(t => t.done < t.total).length,
        finishedTracks: tracks.filter(t => t.total > 0 && t.done === t.total).length,
        tracks,
      } satisfies ProfileDetail
    },
  }
}
