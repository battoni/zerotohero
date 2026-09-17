# Zero to Hero — Spec do MVP

Atualizado: 2026-09-16 · status: **aprovada para implementação**

> **O produto em uma frase:** qualquer pessoa cria uma trilha de estudo, divide em fases e marcos, e vai concluindo cada marco. Pode anexar evidências, usar trilhas públicas como modelo e acompanhar amigos.

Protótipo aprovado (6 telas): artefato "The Way Out", nome antigo do projeto.

---

## 1. Escopo

### Entra no MVP
| Tela | Rota | O que faz |
|---|---|---|
| Landing | `/` | Apresenta o app a quem não está logado e leva ao login |
| Login | `/login` | OAuth (Google, GitHub). Em dev, também e-mail e senha para o usuário de teste |
| Onboarding | `/welcome` | Escolher o handle, o nome exibido e o idioma. Acontece uma vez só |
| Minhas trilhas | `/tracks` | Cards com capa, anel de progresso, próximo marco e resumo da semana |
| Criar trilha | `/tracks/new` | Identidade (nome, objetivo, data, emoji, cor, visibilidade) e editor de fases e marcos. Três formas de começar: em branco, de um modelo ou colando uma lista |
| Editar trilha | `/tracks/:id/edit` | Mesmo editor, aplicado a uma trilha existente |
| Trilha | `/tracks/:id` | Caminho vertical de fases e marcos, com toggle de conclusão, anel de progresso, próximo marco, seguidores e últimas evidências |
| Concluir marco | *sheet* sobre `/tracks/:id` | Evidência opcional (link, nota, arquivo, certificado, nenhuma), o que aprendeu, data e tempo gasto. Termina na tela de comemoração |
| Explorar | `/explore` | Trilhas públicas com busca, filtros e a ação "usar como modelo" |
| Amigos | `/friends` | Feed de atividades dos amigos, "boa!" (kudos) e pedidos de amizade |
| Perfil | `/u/:handle` | Estatísticas, mapa de 20 semanas e trilhas visíveis para quem está vendo |
| Ajustes | `/settings` | Idioma, handle, nome exibido e sair |

### Fica fora do MVP
- Gerador de perguntas com IA
- Sub-itens dentro de um marco
- Notificações por e-mail ou push
- Comentários
- Trilha com vários donos

### Decisões assumidas (revisáveis)
| Questão | Decisão no MVP |
|---|---|
| Fase é obrigatória? | Toda trilha tem pelo menos 1 fase. Uma lista colada sem fase cai numa fase padrão (`General` / `Geral`) |
| Modelo de amizade | Pedido e aceite, mútuo. "Seguir" é outra coisa e vale só para **trilhas** |
| Feed e "boa!" | Entram no MVP, porque as telas foram aprovadas |
| Login | Google e GitHub em produção; e-mail e senha só em dev e nos testes |

---

## 2. Idiomas (i18n)

- `@nuxtjs/i18n`, com os locales **`en`** (padrão) e **`pt-BR`**.
- Estratégia `prefix_except_default`: `/tracks` fica em inglês e `/pt-BR/tracks` em português.
- `detectBrowserLanguage` com cookie. A escolha salva no perfil (`profiles.locale`) tem prioridade depois do login.
- **Nenhum texto de UI fica hardcoded.** As chaves ficam em `i18n/locales/{en,pt-BR}.json`, agrupadas por tela (`tracks.card.nextMilestone`).
- Conteúdo criado pelo usuário **não é traduzido**. Datas e números saem via `Intl`, conforme o locale.
- Os testes verificam `data-testid`, nunca o texto traduzido.
- Um script de teste checa que as duas línguas têm exatamente as mesmas chaves.

---

## 3. Modelo de dados (Supabase / Postgres)

Todas as tabelas no schema `public`, com **RLS ligada**. Os ids são `uuid` (`gen_random_uuid()`). Timestamps em `timestamptz`.

### Enums
```sql
track_color      : violet | coral | sky | mint | sun
track_visibility : private | friends | public
evidence_kind    : link | note | file | certificate
friend_status    : pending | accepted
activity_type    : milestone_completed | track_completed | track_started | track_followed
```

### Tabelas
**`profiles`**
- `id` (PK, FK → `auth.users`)
- `handle` (citext, único, `^[a-z0-9_]{3,20}$`)
- `display_name`, `avatar_url`
- `locale` (`en` | `pt-BR`)
- `onboarded_at`, `created_at`
- Criado por trigger em `auth.users`, com handle provisório.

