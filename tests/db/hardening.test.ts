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
    expect(await count(partly)).toBe(0)
  })
})
