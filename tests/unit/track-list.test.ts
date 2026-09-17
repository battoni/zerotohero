import { describe, expect, it } from 'vitest'
import { LIMITS, parseTrackList, toTrackList } from '../../shared/utils/track-list'

const FULL = `# Rumo ao AI-Native
> Passar na certificação até 31/10.
emoji: 🤖 | color: violet | due: 2026-10-31 | visibility: public

## Ferramenta
- [x] Revisar os 18 itens do guia #preparo @2026-09-15
## Especificar
- [ ] Reescrever 3 tarefas em critérios mensuráveis #prática @2026-09-18
- Escrever uma spec com casos de borda #prática
`

describe('parseTrackList', () => {
  it('parses a full list', () => {
    const { track, errors } = parseTrackList(FULL)
    expect(errors).toEqual([])
    expect(track).toEqual({
      title: 'Rumo ao AI-Native',
      goal: 'Passar na certificação até 31/10.',
      emoji: '🤖',
      color: 'violet',
      due: '2026-10-31',
      visibility: 'public',
      phases: [
        { title: 'Ferramenta', milestones: [{ title: 'Revisar os 18 itens do guia', tag: 'preparo', date: '2026-09-15', done: true }] },
        { title: 'Especificar', milestones: [
          { title: 'Reescrever 3 tarefas em critérios mensuráveis', tag: 'prática', date: '2026-09-18', done: false },
          { title: 'Escrever uma spec com casos de borda', tag: 'prática', date: null, done: false },
        ] },
      ],
    })
  })

  it('turns plain text into one milestone per line in the default phase', () => {
    const { track, errors } = parseTrackList('Read chapter 1\n\n  Build the demo  \nShip it\n')
    expect(errors).toEqual([])
    expect(track.title).toBeNull()
    expect(track.phases).toEqual([{ title: null, milestones: [
      { title: 'Read chapter 1', tag: null, date: null, done: false },
      { title: 'Build the demo', tag: null, date: null, done: false },
      { title: 'Ship it', tag: null, date: null, done: false },
    ] }])
  })

  it('puts milestones before the first heading in the default phase', () => {
    const { track } = parseTrackList('- one\n## Later\n- two')
    expect(track.phases.map(p => [p.title, p.milestones.length])).toEqual([[null, 1], ['Later', 1]])
  })

  it('accepts *, + and numbered bullets and uppercase X', () => {
    const { track } = parseTrackList('* a\n+ b\n1. c\n2) d\n- [X] e')
    expect(track.phases[0]!.milestones.map(m => [m.title, m.done])).toEqual([['a', false], ['b', false], ['c', false], ['d', false], ['e', true]])
  })

  it('keeps later hashtags in the title and uses only the first as tag', () => {
    const { track } = parseTrackList('- Learn #vue and #nuxt')
    expect(track.phases[0]!.milestones[0]).toMatchObject({ title: 'Learn and #nuxt', tag: 'vue' })
  })

  it('reports invalid metadata and dates without failing', () => {
    const { track, errors } = parseTrackList('# T\ncolor: pink | visibility: secret | due: 2026-02-30 | mood: great\n- x @2026-13-01')
    expect(track.color).toBeNull()
    expect(track.visibility).toBeNull()
    expect(track.due).toBeNull()
    expect(errors).toEqual([
      { line: 2, code: 'invalid_color', value: 'pink' },
      { line: 2, code: 'invalid_visibility', value: 'secret' },
      { line: 2, code: 'invalid_date', value: '2026-02-30' },
      { line: 2, code: 'unknown_meta', value: 'mood' },
      { line: 3, code: 'invalid_date', value: '2026-13-01' },
    ])
    expect(track.phases[0]!.milestones[0]).toMatchObject({ title: 'x', date: null })
  })

  it('treats "key: value" after the first milestone as a milestone, not metadata', () => {
    const { track } = parseTrackList('- first\nnote: remember this')
    expect(track.phases[0]!.milestones.map(m => m.title)).toEqual(['first', 'note: remember this'])
  })

  it('clips long titles and reports them', () => {
    const long = 'x'.repeat(LIMITS.milestoneTitle + 10)
    const { track, errors } = parseTrackList(`- ${long}`)
    expect(track.phases[0]!.milestones[0]!.title).toHaveLength(LIMITS.milestoneTitle)
    expect(errors[0]).toMatchObject({ line: 1, code: 'too_long' })
  })

  it('enforces the milestone and phase limits', () => {
    const many = Array.from({ length: LIMITS.milestones + 5 }, (_, i) => `- m${i}`).join('\n')
    const r1 = parseTrackList(many)
    expect(r1.track.phases[0]!.milestones).toHaveLength(LIMITS.milestones)
    expect(r1.errors).toEqual([{ line: LIMITS.milestones + 1, code: 'too_many_milestones' }])

    const phases = Array.from({ length: LIMITS.phases + 2 }, (_, i) => `## P${i}\n- m${i}`).join('\n')
    const r2 = parseTrackList(phases)
    expect(r2.track.phases).toHaveLength(LIMITS.phases)
    expect(r2.errors.filter(e => e.code === 'too_many_phases')).toHaveLength(1)
    expect(r2.track.phases.flatMap(p => p.milestones)).toHaveLength(LIMITS.phases)
  })

  it('reports an empty input', () => {
    expect(parseTrackList('  \n\n').errors).toEqual([{ line: 1, code: 'empty' }])
  })

  it('handles CRLF line endings', () => {
    const { track } = parseTrackList('# T\r\n- a\r\n- b\r\n')
    expect(track.phases[0]!.milestones.map(m => m.title)).toEqual(['a', 'b'])
  })
})

describe('toTrackList', () => {
  it('round-trips a parsed trail', () => {
    const { track } = parseTrackList(FULL)
    expect(parseTrackList(toTrackList(track)).track).toEqual(track)
  })

  it('round-trips a default phase followed by named phases', () => {
    const { track } = parseTrackList('- loose\n## Named\n- inside #t @2026-01-02')
    expect(parseTrackList(toTrackList(track)).track).toEqual(track)
  })
})
