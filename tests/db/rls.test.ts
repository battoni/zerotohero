// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDb, createUser, rows, type Db } from './harness'

let db: Db
let ana: string, rafa: string, lu: string, stranger: string

async function makeTrack(owner: string, title: string, visibility: 'private' | 'friends' | 'public') {
  return asUser(db, owner, async (tx) => {
    const [t] = await rows<{ id: string }>(tx, `insert into public.tracks (title, visibility) values ($1, $2) returning id`, [title, visibility])
    const [p] = await rows<{ id: string }>(tx, `insert into public.phases (track_id, title, position) values ($1, 'Base', 0) returning id`, [t!.id])
    await tx.query(`insert into public.milestones (track_id, phase_id, title, position) values ($1, $2, 'First', 0), ($1, $2, 'Second', 1)`, [t!.id, p!.id])
    return t!.id
  })
}

async function visibleTitles(user: string) {
  return asUser(db, user, async tx => (await rows<{ title: string }>(tx, 'select title from public.tracks order by title')).map(r => r.title))
}

beforeAll(async () => {
  db = await createDb()
  ana = await createUser(db, 'ana')
  rafa = await createUser(db, 'rafa')
  lu = await createUser(db, 'luiza')
  stranger = await createUser(db, 'stranger')

  // ana <-> rafa are friends; ana -> lu is only pending.
  await asUser(db, ana, tx => tx.query(`insert into public.friendships (requester_id, addressee_id) values ($1, $2), ($1, $3)`, [ana, rafa, lu]))
  await asUser(db, rafa, tx => tx.query(`update public.friendships set status = 'accepted', responded_at = now() where requester_id = $1`, [ana]))

  await makeTrack(ana, 'Ana private', 'private')
  await makeTrack(ana, 'Ana friends', 'friends')
  await makeTrack(ana, 'Ana public', 'public')
}, 60_000)

describe('profiles', () => {
  it('are created by the signup trigger', async () => {
    const r = await rows<{ handle: string }>(db, 'select handle from public.profiles order by handle')
    expect(r.map(x => x.handle)).toEqual(['ana', 'luiza', 'rafa', 'stranger'])
  })

  it('cannot be updated by someone else', async () => {
    await asUser(db, rafa, tx => tx.query(`update public.profiles set display_name = 'hacked' where id = $1`, [ana]))
    const [p] = await rows<{ display_name: string | null }>(db, 'select display_name from public.profiles where id = $1', [ana])
    expect(p!.display_name).toBeNull()
  })
})

describe('trail visibility', () => {
  it('owner sees everything', async () => {
    expect(await visibleTitles(ana)).toEqual(['Ana friends', 'Ana private', 'Ana public'])
  })

  it('an accepted friend sees friends + public, never private', async () => {
    expect(await visibleTitles(rafa)).toEqual(['Ana friends', 'Ana public'])
  })

  it('a pending friend sees only public', async () => {
    expect(await visibleTitles(lu)).toEqual(['Ana public'])
  })

  it('a stranger sees only public', async () => {
    expect(await visibleTitles(stranger)).toEqual(['Ana public'])
  })

  it('anonymous visitors see nothing', async () => {
    const r = await asUser(db, null, tx => rows(tx, 'select id from public.tracks'))
    expect(r).toHaveLength(0)
  })

  it('milestones follow the trail visibility', async () => {
    const r = await asUser(db, stranger, tx => rows<{ title: string }>(tx, `
      select m.title from public.milestones m join public.tracks t on t.id = m.track_id where t.title = 'Ana private'`))
    expect(r).toHaveLength(0)
  })
})

