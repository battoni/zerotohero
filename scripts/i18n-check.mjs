// Fails when the locale files do not share exactly the same keys, or when a key
// is never referenced from app/ (dynamic keys count through their `prefix.${` part).
import { readFileSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'

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
const appDir = join(import.meta.dirname, '..', 'app')
const sources = readdirSync(appDir, { recursive: true })
  .filter(f => ['.vue', '.ts'].includes(extname(String(f))))
  .map(f => readFileSync(join(appDir, String(f)), 'utf8'))
  .join('\n')
const dynamicPrefixes = [...sources.matchAll(/[`'"]([a-zA-Z]+(?:\.[a-zA-Z]+)*\.)\$\{/g)].map(m => m[1])
const unused = [...all].filter(k => !sources.includes(`'${k}'`) && !sources.includes(`"${k}"`) && !sources.includes(`\`${k}\``)
  && !dynamicPrefixes.some(p => k.startsWith(p)))
if (unused.length) {
  failed = true
  console.error(`${unused.length} key(s) are never used in app/:\n  ${unused.join('\n  ')}`)
}

if (failed) process.exit(1)
console.log(`i18n: ${files.length} locales, ${all.size} keys, in sync.`)