**`tracks`**
- `id`, `owner_id`, `title` (1–80), `goal` (≤ 280), `emoji` (≤ 8), `color`, `target_date` (date, nulo)
- `visibility` (padrão `private`)
- `source_track_id` (nulo, FK → `tracks`, `on delete set null`), `copies_count` (int, padrão 0)
- `created_at`, `updated_at`, `archived_at`

**`phases`**
- `id`, `track_id` (cascade), `title` (1–60), `position` (int)

**`milestones`**
- `id`, `track_id` (cascade), `phase_id` (cascade), `title` (1–140), `tag` (≤ 24, nulo), `position`
- `due_date` (nulo), `completed_at` (nulo), `time_spent_minutes` (nulo, ≥ 0)
- `created_at`, `updated_at`

**`evidences`**
- `id`, `milestone_id` (cascade), `owner_id`, `kind`
- `url` (nulo), `body` (nulo), `learned` (nulo), `storage_path` (nulo)
- `created_at`
- Regra: `link` e `certificate` exigem `url` ou `storage_path`; `file` exige `storage_path`; `note` exige `body`.

**`friendships`**
- `requester_id`, `addressee_id`, `status`, `created_at`, `responded_at`
- PK (`requester_id`, `addressee_id`)
- Check `requester_id <> addressee_id`. Índice único no par não ordenado.

**`track_follows`**
- `user_id`, `track_id`, `created_at`
- PK composta.

**`activities`**
- `id`, `actor_id`, `type`, `track_id`, `milestone_id` (nulo), `created_at`
- Escrita **só por trigger**.

**`kudos`**
- `activity_id` (cascade), `user_id`, `created_at`
- PK composta. Ninguém dá "boa!" na própria atividade.

### Funções (SQL, `security definer`, `search_path` fixo)
- **`are_friends(a uuid, b uuid) → bool`**: amizade `accepted` em qualquer direção.
- **`can_view_track(t tracks) → bool`**: verdadeiro se o usuário é o dono, se a trilha é `public`, ou se é `friends` e `are_friends(owner, auth.uid())`.
- **`copy_track(source uuid) → uuid`**: exige `can_view_track`.
  - Copia a trilha, as fases e os marcos **sem** `completed_at`, `time_spent_minutes` e evidências.
  - A cópia nasce `private`, com `source_track_id` preenchido, e incrementa `copies_count` na origem.
- **`track_progress`** (view): `track_id`, `total`, `done`, `next_milestone_id`, `next_milestone_title`, `last_completed_at`.

### Triggers
- `updated_at` automático em `tracks` e `milestones`.
- **Atividades em `milestones`:**
  - `completed_at` de nulo para valor → grava `milestone_completed`.
  - Quando todos os marcos da trilha ficam concluídos → também grava `track_completed`.
  - Desmarcar um marco apaga a atividade `milestone_completed` correspondente.
- **Outras atividades:**
  - `insert` em `track_follows` → grava `track_followed`.
  - Primeira conclusão de uma trilha → grava `track_started`.

### RLS (resumo)
| Tabela | select | insert / update / delete |
|---|---|---|
| profiles | qualquer autenticado | só o próprio |
| tracks | `can_view_track` | só o dono |
| phases, milestones | `can_view_track` da trilha | só o dono da trilha |
| evidences | `can_view_track` da trilha | só o dono |
| friendships | as duas partes | insert: o requester; update (aceitar): o addressee; delete: qualquer das partes |
| track_follows | o próprio, ou o dono da trilha | o próprio, e só se `can_view_track` |
| activities | o próprio, ou amigos, e só se `can_view_track` da trilha | ninguém (só trigger) |
| kudos | quem pode ver a atividade | o próprio, e só se pode ver a atividade e não é o autor |

### Storage
- Bucket **`evidence`**, privado.
- Caminho: `{user_id}/{milestone_id}/{arquivo}`.
- Escrita só na própria pasta. Leitura por URL assinada, gerada no servidor depois de checar `can_view_track`.
- Limite de 10 MB por arquivo; tipos aceitos: pdf, png, jpg, webp.

---

## 4. Formato de lista (colar e seed)

Um parser único, em `shared/utils/track-list.ts`, função pura com testes. Serve para duas coisas: a opção "Colar uma lista" e o seeder.

```md
# Rumo ao AI-Native
> Passar na certificação AI-Native Developer até 31/10.
emoji: 🤖 | color: violet | due: 2026-10-31 | visibility: public

## Ferramenta
- [x] Revisar os 18 itens do guia #preparo @2026-09-15
## Especificar
- [ ] Reescrever 3 tarefas em critérios mensuráveis #prática @2026-09-18
- Escrever uma spec com casos de borda #prática
```

