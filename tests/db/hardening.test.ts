// @vitest-environment node
// Regression tests for the findings of the impartial review (2026-09-17).
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDb, createUser, rows, type Db } from './harness'

let db: Db
let victim: string, attacker: string, sock: string, stranger: string
let victimPublic: string, victimFriends: string, victimMilestone: string, attackerMilestone: string

async function trail(owner: string, title: string, visibility: string) {
  return asUser(db, owner, async (tx) => {
    const [r] = await rows<{ create_track: string }>(tx, 'select public.create_track($1)', [JSON.stringify({
      title, visibility, phases: [{ title: 'P', milestones: [{ title: 'M1' }, { title: 'M2' }] }],
    })])
    return r!.create_track
  })
}

const firstMilestone = async (trackId: string) =>
  (await rows<{ id: string }>(db, 'select id from public.milestones where track_id = $1 order by position limit 1', [trackId]))[0]!.id

beforeAll(async () => {
  db = await createDb()
  victim = await createUser(db, 'victim')
  attacker = await createUser(db, 'attacker')
  sock = await createUser(db, 'sock')
  stranger = await createUser(db, 'stranger')
  victimPublic = await trail(victim, 'Victim public', 'public')
  victimFriends = await trail(victim, 'Victim friends', 'friends')
  victimMilestone = await firstMilestone(victimPublic)
  attackerMilestone = await firstMilestone(await trail(attacker, 'Attacker', 'private'))
}, 60_000)

