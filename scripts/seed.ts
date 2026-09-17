/**
 * Seeds a Supabase project (docs/spec-mvp.md §6).
 *
 *   npm run seed                 # demo users + demo trails + the owner's personal trails
 *   npm run seed -- --reset      # remove everything this script created
 *   npm run seed -- --dry-run    # parse and print the plan; no network
 *
 * Idempotent: every id is a UUID v5 derived from stable names, and inserts
 * skip rows that already exist (so activity triggers fire once).
 * Needs NUXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (server-only).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { v5 as uuidv5 } from 'uuid'
import { parseTrackList, type ParsedTrack } from '../shared/utils/track-list'

const NS = '6f1c2a54-2c1e-4d7b-9a3f-5e0b8c7d9a10'
const id = (...parts: string[]) => uuidv5(parts.join('/'), NS)
const DAY = 86_400_000

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const reset = args.has('--reset')

const ROOT = join(import.meta.dirname, '..')
const DEMO_DIR = join(ROOT, 'seed', 'demo')
const PERSONAL_DIR = join(ROOT, 'seed', 'personal')
const DEMO_DOMAIN = 'demo.zerotohero.local'

const DEMO_PEOPLE = [
  { handle: 'ana', name: 'Ana', locale: 'pt-BR' },
  { handle: 'rafa', name: 'Rafa', locale: 'pt-BR' },
  { handle: 'luiza', name: 'Lu', locale: 'en' },
  { handle: 'bruno', name: 'Bruno', locale: 'pt-BR' },
  { handle: 'carla', name: 'Carla', locale: 'en' },
  { handle: 'e2e', name: 'E2E Tester', locale: 'en' },
] as const

interface SeedTrack { key: string, ownerHandle: string | null, track: ParsedTrack, shiftDates: boolean }

function readTrails(dir: string, personal: boolean): SeedTrack[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => f.endsWith('.md')).sort().map((file) => {
    const { track, errors } = parseTrackList(readFileSync(join(dir, file), 'utf8'))
    if (errors.length) console.warn(`  ! ${file}:`, errors)
    return {
      key: `${personal ? 'personal' : 'demo'}/${file}`,
      ownerHandle: personal ? null : file.split('.')[0]!,
      track,
      shiftDates: !personal,
    }
  })
}

// `alex` is the browser-only demo persona; the Supabase seed has no such account.
const demoTrails = readTrails(DEMO_DIR, false).filter(t => t.ownerHandle !== 'alex')
const personalTrails = readTrails(PERSONAL_DIR, true)

// Demo dates are shifted so the most recent one lands yesterday.
const demoDates = demoTrails.flatMap(t => t.track.phases.flatMap(p => p.milestones.map(m => m.date))).filter((d): d is string => !!d)
const latestDemo = demoDates.length ? Math.max(...demoDates.map(d => Date.parse(`${d}T00:00:00Z`))) : Date.now()
const shiftMs = Date.now() - DAY - latestDemo
const shifted = (date: string) => new Date(Date.parse(`${date}T15:00:00Z`) + shiftMs)

function rowsFor(seed: SeedTrack, ownerId: string) {
  const t = seed.track
  const trackId = id('track', seed.key)
  const track = {
    id: trackId,
    owner_id: ownerId,
    title: t.title ?? seed.key,
    goal: t.goal,
    emoji: t.emoji ?? '🎯',
    color: t.color ?? 'violet',
    target_date: t.due,
    visibility: t.visibility ?? 'private',
  }
  const phases = t.phases.map((p, pi) => ({ id: id('phase', seed.key, String(pi)), track_id: trackId, title: p.title ?? 'General', position: pi }))
  const milestones = t.phases.flatMap((p, pi) => p.milestones.map((m, mi) => {
    let completedAt: string | null = null
    if (m.done) {
      const when = m.date ? (seed.shiftDates ? shifted(m.date) : new Date(`${m.date}T15:00:00Z`)) : new Date(Date.now() - 3 * DAY)
      completedAt = when.toISOString()
    }
    return {
      id: id('milestone', seed.key, String(pi), String(mi)),
      track_id: trackId,
      phase_id: phases[pi]!.id,
      title: m.title,
      tag: m.tag,
      position: mi,
      due_date: m.done ? null : m.date,
      completed_at: completedAt,
      time_spent_minutes: m.done ? 60 : null,
    }
  }))
  return { track, phases, milestones }
}

function plan() {
  console.log(`Demo trails: ${demoTrails.length}`)
  for (const t of demoTrails) console.log(`  - ${t.ownerHandle}: ${t.track.title} (${t.track.phases.reduce((n, p) => n + p.milestones.length, 0)} milestones)`)
  console.log(`Personal trails: ${personalTrails.length}`)
  for (const t of personalTrails) console.log(`  - ${t.track.title} (${t.track.phases.reduce((n, p) => n + p.milestones.length, 0)} milestones)`)
}

if (dryRun) {
  plan()
  const sample = demoTrails[0]
  if (sample) {
    const rows = rowsFor(sample, '00000000-0000-0000-0000-000000000000')
    console.log(`Sample ids stable: ${rows.track.id === rowsFor(sample, 'x').track.id}`)
  }
  process.exit(0)
}

const url = process.env.NUXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!url || !secret) {
  console.error('Set NUXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env (see .env.example).')
  process.exit(1)
}
const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })

async function must<T>(p: PromiseLike<{ data: T, error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

async function findUserByEmail(email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

async function ensureDemoUser(p: typeof DEMO_PEOPLE[number], password: string): Promise<string> {
  const email = `${p.handle}@${DEMO_DOMAIN}`
  let user = await findUserByEmail(email)
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: p.name } })
    if (error) throw error
    user = data.user
  }
  await must(db.from('profiles').update({ handle: p.handle, display_name: p.name, locale: p.locale, onboarded_at: new Date().toISOString() }).eq('id', user!.id), `profile ${p.handle}`)
  return user!.id
}

async function insertTrail(seed: SeedTrack, ownerId: string) {
  const { track, phases, milestones } = rowsFor(seed, ownerId)
  await must(db.from('tracks').upsert(track, { onConflict: 'id', ignoreDuplicates: true }), `track ${track.title}`)
  await must(db.from('phases').upsert(phases, { onConflict: 'id', ignoreDuplicates: true }), `phases ${track.title}`)
  // Chronological inserts so the activity triggers see completions in order.
  const ordered = [...milestones].sort((a, b) => (a.completed_at ?? '9').localeCompare(b.completed_at ?? '9'))
  for (const m of ordered) {
    await must(db.from('milestones').upsert(m, { onConflict: 'id', ignoreDuplicates: true }), `milestone ${m.title}`)
  }
  return track.id
}

async function befriend(a: string, b: string) {
  await must(db.from('friendships').upsert(
    { requester_id: a, addressee_id: b, status: 'accepted', responded_at: new Date().toISOString() },
    { onConflict: 'requester_id,addressee_id', ignoreDuplicates: true },
  ), 'friendship')
}

async function doReset() {
  const keys = [...demoTrails, ...personalTrails].map(t => id('track', t.key))
  await must(db.from('tracks').delete().in('id', keys), 'delete trails')
  for (const p of DEMO_PEOPLE) {
    const user = await findUserByEmail(`${p.handle}@${DEMO_DOMAIN}`)
    if (user) {
      const { error } = await db.auth.admin.deleteUser(user.id)
      if (error) throw error
    }
  }
  console.log('Reset done.')
}

async function main() {
  if (reset) return doReset()
  plan()
  const password = process.env.SEED_DEMO_PASSWORD
  if (!password || password.length < 8) throw new Error('Set SEED_DEMO_PASSWORD (8+ characters) in .env.')

  const ids: Record<string, string> = {}
  for (const p of DEMO_PEOPLE) ids[p.handle] = await ensureDemoUser(p, password)

  for (const t of demoTrails) {
    const owner = ids[t.ownerHandle!]
    if (!owner) {
      console.warn(`  ! no demo user for ${t.key}`)
      continue
    }
    await insertTrail(t, owner)
  }

  await befriend(ids.ana!, ids.rafa!)
  await befriend(ids.luiza!, ids.ana!)
  await befriend(ids.e2e!, ids.ana!)

  const ownerEmail = process.env.SEED_OWNER_EMAIL
  if (ownerEmail) {
    const owner = await findUserByEmail(ownerEmail)
    if (!owner) {
      console.warn(`  ! ${ownerEmail} has not signed in yet; sign in once and run the seed again for the personal trails.`)
    }
    else {
      for (const t of personalTrails) await insertTrail(t, owner.id)
      for (const h of ['ana', 'rafa', 'luiza']) await befriend(owner.id, ids[h]!)
      await must(db.from('friendships').upsert({ requester_id: ids.bruno!, addressee_id: owner.id }, { onConflict: 'requester_id,addressee_id', ignoreDuplicates: true }), 'pending request')
      console.log(`Personal trails attached to ${ownerEmail}.`)
    }
  }
  console.log('Seed done.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
