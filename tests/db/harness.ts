// Embedded Postgres (PGlite) with the minimum of Supabase needed to run our
// migrations and exercise RLS: an `auth` schema, `auth.uid()` and the
// `authenticated` / `anon` roles. Storage migrations are skipped (no storage schema).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { citext } from '@electric-sql/pglite/contrib/citext'

const MIGRATIONS = join(import.meta.dirname, '..', '..', 'supabase', 'migrations')

const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema auth to anon, authenticated;
`

const GRANTS = `
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
  grant execute on all functions in schema public to authenticated;
`

export type Db = PGlite

export async function createDb(): Promise<Db> {
  const db = new PGlite({ extensions: { citext } })
  await db.exec(SUPABASE_STUB)
  const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql') && !f.includes('storage')).sort()
  for (const f of files) {
    await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'))
  }
  await db.exec(GRANTS)
  return db
}

let counter = 0
/** Creates an auth user (and, via trigger, its profile). Returns the id. */
export async function createUser(db: Db, handle: string): Promise<string> {
  counter += 1
  const hex = String(counter).padStart(12, '0')
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4000-8000-${hex}`
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${handle}@test.local`])
  await db.query('update public.profiles set handle = $1 where id = $2', [handle, id])
  return id
}

/** Runs `fn` as the given user under RLS, inside a transaction that is rolled back on error. */
export async function asUser<T>(db: Db, userId: string | null, fn: (tx: Db) => Promise<T>): Promise<T> {
  await db.exec('begin')
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ''])
    await db.exec(`set local role ${userId ? 'authenticated' : 'anon'}`)
    const result = await fn(db)
    await db.exec('commit')
    return result
  }
  catch (e) {
    await db.exec('rollback')
    throw e
  }
}

export async function rows<T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await db.query<T>(sql, params)
  return res.rows
}
