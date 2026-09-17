// Fails when any .vue file does not parse (lint and typecheck can miss a broken SFC).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@vue/compiler-sfc'

const root = join(import.meta.dirname, '..', 'app')
const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.vue')) files.push(p)
  }
}
walk(root)

let failed = 0
for (const file of files) {
  const { errors } = parse(readFileSync(file, 'utf8'), { filename: file })
  if (errors.length) {
    failed++
    console.error(`${file}:\n  ${errors.map(e => e.message).join('\n  ')}`)
  }
}
if (failed) process.exit(1)
console.log(`sfc: ${files.length} components parse cleanly.`)
