import { describe, expect, it } from 'vitest'
import en from '../../i18n/locales/en.json'
import ptBR from '../../i18n/locales/pt-BR.json'

type Tree = { [k: string]: string | Tree }
const flatten = (obj: Tree, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]))

describe('locales', () => {
  it('share the same keys', () => {
    expect(flatten(ptBR as Tree).sort()).toEqual(flatten(en as Tree).sort())
  })
})
