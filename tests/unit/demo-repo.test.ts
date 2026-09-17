import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoRepository, DEMO_ME } from '../../app/repositories/demo'
import type { TrackInput } from '../../shared/types/domain'

const dir = join(__dirname, '..', '..', 'seed', 'demo')
const files = Object.fromEntries(readdirSync(dir).map(f => [f, readFileSync(join(dir, f), 'utf8')]))
const NOW = new Date('2026-09-17T12:00:00Z')

let repo: ReturnType<typeof createDemoRepository>

const input: TrackInput = {
  title: 'Rust basics',
  goal: 'Ownership without tears',
  emoji: '🦀',
  color: 'coral',
  targetDate: null,
  visibility: 'friends',
  phases: [
    { title: 'Start', milestones: [{ title: 'The book, ch. 1–4', tag: 'study', dueDate: null }, { title: 'Hello cargo', tag: null, dueDate: '2026-10-01' }] },
  ],
}

beforeEach(() => {
  repo = createDemoRepository({ files, now: () => NOW })
})

describe('demo seed', () => {
  it('loads everyone and their trails, dated up to yesterday', async () => {
    const mine = await repo.listMyTracks()
    expect(mine.map(t => t.title).sort()).toEqual(['My first portfolio', 'Python foundations'])
    const explore = await repo.explore({})
    expect(explore[0]!.title).toBe('Technical English')
    const latest = explore.map(t => t.lastCompletedAt).filter(Boolean).sort().at(-1)!
    expect(new Date(latest).getTime()).toBeLessThanOrEqual(NOW.getTime())
    expect(new Date(latest).getTime()).toBeGreaterThan(NOW.getTime() - 2 * 86_400_000)
  })

  it('has a lively feed and a pending request', async () => {
    const feed = await repo.feed()
    expect(feed.length).toBeGreaterThan(10)
    expect(feed.some(f => f.type === 'track_completed' && f.actor.handle === 'rafa' && f.kudosByMe)).toBe(true)
    const friends = await repo.friends()
    expect(friends.friends.map(f => f.handle).sort()).toEqual(['ana', 'luiza', 'rafa'])
    expect(friends.incoming.map(f => f.handle)).toEqual(['bruno'])
  })
})

