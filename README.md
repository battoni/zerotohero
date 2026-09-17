# Zero to Hero

Build a study trail, break it into milestones and tick them off one by one. Use it for a certification, a new language or a career shift, alone or with friends.

## Stack

- Nuxt 4 (Vue 3, TypeScript), Tailwind 4
- Supabase: Postgres with Row Level Security, Auth (Google, GitHub), Storage, Realtime
- `@nuxtjs/i18n`: English and Brazilian Portuguese from day one

## Getting started

```bash
nvm use            # Node 22
npm install
cp .env.example .env   # fill in the Supabase project values
npx supabase link --project-ref <project-ref>
npx supabase db push   # apply supabase/migrations
npm run dev
```

## Quality gates

```bash
npm run gates      # lint + typecheck + i18n key parity + unit tests
npm run test:e2e   # Playwright against the dev server
```

## Docs

- [`docs/spec-mvp.md`](docs/spec-mvp.md): scope, data model, RLS, list format and seed.

## License

All rights reserved.
