import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Read the raw files: importing them goes through the i18n compiler plugin.
const load = (name: string) => JSON.parse(readFileSync(join(__dirname, '..', '..', 'i18n', 'locales', name), 'utf8'))

type Tree = { [k: string]: string | Tree }
const flatten = (obj: Tree, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]))

describe('locales', () => {
  const en = load('en.json') as Tree
  const pt = load('pt-BR.json') as Tree

  it('share the same keys', () => {
    expect(flatten(pt).sort()).toEqual(flatten(en).sort())
  })

  it('keep plural branches aligned', () => {
    const plural = (t: Tree) => flatten(t).filter(k => {
      const v = k.split('.').reduce<unknown>((o, p) => (o as Tree)[p], t)
      return typeof v === 'string' && v.includes(' | ')
    }).sort()
    expect(plural(pt)).toEqual(plural(en))
  })
})