describe('trails', () => {
  it('creates and reads a trail with progress', async () => {
    const id = await repo.createTrack(input)
    const t = (await repo.getTrack(id))!
    expect(t).toMatchObject({ title: 'Rust basics', total: 2, done: 0, nextMilestoneTitle: 'The book, ch. 1–4', isOwner: true })
    expect(t.phases[0]!.milestones.map(m => m.title)).toEqual(['The book, ch. 1–4', 'Hello cargo'])
  })

  it('rejects invalid input', async () => {
    await expect(repo.createTrack({ ...input, title: '  ' })).rejects.toMatchObject({ code: 'invalid' })
    await expect(repo.createTrack({ ...input, phases: [] })).rejects.toMatchObject({ code: 'invalid' })
  })

  it('completes with evidence, writes activity, and reopens cleanly', async () => {
    const id = await repo.createTrack(input)
    const t = (await repo.getTrack(id))!
    const [first, second] = t.phases[0]!.milestones
    await repo.completeMilestone(first!.id, { timeSpentMinutes: 90, evidence: { kind: 'link', url: 'https://example.com', learned: 'Borrowing' } })
    let after = (await repo.getTrack(id))!
    expect(after).toMatchObject({ done: 1, nextMilestoneTitle: 'Hello cargo' })
    expect(after.recentEvidence[0]).toMatchObject({ kind: 'link', url: 'https://example.com', milestoneTitle: 'The book, ch. 1–4' })

    await repo.completeMilestone(second!.id)
    let feed = await repo.feed()
    expect(feed.filter(f => f.track.id === id).map(f => f.type).sort()).toEqual(['milestone_completed', 'milestone_completed', 'track_completed', 'track_started'])

    await repo.reopenMilestone(first!.id)
    after = (await repo.getTrack(id))!
    expect(after.done).toBe(1)
    expect(after.recentEvidence).toHaveLength(0)
    feed = await repo.feed()
    expect(feed.filter(f => f.track.id === id).map(f => f.type).sort()).toEqual(['milestone_completed', 'track_started'])
  })

  it('keeps a single, current track_completed', async () => {
    const doneAt = '2026-09-10T10:00:00.000Z'
    const done = { ...input, phases: [{ title: 'P', milestones: [{ title: 'a', tag: null, dueDate: null, completedAt: doneAt }, { title: 'b', tag: null, dueDate: null, completedAt: doneAt }] }] }
    const id = await repo.createTrack(done)
    const completedEvents = async () => (await repo.feed()).filter(f => f.track.id === id && f.type === 'track_completed')
    expect(await completedEvents()).toHaveLength(1)

    const t = (await repo.getTrack(id))!
    const kept = t.phases[0]!.milestones.map(m => ({ id: m.id, title: m.title, tag: null, dueDate: null }))
    await repo.updateTrack(id, { ...done, phases: [{ id: t.phases[0]!.id, title: 'P', milestones: [...kept, { title: 'c', tag: null, dueDate: null }] }] })
    expect(await completedEvents()).toHaveLength(0)
    await repo.updateTrack(id, { ...done, phases: [{ id: t.phases[0]!.id, title: 'P', milestones: kept }] })
    expect(await completedEvents()).toHaveLength(1)

    // A later completed milestone moves the event forward instead of adding one.
    const later = '2026-09-12T10:00:00.000Z'
    await repo.updateTrack(id, { ...done, phases: [{ id: t.phases[0]!.id, title: 'P', milestones: [...kept, { title: 'd', tag: null, dueDate: null, completedAt: later }] }] })
    const events = await completedEvents()
    expect(events.map(e => e.createdAt)).toEqual([later])
  })

  it('rejects completion dates in the future', async () => {
    const future = { ...input, phases: [{ title: 'P', milestones: [{ title: 'a', tag: null, dueDate: null, completedAt: '2026-12-01T00:00:00.000Z' }] }] }
    await expect(repo.createTrack(future)).rejects.toMatchObject({ code: 'invalid', message: 'completed_at' })
  })

  it('rejects invalid minutes', async () => {
    const id = await repo.createTrack(input)
    const m = (await repo.getTrack(id))!.phases[0]!.milestones[0]!
    await expect(repo.completeMilestone(m.id, { timeSpentMinutes: -5 })).rejects.toMatchObject({ code: 'invalid' })
    await expect(repo.completeMilestone(m.id, { timeSpentMinutes: 7.5 })).rejects.toMatchObject({ code: 'invalid' })
    await repo.completeMilestone(m.id, { timeSpentMinutes: 0 })
    expect((await repo.getTrack(id))!.done).toBe(1)
  })

  it('cannot complete someone else\'s milestone', async () => {
    const ana = (await repo.explore({ search: 'technical' }))[0]!
    const detail = (await repo.getTrack(ana.id))!
    const open = detail.phases.flatMap(p => p.milestones).find(m => !m.completedAt)!
    await expect(repo.completeMilestone(open.id)).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('updates structure, keeps completion of kept milestones and drops removed ones', async () => {
    const id = await repo.createTrack(input)
    const t = (await repo.getTrack(id))!
    const [first, second] = t.phases[0]!.milestones
    await repo.completeMilestone(first!.id)
    await repo.updateTrack(id, {
      ...input,
      title: 'Rust',
      phases: [
        { title: 'New first phase', milestones: [{ title: 'Install rustup', tag: null, dueDate: null }] },
        { id: t.phases[0]!.id, title: 'Start', milestones: [{ id: first!.id, title: 'The book', tag: 'study', dueDate: null }] },
      ],
    })
    const after = (await repo.getTrack(id))!
    expect(after.title).toBe('Rust')
    expect(after.phases.map(p => p.title)).toEqual(['New first phase', 'Start'])
    expect(after.phases[1]!.milestones[0]).toMatchObject({ id: first!.id, title: 'The book' })
    expect(after.phases[1]!.milestones[0]!.completedAt).not.toBeNull()
    expect(after.phases.flatMap(p => p.milestones).some(m => m.id === second!.id)).toBe(false)
    await expect(repo.updateTrack(id, { ...input, phases: [{ id: 'nope', title: 'x', milestones: [] }] })).rejects.toMatchObject({ code: 'invalid' })
  })

  it('copies a template without progress and counts the copy', async () => {
    const [src] = await repo.explore({ search: 'aws' })
    const before = src!.copiesCount
    const copyId = await repo.copyTrack(src!.id)
    const copy = (await repo.getTrack(copyId))!
    expect(copy).toMatchObject({ ownerId: DEMO_ME, visibility: 'private', sourceTrackId: src!.id, done: 0, total: src!.total })
    expect((await repo.explore({ search: 'aws' }))[0]!.copiesCount).toBe(before + 1)
    await repo.copyTrack(src!.id)
    expect((await repo.explore({ search: 'aws' }))[0]!.copiesCount).toBe(before + 1)
  })

  it('hides private trails and friends-only trails from non-friends', async () => {
    // Alex's Python trail is friends-only; Ana is a friend, Carla is not.
    const detail = await repo.profile('carla')
    expect(detail?.friendState).toBe('none')
    const python = (await repo.listMyTracks()).find(t => t.title === 'Python foundations')!
    expect(python.visibility).toBe('friends')
    const pub = await repo.explore({ search: 'python' })
    expect(pub.map(t => t.id)).toContain(python.id) // visible to the owner
    await repo.updateTrack(python.id, {
      ...input, title: python.title, visibility: 'private',
      phases: [{ title: 'x', milestones: [] }],
    })
    expect((await repo.explore({ search: 'python' })).map(t => t.id)).not.toContain(python.id)
  })

  it('deletes a trail and its activity', async () => {
    const id = await repo.createTrack({ ...input, phases: [{ title: 'P', milestones: [{ title: 'done', tag: null, dueDate: null, completedAt: NOW.toISOString() }] }] })
    expect((await repo.feed()).some(f => f.track.id === id)).toBe(true)
    await repo.deleteTrack(id)
    expect(await repo.getTrack(id)).toBeNull()
    expect((await repo.feed()).some(f => f.track.id === id)).toBe(false)
  })
})

describe('social', () => {
  it('handles friend requests both ways', async () => {
    const [carla] = await repo.searchProfiles('@car')
    await repo.requestFriend(carla!.id)
    expect((await repo.friends()).outgoing.map(f => f.handle)).toEqual(['carla'])
    expect((await repo.profile('carla'))!.friendState).toBe('outgoing')

    const bruno = (await repo.friends()).incoming[0]!
    await repo.respondFriend(bruno.id, true)
    expect((await repo.friends()).friends.map(f => f.handle)).toContain('bruno')
    await repo.removeFriend(bruno.id)
    expect((await repo.friends()).friends.map(f => f.handle)).not.toContain('bruno')
  })

  it('cancels only a pending request I sent', async () => {
    const [carla] = await repo.searchProfiles('@car')
    await repo.requestFriend(carla!.id)
    await repo.cancelRequest(carla!.id)
    expect((await repo.friends()).outgoing).toHaveLength(0)
    const ana = (await repo.friends()).friends.find(f => f.handle === 'ana')!
    await expect(repo.cancelRequest(ana.id)).rejects.toMatchObject({ code: 'not_found' })
    expect((await repo.friends()).friends.map(f => f.handle)).toContain('ana')
  })

  it('cheers a friend but not yourself', async () => {
    const feed = await repo.feed()
    const anas = feed.find(f => f.actor.handle === 'ana' && f.type === 'milestone_completed' && !f.kudosByMe)!
    await repo.setKudos(anas.id, true)
    expect((await repo.feed()).find(f => f.id === anas.id)).toMatchObject({ kudosByMe: true, kudosCount: anas.kudosCount + 1 })
    const mine = feed.find(f => f.actor.id === DEMO_ME)!
    await expect(repo.setKudos(mine.id, true)).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('follows and unfollows a visible trail', async () => {
    const [src] = await repo.explore({ search: 'vue' })
    await repo.setFollowing(src!.id, true)
    expect((await repo.getTrack(src!.id))!.isFollowing).toBe(true)
    await repo.setFollowing(src!.id, false)
    expect((await repo.getTrack(src!.id))!.isFollowing).toBe(false)
  })

  it('validates and saves the profile', async () => {
    await expect(repo.updateProfile({ handle: 'ana' })).rejects.toMatchObject({ code: 'handle_taken' })
    await expect(repo.updateProfile({ handle: 'no' })).rejects.toMatchObject({ code: 'invalid' })
    const p = await repo.updateProfile({ handle: 'Alex_Dev', displayName: '  Alex D  ', locale: 'pt-BR' })
    expect(p).toMatchObject({ handle: 'alex_dev', displayName: 'Alex D', locale: 'pt-BR' })
  })

  it('builds a profile with stats', async () => {
    const p = (await repo.profile('rafa'))!
    expect(p).toMatchObject({ friendState: 'friends', finishedTracks: 1, activeTracks: 0 })
    expect(p.completedAt.length).toBe(14)
  })

  it('persists through the storage adapter', async () => {
    let saved: unknown = null
    const storage = { load: () => saved as never, save: (s: unknown) => { saved = JSON.parse(JSON.stringify(s)) } }
    const a = createDemoRepository({ files, now: () => NOW, storage })
    const id = await a.createTrack(input)
    const b = createDemoRepository({ files, now: () => NOW, storage })
    expect(await b.getTrack(id)).not.toBeNull()
    b.reset()
    const c = createDemoRepository({ files, now: () => NOW, storage })
    expect(await c.getTrack(id)).toBeNull()
  })
})
