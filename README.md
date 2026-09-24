# Zero to Hero

Build a study trail, break it into milestones and tick them off one by one. Use it for a certification, a new language or a career shift, alone or with friends.

## Stack

- Nuxt 4 (Vue 3, TypeScript), Tailwind 4
- Supabase: Postgres with Row Level Security, Auth (Google, GitHub), Storage
- `@nuxtjs/i18n`: English and Brazilian Portuguese from day one

## Try it without a backend

With no Supabase URL configured the app runs in **demo mode**: sample trails, friends and activity live in your browser (localStorage).

```bash
nvm use && npm ci && npm run dev   # then click "Try the demo"
```

## Getting started with Supabase

```bash
nvm use            # Node 24
npm ci             # install exactly what package-lock.json pins
cp .env.example .env   # Supabase URL and publishable key; SUPABASE_SECRET_KEY for the seed
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push   # apply supabase/migrations
npm run seed -- --dry-run   # preview; drop the flag to seed demo users and trails
npm run dev
```

The app reads `NUXT_SUPABASE_SECRET_KEY` at runtime only (signed links to evidence files). Set it in the host's environment, never at build time.

Enable the Google and GitHub providers in Supabase Auth (and email/password for the seeded demo and e2e users), with `<site>/confirm` and `<site>/pt-BR/confirm` as redirect URLs.

## Quality gates

```bash
npm run gates      # SFC parse check + lint + typecheck + i18n key parity + unit and database tests
npx playwright install chromium   # once
NUXT_PUBLIC_DATA_MODE=demo npm run test:e2e   # Playwright journeys in demo mode
```

The e2e run starts the dev server, or reuses one already listening on port 3000. With Supabase values in `.env`, force demo mode as above (CI does the same).

## Docs

- [`docs/spec-mvp.md`](docs/spec-mvp.md): scope, data model, RLS, list format and seed.

## License

All rights reserved.