describe('friendship forgery (finding 1)', () => {
  it('the addressee cannot rewrite the requester', async () => {
    await asUser(db, sock, tx => tx.query('insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [sock, attacker]))
    await expect(asUser(db, attacker, tx => tx.query(
      `update public.friendships set requester_id = $1, status = 'accepted' where requester_id = $2 and addressee_id = $3`,
      [victim, sock, attacker],
    ))).rejects.toThrow(/cannot change/)
    const titles = await asUser(db, attacker, tx => rows<{ title: string }>(tx, 'select title from public.tracks where owner_id = $1', [victim]))
    expect(titles.map(t => t.title)).not.toContain('Victim friends')
    expect(victimFriends).toBeTruthy()
  })

  it('an accepted friendship cannot be flipped back to pending', async () => {
    await asUser(db, attacker, tx => tx.query(`update public.friendships set status = 'accepted' where requester_id = $1`, [sock]))
    await expect(asUser(db, attacker, tx => tx.query(`update public.friendships set status = 'pending' where requester_id = $1`, [sock])))
      .rejects.toThrow(/only be removed/)
  })
})

describe('evidence tampering (findings 2 and 3)', () => {
  it('evidence cannot be moved onto someone else\'s milestone', async () => {
    const [e] = await asUser(db, attacker, tx => rows<{ id: string }>(tx,
      `insert into public.evidences (milestone_id, kind, url) values ($1, 'link', 'https://evil.example') returning id`, [attackerMilestone]))
    await expect(asUser(db, attacker, tx => tx.query('update public.evidences set milestone_id = $1 where id = $2', [victimMilestone, e!.id])))
      .rejects.toThrow(/row-level security/)
  })

  it('only http(s) links are stored', async () => {
    await expect(asUser(db, attacker, tx => tx.query(
      `insert into public.evidences (milestone_id, kind, url) values ($1, 'link', 'javascript:alert(1)')`, [attackerMilestone],
    ))).rejects.toThrow(/evidence_url_scheme/)
  })

  it('a file path must sit in the owner\'s folder for that milestone', async () => {
    await expect(asUser(db, attacker, tx => tx.query(
      `insert into public.evidences (milestone_id, kind, storage_path) values ($1, 'file', $2)`,
      [attackerMilestone, `${victim}/${victimMilestone}/secret.pdf`],
    ))).rejects.toThrow(/evidence_storage_path_scope/)
    await asUser(db, attacker, tx => tx.query(
      `insert into public.evidences (milestone_id, kind, storage_path) values ($1, 'file', $2)`,
      [attackerMilestone, `${attacker}/${attackerMilestone}/1-mine.pdf`],
    ))
  })
})

describe('helper functions (finding 4)', () => {
  it('are_friends answers only about pairs that include the caller', async () => {
    const [r] = await asUser(db, stranger, tx => rows<{ are_friends: boolean }>(tx, 'select public.are_friends($1, $2)', [sock, attacker]))
    expect(r!.are_friends).toBe(false)
    const [own] = await asUser(db, attacker, tx => rows<{ are_friends: boolean }>(tx, 'select public.are_friends($1, $2)', [sock, attacker]))
    expect(own!.are_friends).toBe(true)
  })

  it('anonymous callers cannot execute the helpers', async () => {
    await expect(asUser(db, null, tx => tx.query('select public.can_view_track($1)', [victimPublic]))).rejects.toThrow(/permission denied/)
  })
})

describe('forged counters and dates (finding 5)', () => {
  it('copies_count and source_track_id are ignored from clients', async () => {
    const [t] = await asUser(db, attacker, tx => rows<{ id: string, copies_count: number, source_track_id: string | null }>(tx,
      `insert into public.tracks (title, visibility, copies_count, source_track_id) values ('Fake', 'public', 999999, $1) returning id, copies_count, source_track_id`,
      [victimPublic]))
    expect(t).toMatchObject({ copies_count: 0, source_track_id: null })
    await asUser(db, attacker, tx => tx.query('update public.tracks set copies_count = 5000 where id = $1', [t!.id]))
    const [after] = await rows<{ copies_count: number }>(db, 'select copies_count from public.tracks where id = $1', [t!.id])
    expect(after!.copies_count).toBe(0)
  })

  it('copy_track still counts copies', async () => {
    await asUser(db, stranger, tx => tx.query('select public.copy_track($1)', [victimPublic]))
    const [s] = await rows<{ copies_count: number }>(db, 'select copies_count from public.tracks where id = $1', [victimPublic])
    expect(s!.copies_count).toBe(1)
  })

  it('completion dates cannot be in the future', async () => {
    await expect(asUser(db, attacker, tx => tx.query(
      `update public.milestones set completed_at = '2099-01-01' where id = $1`, [attackerMilestone],
    ))).rejects.toThrow(/future/)
  })
})

describe('complete_milestone (finding 6)', () => {
  it('completes and attaches evidence atomically', async () => {
    const t = await trail(attacker, 'Atomic', 'private')
    const m = await firstMilestone(t)
    // A too-long note fails the evidence check, so the milestone must stay open.
    await expect(asUser(db, attacker, tx => tx.query('select public.complete_milestone($1, null, 30, $2)', [m, JSON.stringify({ kind: 'note', body: 'x'.repeat(5000) })])))
      .rejects.toThrow(/check constraint/)
    const [open] = await rows<{ completed_at: string | null }>(db, 'select completed_at from public.milestones where id = $1', [m])
    expect(open!.completed_at).toBeNull()

    const [ok] = await asUser(db, attacker, tx => rows<{ complete_milestone: boolean }>(tx,
      'select public.complete_milestone($1, null, 30, $2)', [m, JSON.stringify({ kind: 'link', url: 'https://ok.example' })]))
    expect(ok!.complete_milestone).toBe(true)
    const ev = await rows(db, 'select kind, url from public.evidences where milestone_id = $1', [m])
    expect(ev).toEqual([{ kind: 'link', url: 'https://ok.example' }])
    const [again] = await asUser(db, attacker, tx => rows<{ complete_milestone: boolean }>(tx, 'select public.complete_milestone($1, null, null, null)', [m]))
    expect(again!.complete_milestone).toBe(false)
  })

  it('cannot complete someone else\'s milestone', async () => {
    await expect(asUser(db, attacker, tx => tx.query('select public.complete_milestone($1, null, null, null)', [victimMilestone])))
      .rejects.toThrow(/not found/)
  })
})

describe('trails created already done (finding 8)', () => {
  it('record track_completed once, and not for partly done trails', async () => {
    const done = await asUser(db, attacker, async (tx) => {
      const [r] = await rows<{ create_track: string }>(tx, 'select public.create_track($1)', [JSON.stringify({
        title: 'All done', phases: [{ title: 'P', milestones: [{ title: 'a', completed_at: '2026-09-01T10:00:00Z' }, { title: 'b', completed_at: '2026-09-02T10:00:00Z' }] }],
      })])
      return r!.create_track
    })
    const partly = await asUser(db, attacker, async (tx) => {
      const [r] = await rows<{ create_track: string }>(tx, 'select public.create_track($1)', [JSON.stringify({
        title: 'Partly', phases: [{ title: 'P', milestones: [{ title: 'a', completed_at: '2026-09-01T10:00:00Z' }, { title: 'b' }] }],
      })])
      return r!.create_track
    })
    const count = async (id: string) => (await rows(db, `select id from public.activities where track_id = $1 and type = 'track_completed'`, [id])).length
    expect(await count(done)).toBe(1)
    const [ev] = await rows<{ created_at: Date }>(db, `select created_at from public.activities where track_id = $1 and type = 'track_completed'`, [done])
    expect(new Date(ev!.created_at).toISOString()).toBe('2026-09-02T10:00:00.000Z')
    expect(await count(partly)).toBe(0)
  })
})

describe('track_completed stays consistent (third review, finding 2)', () => {
  const count = async (id: string, type = 'track_completed') =>
    (await rows(db, 'select id from public.activities where track_id = $1 and type = $2', [id, type])).length
  const create = (milestones: object[]) => asUser(db, attacker, async (tx) => {
    const [r] = await rows<{ create_track: string }>(tx, 'select public.create_track($1)', [JSON.stringify({ title: 'Sync', phases: [{ title: 'P', milestones }] })])
    return r!.create_track
  })
  const msOf = (id: string) => rows<{ id: string, title: string, completed_at: string | null }>(db, 'select id, title, completed_at from public.milestones where track_id = $1 order by position', [id])

  it('adding an open milestone to a done trail withdraws the completion; removing it restores one', async () => {
    const id = await create([{ title: 'a', completed_at: '2026-09-01T10:00:00Z' }])
    expect(await count(id)).toBe(1)
    const [a] = await msOf(id)
    const phase = (await rows<{ id: string }>(db, 'select id from public.phases where track_id = $1', [id]))[0]!.id
    const withOpen = { title: 'Sync', phases: [{ id: phase, title: 'P', milestones: [{ id: a!.id, title: 'a', completed_at: a!.completed_at }, { title: 'b' }] }] }
    await asUser(db, attacker, tx => tx.query('select public.update_track($1, $2)', [id, JSON.stringify(withOpen)]))
    expect(await count(id)).toBe(0)
    const onlyDone = { title: 'Sync', phases: [{ id: phase, title: 'P', milestones: [{ id: a!.id, title: 'a', completed_at: a!.completed_at }] }] }
    await asUser(db, attacker, tx => tx.query('select public.update_track($1, $2)', [id, JSON.stringify(onlyDone)]))
    expect(await count(id)).toBe(1)
  })

  it('completing the last milestone twice over never duplicates the event', async () => {
    const id = await create([{ title: 'a' }])
    const [a] = await msOf(id)
    await asUser(db, attacker, tx => tx.query('select public.complete_milestone($1, null, null, null)', [a!.id]))
    await asUser(db, attacker, tx => tx.query('select public.reopen_milestone($1)', [a!.id]))
    await asUser(db, attacker, tx => tx.query('select public.complete_milestone($1, null, null, null)', [a!.id]))
    expect(await count(id)).toBe(1)
    await asUser(db, attacker, tx => tx.query('select public.reopen_milestone($1)', [a!.id]))
    expect(await count(id)).toBe(0)
  })

  it('deleting a trail still works (cascade skips the sync)', async () => {
    const id = await create([{ title: 'a', completed_at: '2026-09-01T10:00:00Z' }])
    await asUser(db, attacker, tx => tx.query('delete from public.tracks where id = $1', [id]))
    expect(await rows(db, 'select id from public.tracks where id = $1', [id])).toHaveLength(0)
  })
})

describe('unfollow (third review, finding 6)', () => {
  it('removes the follow event from the feed', async () => {
    await asUser(db, stranger, tx => tx.query('insert into public.track_follows (user_id, track_id) values ($1, $2)', [stranger, victimPublic]))
    const events = () => rows(db, `select id from public.activities where actor_id = $1 and type = 'track_followed'`, [stranger])
    expect(await events()).toHaveLength(1)
    await asUser(db, stranger, tx => tx.query('delete from public.track_follows where user_id = $1 and track_id = $2', [stranger, victimPublic]))
    expect(await events()).toHaveLength(0)
  })
})

describe('reopen_milestone (fourth review, finding 3)', () => {
  it('reopens, drops evidence and returns the file paths, atomically', async () => {
    const [{ create_track: id }] = await asUser(db, attacker, tx => rows<{ create_track: string }>(tx, 'select public.create_track($1)', [JSON.stringify({
      title: 'Reopen', phases: [{ title: 'P', milestones: [{ title: 'a' }] }],
    })])) as [{ create_track: string }]
    const m = (await rows<{ id: string }>(db, 'select id from public.milestones where track_id = $1', [id]))[0]!.id
    const path = `${attacker}/${m}/cert.pdf`
    await asUser(db, attacker, tx => tx.query('select public.complete_milestone($1, null, 30, $2)', [m, JSON.stringify({ kind: 'certificate', storage_path: path })]))
    const [r] = await asUser(db, attacker, tx => rows<{ reopen_milestone: string[] }>(tx, 'select public.reopen_milestone($1)', [m]))
    expect(r!.reopen_milestone).toEqual([path])
    const [row] = await rows<{ completed_at: string | null, time_spent_minutes: number | null }>(db, 'select completed_at, time_spent_minutes from public.milestones where id = $1', [m])
    expect(row).toEqual({ completed_at: null, time_spent_minutes: null })
    expect(await rows(db, 'select id from public.evidences where milestone_id = $1', [m])).toHaveLength(0)
  })

  it('fails for someone else\'s milestone instead of doing nothing', async () => {
    await expect(asUser(db, stranger, tx => tx.query('select public.reopen_milestone($1)', [victimMilestone])))
      .rejects.toThrow(/not found/)
  })
})

describe('ninth review', () => {
  it('rejects storage paths with dot segments or extra folders', async () => {
    const [{ create_track: id }] = await asUser(db, attacker, tx => rows<{ create_track: string }>(tx, 'select public.create_track($1)', [JSON.stringify({
      title: 'Paths', phases: [{ title: 'P', milestones: [{ title: 'a' }, { title: 'b' }] }],
    })])) as [{ create_track: string }]
    const [a, b] = await rows<{ id: string }>(db, 'select id from public.milestones where track_id = $1 order by position', [id])
    const evil = `${attacker}/${a!.id}/../../${victim}/${victimMilestone}/secret.pdf`
    await expect(asUser(db, attacker, tx => tx.query('select public.complete_milestone($1, null, null, $2)', [a!.id, JSON.stringify({ kind: 'file', storage_path: evil })])))
      .rejects.toThrow(/evidence_storage_path_scope/)
    await expect(asUser(db, attacker, tx => tx.query('select public.complete_milestone($1, null, null, $2)', [a!.id, JSON.stringify({ kind: 'file', storage_path: `${attacker}/${a!.id}/x/y.pdf` })])))
      .rejects.toThrow(/evidence_storage_path_scope/)
    await asUser(db, attacker, tx => tx.query('select public.complete_milestone($1, null, null, $2)', [b!.id, JSON.stringify({ kind: 'file', storage_path: `${attacker}/${b!.id}/1726540000-cert.v2.pdf` })]))
  })

  it('caps a trail at 200 milestones', async () => {
    const milestones = Array.from({ length: 201 }, (_, i) => ({ title: `m${i}` }))
    await expect(asUser(db, attacker, tx => tx.query('select public.create_track($1)', [JSON.stringify({ title: 'Huge', phases: [{ title: 'P', milestones }] })])))
      .rejects.toThrow(/at most 200 milestones/)
  })

  it('counts one use per person, however many copies they make', async () => {
    const before = (await rows<{ copies_count: number }>(db, 'select copies_count from public.tracks where id = $1', [victimPublic]))[0]!.copies_count
    const copier = await createUser(db, 'copier')
    for (let i = 0; i < 3; i++) await asUser(db, copier, tx => tx.query('select public.copy_track($1)', [victimPublic]))
    const [after] = await rows<{ copies_count: number }>(db, 'select copies_count from public.tracks where id = $1', [victimPublic])
    expect(after!.copies_count).toBe(before + 1)
  })

  it('keeps internal functions out of reach of API roles', async () => {
    await expect(asUser(db, attacker, tx => tx.query('select public.sync_track_completed($1)', [victimPublic]))).rejects.toThrow(/permission denied/)
    const [anonCan] = await rows<{ can: boolean }>(db, `select has_function_privilege('anon', 'public.reopen_milestone(uuid)', 'execute') as can`)
    expect(anonCan!.can).toBe(false)
  })
})