**Regras**
- **Título e objetivo:** `# ` é o título; `> ` é o objetivo (opcional).
- **Metadados:** a linha de metadados é opcional, com chaves `emoji`, `color`, `due` e `visibility`.
- **Fases:** `## ` abre uma fase. Um marco antes da primeira fase cai na fase padrão.
- **Marcos:** `- `, `* ` ou `- [ ] ` abrem um marco; `- [x] ` já nasce concluído.
- **Tag e data:** `#tag` é a primeira hashtag, e sai do título. `@AAAA-MM-DD` é a data do marco (`due_date`).
  - Em marco já concluído, essa data vira `completed_at`.
- **Colar texto simples:** sem nenhum `#` de título, cada linha não vazia vira um marco.
- **Limites:** até 20 fases e 200 marcos.
- **Erros:** voltam como uma lista `{ line, code }`, com códigos i18n.
- **Serializador inverso:** `toTrackList(track)`, que serve para exportar.

---

## 5. Arquitetura do app

- **Nuxt 4** (`app/`), em TypeScript estrito.
  - `@nuxtjs/supabase` para auth e cliente.
  - `@nuxtjs/i18n` para idiomas.
  - Tailwind 4 (`@tailwindcss/vite`) com os tokens do protótipo em `@theme`.
- **Leituras:** direto do cliente Supabase, protegidas pela RLS.
- **Escritas compostas** (criar trilha com fases e marcos, copiar modelo, upload de evidência): em **server routes** (`server/api/*`) que usam o cliente com a sessão do usuário. Nada roda com a secret key no caminho do usuário.
- **Pastas:**
  - `app/components/<área>/`
  - `app/composables/`
  - `app/pages/`
  - `shared/` (parser, tipos, validação com zod)
  - `server/api/`
  - `supabase/migrations/`
  - `seed/`
- **Tokens de design** (do protótipo aprovado): Figtree 400–900, IBM Plex Mono só para números, cinco cores de trilha com gradiente, cantos de 18–28px, sombras suaves, chips preenchidos, abas em pílula e tema claro e escuro. Respeitar `prefers-reduced-motion`.
- **Acessibilidade:** o toggle de marco é um `button` com `aria-pressed` e o foco é visível.

---

## 6. Seed

- **Comando:** `npm run seed`, usando `SUPABASE_SECRET_KEY` apenas no ambiente local.
  - É **idempotente**: usa ids determinísticos (uuid v5 a partir de `handle` + título).
- **Usuários de demonstração:** Ana, Rafa e Lu, com senha só em dev. Recebem trilhas públicas (`seed/demo/*.md`), amizades aceitas com o dono, conclusões espalhadas nas últimas 20 semanas e kudos.
- **Dono:** `SEED_OWNER_EMAIL` aponta para o usuário real, que precisa ter feito login uma vez. As trilhas dele vêm de `seed/personal/*.md`, pasta que **fica fora do git**.
- **Limpeza:** `npm run seed -- --reset` remove só o que o seed criou.

---

## 7. Qualidade

- **Gates:** `lint` (ESLint via @nuxt/eslint), `typecheck` (nuxi typecheck), `test` (Vitest: parser, progresso, utils, componentes com @nuxt/test-utils) e `i18n:check` (paridade de chaves).
- **E2E:** Playwright no fluxo login → criar trilha colando uma lista → concluir marco com evidência → ver progresso → copiar modelo em Explorar → dar "boa!".
  - Roda contra o projeto Supabase de dev, com o usuário de teste.
- **Segurança:** um SQL de verificação de RLS (`supabase/tests/rls.sql`) confirma que:
  - trilha `private` não aparece para amigos;
  - trilha `friends` não aparece para quem não é amigo;
  - ninguém escreve na trilha de outra pessoa.
- **Git:** um commit por fatia coerente, sempre com os gates verdes.

---

## 8. Ambientes

| Variável | Onde | Uso |
|---|---|---|
| `NUXT_PUBLIC_SUPABASE_URL` | `.env` e Vercel | Cliente |
| `NUXT_PUBLIC_SUPABASE_KEY` | `.env` e Vercel | Publishable key (pública por desenho) |
| `SUPABASE_SECRET_KEY` | **só** `.env` local (seed) e, se necessário, variável de servidor na Vercel | Seed e rotinas de servidor. Nunca no bundle |
| `SEED_OWNER_EMAIL` | `.env` local | Dono das trilhas pessoais do seed |
| `NUXT_PUBLIC_SITE_URL` | `.env` e Vercel | Redirects de OAuth |
