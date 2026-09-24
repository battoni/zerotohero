# Zero to Hero — project context

App genérico de **trilhas de estudo com marcos**. Qualquer pessoa cria uma trilha, divide em fases e marcos, conclui cada marco com uma evidência opcional, usa trilhas públicas como modelo e acompanha amigos.

**Fonte da verdade do produto:** `docs/spec-mvp.md`. Leia antes de implementar qualquer coisa. Se precisar divergir da spec, registre o porquê na própria spec, na mesma mudança.

## Regras que não se negociam
- **O repositório é PÚBLICO.**
  - `plans/` e `seed/personal/` estão no `.gitignore` e têm contexto privado. Nunca versione, cite ou copie o conteúdo delas para arquivos rastreados.
  - Nunca commite `.env` nem chaves.
- **Node 24** (`.nvmrc`). O Node 20 quebra o ESLint (`Object.groupBy`).
- **i18n em tudo.** Nenhum texto de UI fica hardcoded.
  - Chaves em `i18n/locales/{en,pt-BR}.json`, agrupadas por tela. As duas línguas sempre na mesma mudança; `npm run i18n:check` garante a paridade.
  - Conteúdo criado pelo usuário não é traduzido.
- **Segurança fica no banco.** Toda tabela nova nasce com RLS e policies, conforme a spec §3.
  - A secret key do Supabase só aparece em `scripts/seed.ts` e em server routes que realmente precisem dela (hoje, a URL assinada de evidência), sempre como variável de runtime e nunca no bundle do cliente.
- **Testes verificam `data-testid`**, nunca texto traduzido.
- **Gates antes de todo commit:** `npm run gates` (sfc:check + lint + typecheck + i18n + testes unitários e de banco). Commit em fatias coerentes, com mensagem no formato `feat: …`, `fix: …`, `chore: …`.

## Estrutura
| Pasta | Conteúdo |
|---|---|
| `app/pages/` | Rotas (spec §1) |
| `app/components/<área>/` | Componentes, prefixados pela pasta (`UiAppLogo`) |
| `app/composables/` | `useRepo`, `useSession` (dados via `app/repositories/`) |
| `app/repositories/` | Contrato `DataRepository` e as implementações demo e Supabase |
| `shared/utils/` | Código puro compartilhado entre cliente, servidor e seed (parser de lista) |
| `shared/types/database.ts` | Espelho escrito à mão das migrations até `npm run db:types` rodar |
| `server/api/` | `evidence/[id]/file.get.ts`: URL assinada de evidência (escritas compostas são RPCs SQL) |
| `supabase/migrations/` | SQL versionado, um arquivo por mudança, nunca editado depois de aplicado |
| `seed/demo/` | Trilhas públicas dos usuários de demonstração (versionado) |
| `seed/personal/` | Trilhas do dono (**ignorado pelo git**) |
| `tests/unit/`, `tests/db/`, `e2e/` | Vitest (unitários e SQL/RLS no PGlite) e Playwright (modo demo) |

## Design
Tokens em `app/assets/css/main.css`, vindos do protótipo aprovado.
- **Tipografia:** Figtree 400–900; IBM Plex Mono só para números (`.num`).
- **Cores:** cinco cores de trilha, com as capas `cover-<cor>`.
- **Forma:** cantos de 18–28px, `shadow-soft`, chips preenchidos, abas em pílula.
- **Tema:** claro e escuro, ambos desenhados.
- **Tom:** cores vivas e interface com vida. Comemore a conclusão de marco, respeitando `prefers-reduced-motion`.
