// Fails when the locale files do not share exactly the same keys.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'i18n', 'locales')
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`])

const files = readdirSync(dir).filter(f => f.endsWith('.json'))
const keys = Object.fromEntries(files.map(f => [f, new Set(flatten(JSON.parse(readFileSync(join(dir, f), 'utf8'))))]))
const all = new Set(Object.values(keys).flatMap(s => [...s]))
let failed = false
for (const [file, set] of Object.entries(keys)) {
  const missing = [...all].filter(k => !set.has(k))
  if (missing.length) {
    failed = true
    console.error(`${file} is missing ${missing.length} key(s):\n  ${missing.join('\n  ')}`)
  }
}
if (failed) process.exit(1)
console.log(`i18n: ${files.length} locales, ${all.size} keys, in sync.`)
