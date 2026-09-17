# Zero to Hero — project context

App genérico de **trilhas de estudo com marcos**. Qualquer pessoa cria uma trilha, divide em fases e marcos, conclui cada marco com uma evidência opcional, usa trilhas públicas como modelo e acompanha amigos.

**Fonte da verdade do produto:** `docs/spec-mvp.md`. Leia antes de implementar qualquer coisa. Se precisar divergir da spec, registre o porquê na própria spec, na mesma mudança.

## Regras que não se negociam
- **O repositório é PÚBLICO.**
  - `plans/` e `seed/personal/` estão no `.gitignore` e têm contexto privado. Nunca versione, cite ou copie o conteúdo delas para arquivos rastreados.
  - Nunca commite `.env` nem chaves.
- **Node 22** (`.nvmrc`). O Node 20 quebra o ESLint (`Object.groupBy`).
- **i18n em tudo.** Nenhum texto de UI fica hardcoded.
  - Chaves em `i18n/locales/{en,pt-BR}.json`, agrupadas por tela. As duas línguas sempre na mesma mudança; `npm run i18n:check` garante a paridade.
  - Conteúdo criado pelo usuário não é traduzido.
- **Segurança fica no banco.** Toda tabela nova nasce com RLS e policies, conforme a spec §3.
  - A secret key do Supabase só aparece em `scripts/seed.ts` e em server routes que realmente precisem dela, nunca no bundle do cliente.
- **Testes verificam `data-testid`**, nunca texto traduzido.
- **Gates antes de todo commit:** `npm run gates` (lint + typecheck + i18n + unit). Commit em fatias coerentes, com mensagem no formato `feat: …`, `fix: …`, `chore: …`.

## Estrutura
| Pasta | Conteúdo |
|---|---|
| `app/pages/` | Rotas (spec §1) |
| `app/components/<área>/` | Componentes, prefixados pela pasta (`UiAppLogo`) |
| `app/composables/` | Acesso a dados e estado (`useTracks`, `useMilestones`…) |
| `shared/utils/` | Código puro compartilhado entre cliente, servidor e seed (parser de lista) |
| `shared/types/database.ts` | Tipos gerados do Supabase (`npm run db:types`) |
| `server/api/` | Escritas compostas (criar trilha com fases, copiar modelo, upload) |
| `supabase/migrations/` | SQL versionado, um arquivo por mudança, nunca editado depois de aplicado |
| `seed/demo/` | Trilhas públicas dos usuários de demonstração (versionado) |
| `seed/personal/` | Trilhas do dono (**ignorado pelo git**) |
| `tests/unit/`, `e2e/` | Vitest e Playwright |

## Design
Tokens em `app/assets/css/main.css`, vindos do protótipo aprovado.
- **Tipografia:** Figtree 400–900; IBM Plex Mono só para números (`.num`).
- **Cores:** cinco cores de trilha, com as capas `cover-<cor>`.
- **Forma:** cantos de 18–28px, `shadow-soft`, chips preenchidos, abas em pílula.
- **Tema:** claro e escuro, ambos desenhados.
- **Tom:** cores vivas e interface com vida. Comemore a conclusão de marco, respeitando `prefers-reduced-motion`.