describe('writes', () => {
  it('nobody edits a trail they do not own', async () => {
    await asUser(db, rafa, tx => tx.query(`update public.tracks set title = 'pwned' where title = 'Ana public'`))
    const r = await rows<{ title: string }>(db, `select title from public.tracks where title = 'pwned'`)
    expect(r).toHaveLength(0)
  })

  it('nobody inserts a milestone into someone else\'s trail', async () => {
    const [t] = await rows<{ id: string, phase: string }>(db, `
      select t.id, p.id as phase from public.tracks t join public.phases p on p.track_id = t.id where t.title = 'Ana public'`)
    await expect(asUser(db, rafa, tx => tx.query(
      `insert into public.milestones (track_id, phase_id, title) values ($1, $2, 'x')`, [t!.id, t!.phase],
    ))).rejects.toThrow(/row-level security/)
  })

  it('nobody creates a trail on behalf of someone else', async () => {
    await expect(asUser(db, rafa, tx => tx.query(
      `insert into public.tracks (owner_id, title) values ($1, 'fake')`, [ana],
    ))).rejects.toThrow(/row-level security/)
  })

  it('a milestone cannot point to a phase of another trail', async () => {
    const other = await makeTrack(ana, 'Ana second', 'private')
    const [p] = await rows<{ id: string }>(db, `select p.id from public.phases p join public.tracks t on t.id = p.track_id where t.title = 'Ana public'`)
    await expect(asUser(db, ana, tx => tx.query(
      `insert into public.milestones (track_id, phase_id, title) values ($1, $2, 'x')`, [other, p!.id],
    ))).rejects.toThrow(/foreign key/)
  })

  it('friendship requests cannot be forged or self-accepted', async () => {
    await expect(asUser(db, stranger, tx => tx.query(
      `insert into public.friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [stranger, ana],
    ))).rejects.toThrow(/row-level security/)
    // lu's request from ana is pending: ana (the requester) cannot accept it.
    await asUser(db, ana, tx => tx.query(`update public.friendships set status = 'accepted' where addressee_id = $1`, [lu]))
    const [f] = await rows<{ status: string }>(db, `select status from public.friendships where addressee_id = $1`, [lu])
    expect(f!.status).toBe('pending')
  })
})

describe('activities and kudos', () => {
  it('completing and un-completing a milestone writes and removes activity', async () => {
    const trackId = await makeTrack(rafa, 'Rafa friends', 'friends')
    await asUser(db, rafa, tx => tx.query(`update public.milestones set completed_at = now() where track_id = $1 and title = 'First'`, [trackId]))
    let types = (await rows<{ type: string }>(db, `select type from public.activities where track_id = $1 order by type`, [trackId])).map(r => r.type)
    expect(types).toEqual(['milestone_completed', 'track_started'])

    await asUser(db, rafa, tx => tx.query(`update public.milestones set completed_at = now() where track_id = $1 and title = 'Second'`, [trackId]))
    types = (await rows<{ type: string }>(db, `select type from public.activities where track_id = $1 order by type`, [trackId])).map(r => r.type)
    expect(types).toEqual(['milestone_completed', 'milestone_completed', 'track_completed', 'track_started'])

    await asUser(db, rafa, tx => tx.query(`update public.milestones set completed_at = null where track_id = $1 and title = 'Second'`, [trackId]))
    types = (await rows<{ type: string }>(db, `select type from public.activities where track_id = $1 order by type`, [trackId])).map(r => r.type)
    expect(types).toEqual(['milestone_completed', 'track_started'])
  })

  it('friends see each other\'s activity; strangers do not', async () => {
    const seenByAna = await asUser(db, ana, tx => rows(tx, `select id from public.activities where actor_id = $1`, [rafa]))
    const seenByStranger = await asUser(db, stranger, tx => rows(tx, `select id from public.activities where actor_id = $1`, [rafa]))
    expect(seenByAna.length).toBeGreaterThan(0)
    expect(seenByStranger).toHaveLength(0)
  })

  it('users cannot write activities directly', async () => {
    const [t] = await rows<{ id: string }>(db, `select id from public.tracks where title = 'Ana public'`)
    await expect(asUser(db, ana, tx => tx.query(
      `insert into public.activities (actor_id, type, track_id) values ($1, 'track_completed', $2)`, [ana, t!.id],
    ))).rejects.toThrow(/row-level security/)
  })

  it('kudos: a friend can cheer, the author cannot cheer themselves, a stranger cannot', async () => {
    const [a] = await rows<{ id: string }>(db, `select id from public.activities where actor_id = $1 and type = 'milestone_completed' limit 1`, [rafa])
    await asUser(db, ana, tx => tx.query(`insert into public.kudos (activity_id, user_id) values ($1, $2)`, [a!.id, ana]))
    await expect(asUser(db, rafa, tx => tx.query(`insert into public.kudos (activity_id, user_id) values ($1, $2)`, [a!.id, rafa])))
      .rejects.toThrow(/row-level security/)
    await expect(asUser(db, stranger, tx => tx.query(`insert into public.kudos (activity_id, user_id) values ($1, $2)`, [a!.id, stranger])))
      .rejects.toThrow(/row-level security/)
    const k = await rows(db, `select * from public.kudos where activity_id = $1`, [a!.id])
    expect(k).toHaveLength(1)
  })
})

describe('copy_track', () => {
  it('copies structure without progress, as private, and counts the copy', async () => {
    const [src] = await rows<{ id: string }>(db, `select id from public.tracks where title = 'Ana public'`)
    await asUser(db, ana, tx => tx.query(`update public.milestones set completed_at = now(), time_spent_minutes = 30 where track_id = $1 and title = 'First'`, [src!.id]))

    const [{ copy_track: copyId }] = await asUser(db, stranger, tx => rows<{ copy_track: string }>(tx, `select public.copy_track($1)`, [src!.id])) as [{ copy_track: string }]
    const [copy] = await rows<{ owner_id: string, visibility: string, source_track_id: string }>(db, `select * from public.tracks where id = $1`, [copyId])
    expect(copy).toMatchObject({ owner_id: stranger, visibility: 'private', source_track_id: src!.id })

    const ms = await rows<{ title: string, completed_at: string | null, time_spent_minutes: number | null }>(db,
      `select title, completed_at, time_spent_minutes from public.milestones where track_id = $1 order by position`, [copyId])
    expect(ms).toEqual([
      { title: 'First', completed_at: null, time_spent_minutes: null },
      { title: 'Second', completed_at: null, time_spent_minutes: null },
    ])
    const [s] = await rows<{ copies_count: number }>(db, `select copies_count from public.tracks where id = $1`, [src!.id])
    expect(s!.copies_count).toBe(1)
  })

  it('refuses to copy a trail the caller cannot see', async () => {
    const [priv] = await rows<{ id: string }>(db, `select id from public.tracks where title = 'Ana private'`)
    await expect(asUser(db, stranger, tx => tx.query(`select public.copy_track($1)`, [priv!.id]))).rejects.toThrow(/not found/)
  })
})

describe('track_progress', () => {
  it('counts totals, completions and the next milestone', async () => {
    // The copy made above has the same title, so filter by owner.
    const [src] = await rows<{ id: string }>(db, `select id from public.tracks where title = 'Ana public' and owner_id = $1`, [ana])
    const [p] = await asUser(db, ana, tx => rows<{ total: number, done: number, next_milestone_title: string }>(tx,
      `select total, done, next_milestone_title from public.track_progress where track_id = $1`, [src!.id]))
    expect(p).toEqual({ total: 2, done: 1, next_milestone_title: 'Second' })
  })

  it('does not leak trails through the view', async () => {
    const r = await asUser(db, stranger, tx => rows(tx, `select p.track_id from public.track_progress p join public.tracks t on t.id = p.track_id where t.title = 'Ana private'`))
    expect(r).toHaveLength(0)
    const all = await asUser(db, stranger, tx => rows<{ track_id: string }>(tx, `select track_id from public.track_progress`))
    const priv = await rows<{ id: string }>(db, `select id from public.tracks where title = 'Ana private'`)
    expect(all.map(x => x.track_id)).not.toContain(priv[0]!.id)
  })
})
