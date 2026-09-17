# Zero to Hero

Build a study trail, break it into milestones and tick them off one by one. Use it for a certification, a new language or a career shift, alone or with friends.

## Stack

- Nuxt 4 (Vue 3, TypeScript), Tailwind 4
- Supabase: Postgres with Row Level Security, Auth (Google, GitHub), Storage, Realtime
- `@nuxtjs/i18n`: English and Brazilian Portuguese from day one

## Try it without a backend

With no Supabase URL configured the app runs in **demo mode**: sample trails, friends and activity live in your browser (localStorage).

```bash
nvm use && npm install && npm run dev   # then click "Try the demo"
```

## Getting started with Supabase

```bash
nvm use            # Node 22
npm install
cp .env.example .env   # fill in the Supabase project values
npx supabase link --project-ref <project-ref>
npx supabase db push   # apply supabase/migrations
npm run seed -- --dry-run   # preview; drop the flag to seed demo users and trails
npm run dev
```

Enable the Google and GitHub providers in Supabase Auth (and email/password for the seeded demo and e2e users), with `<site>/confirm` as the redirect URL.

## Quality gates

```bash
npm run gates      # lint + typecheck + i18n key parity + unit tests
npm run test:e2e   # Playwright journey against the dev server (demo mode)
```

## Docs

- [`docs/spec-mvp.md`](docs/spec-mvp.md): scope, data model, RLS, list format and seed.

## License

All rights reserved.
