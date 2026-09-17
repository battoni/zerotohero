import { describe, expect, it } from 'vitest'
import { fail } from '../../app/repositories/supabase'

const codeOf = (code?: string) => {
  try {
    fail({ code, message: 'x' })
  }
  catch (e) {
    return (e as { code: string }).code
  }
  return 'none'
}

describe('supabase error mapping', () => {
  it('passes when there is no error', () => {
    expect(() => fail(null)).not.toThrow()
  })
  it.each([
    ['23505', 'handle_taken'],
    ['23514', 'invalid'],
    ['22P02', 'invalid'],
    ['22007', 'invalid'],
    ['P0002', 'not_found'],
    ['23503', 'not_found'],
    ['PGRST116', 'not_found'],
    ['PGRST100', 'network'],
    ['42501', 'forbidden'],
    ['PGRST301', 'network'],
    ['08006', 'network'],
    [undefined, 'network'],
  ])('%s → %s', (code, expected) => {
    expect(codeOf(code)).toBe(expected)
  })
})
