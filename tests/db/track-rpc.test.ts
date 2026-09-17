// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDb, createUser, rows, type Db } from './harness'

let db: Db
let ana: string, rafa: string

const payload = {
  title: 'Python',
  goal: 'Learn it well',
  emoji: '🐍',
  color: 'mint',
  target_date: '2026-12-01',
  visibility: 'public',
  phases: [
    { title: 'Basics', milestones: [{ title: 'Syntax', tag: 'study' }, { title: 'Types', completed_at: '2026-09-10T10:00:00Z' }] },
    { title: 'Projects', milestones: [{ title: 'CLI tool', due_date: '2026-10-01' }] },
  ],
}

async function structure(trackId: string) {
  return rows<{ phase: string, ppos: number, title: string, mpos: number, tag: string | null, done: boolean }>(db, `
    select p.title as phase, p.position as ppos, m.title, m.position as mpos, m.tag, m.completed_at is not null as done
    from public.phases p left join public.milestones m on m.phase_id = p.id
    where p.track_id = $1 order by p.position, m.position`, [trackId])
}

beforeAll(async () => {
  db = await createDb()
  ana = await createUser(db, 'ana')
  rafa = await createUser(db, 'rafa')
}, 60_000)

describe('create_track', () => {
  it('creates a trail with ordered phases and milestones in one call', async () => {
    const [{ create_track: id }] = await asUser(db, ana, tx => rows<{ create_track: string }>(tx, 'select public.create_track($1)', [JSON.stringify(payload)])) as [{ create_track: string }]
    const [t] = await rows(db, 'select owner_id, title, emoji, color, visibility, target_date::text from public.tracks where id = $1', [id])
    expect(t).toMatchObject({ owner_id: ana, title: 'Python', emoji: '🐍', color: 'mint', visibility: 'public', target_date: '2026-12-01' })
    expect(await structure(id)).toEqual([
      { phase: 'Basics', ppos: 0, title: 'Syntax', mpos: 0, tag: 'study', done: false },
      { phase: 'Basics', ppos: 0, title: 'Types', mpos: 1, tag: null, done: true },
      { phase: 'Projects', ppos: 1, title: 'CLI tool', mpos: 0, tag: null, done: false },
    ])
    const acts = await rows<{ type: string }>(db, 'select type from public.activities where track_id = $1 order by type', [id])
    expect(acts.map(a => a.type)).toEqual(['milestone_completed', 'track_started'])
  })

  it('rolls back everything when one milestone is invalid', async () => {
    const bad = { ...payload, title: 'Broken', phases: [{ title: 'P', milestones: [{ title: 'ok' }, { title: '' }] }] }
    await expect(asUser(db, ana, tx => tx.query('select public.create_track($1)', [JSON.stringify(bad)]))).rejects.toThrow()
    expect(await rows(db, `select id from public.tracks where title = 'Broken'`)).toHaveLength(0)
  })

  it('requires at least one phase', async () => {
    await expect(asUser(db, ana, tx => tx.query('select public.create_track($1)', [JSON.stringify({ title: 'Empty', phases: [] })])))
      .rejects.toThrow(/at least one phase/)
  })
})

describe('update_track', () => {
  it('renames, reorders, moves, adds and removes while keeping completion', async () => {
    const [{ create_track: id }] = await asUser(db, ana, tx => rows<{ create_track: string }>(tx, 'select public.create_track($1)', [JSON.stringify(payload)])) as [{ create_track: string }]
    const phases = await rows<{ id: string, title: string }>(db, 'select id, title from public.phases where track_id = $1 order by position', [id])
    const ms = await rows<{ id: string, title: string }>(db, 'select id, title from public.milestones where track_id = $1', [id])
    const byTitle = Object.fromEntries(ms.map(m => [m.title, m.id]))

    const next = {
      ...payload,
      title: 'Python 3',
      visibility: 'friends',
      phases: [
        // Projects first; "Types" (completed) moves into it; "CLI tool" is dropped.
        { id: phases[1]!.id, title: 'Build', milestones: [{ id: byTitle.Types, title: 'Type hints' }, { title: 'Web scraper', tag: 'project' }] },
        { id: phases[0]!.id, title: 'Basics', milestones: [{ id: byTitle.Syntax, title: 'Syntax' }] },
        { title: 'Ship', milestones: [] },
      ],
    }
    await asUser(db, ana, tx => tx.query('select public.update_track($1, $2)', [id, JSON.stringify(next)]))

    expect(await structure(id)).toEqual([
      { phase: 'Build', ppos: 0, title: 'Type hints', mpos: 0, tag: null, done: true },
      { phase: 'Build', ppos: 0, title: 'Web scraper', mpos: 1, tag: 'project', done: false },
      { phase: 'Basics', ppos: 1, title: 'Syntax', mpos: 0, tag: null, done: false },
      { phase: 'Ship', ppos: 2, title: null, mpos: null, tag: null, done: false },
    ])
    const [t] = await rows<{ title: string, visibility: string }>(db, 'select title, visibility from public.tracks where id = $1', [id])
    expect(t).toEqual({ title: 'Python 3', visibility: 'friends' })
  })

  it('removes phases left out of the payload', async () => {
    const [{ create_track: id }] = await asUser(db, ana, tx => rows<{ create_track: string }>(tx, 'select public.create_track($1)', [JSON.stringify(payload)])) as [{ create_track: string }]
    const phases = await rows<{ id: string }>(db, 'select id from public.phases where track_id = $1 order by position', [id])
    await asUser(db, ana, tx => tx.query('select public.update_track($1, $2)', [id, JSON.stringify({ ...payload, phases: [{ id: phases[0]!.id, title: 'Only', milestones: [] }] })]))
    expect((await rows(db, 'select id from public.phases where track_id = $1', [id]))).toHaveLength(1)
    expect((await rows(db, 'select id from public.milestones where track_id = $1', [id]))).toHaveLength(0)
  })

  it('cannot touch someone else\'s trail', async () => {
    const [{ create_track: id }] = await asUser(db, ana, tx => rows<{ create_track: string }>(tx, 'select public.create_track($1)', [JSON.stringify(payload)])) as [{ create_track: string }]
    await expect(asUser(db, rafa, tx => tx.query('select public.update_track($1, $2)', [id, JSON.stringify({ ...payload, title: 'pwned' })])))
      .rejects.toThrow(/not found/)
    const [t] = await rows<{ title: string }>(db, 'select title from public.tracks where id = $1', [id])
    expect(t!.title).toBe('Python')
  })

  it('cannot adopt a phase from another trail', async () => {
    const [{ create_track: mine }] = await asUser(db, ana, tx => rows<{ create_track: string }>(tx, 'select public.create_track($1)', [JSON.stringify(payload)])) as [{ create_track: string }]
    const [{ create_track: other }] = await asUser(db, ana, tx => rows<{ create_track: string }>(tx, 'select public.create_track($1)', [JSON.stringify(payload)])) as [{ create_track: string }]
    const [foreign] = await rows<{ id: string }>(db, 'select id from public.phases where track_id = $1 limit 1', [other])
    await expect(asUser(db, ana, tx => tx.query('select public.update_track($1, $2)', [mine, JSON.stringify({ ...payload, phases: [{ id: foreign!.id, title: 'x', milestones: [] }] })])))
      .rejects.toThrow(/does not belong/)
  })
})
