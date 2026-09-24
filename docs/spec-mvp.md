# Zero to Hero — Spec do MVP

Atualizado: 2026-09-23 · status: **MVP implementado e publicado no `main`** (ver §9). Os próximos passos estão em `docs/roadmap.md`.

> **O produto em uma frase:** qualquer pessoa cria uma trilha de estudo, divide em fases e marcos, e vai concluindo cada marco. Pode anexar evidências, usar trilhas públicas como modelo e acompanhar amigos.

Protótipo aprovado (6 telas): artefato "The Way Out", nome antigo do projeto.

---

## 1. Escopo

### Entra no MVP
| Tela | Rota | O que faz |
|---|---|---|
| Landing | `/` | Apresenta o app a quem não está logado e leva ao login |
| Login | `/login` | OAuth (Google, GitHub). Em dev, também e-mail e senha para o usuário de teste. No modo demo, só o botão do demo |
| Confirmação | `/confirm` | Volta do OAuth, no idioma em que o login começou: aplica o idioma do perfil (se já houve onboarding) e segue para `/tracks` |
| Onboarding | `/welcome` | Escolher o handle, o nome exibido e o idioma. Acontece uma vez só |
| Minhas trilhas | `/tracks` | Cards com capa, anel de progresso, próximo marco e resumo da semana |
| Criar trilha | `/tracks/new` | Identidade (nome, objetivo, data, emoji, cor, visibilidade) e editor de fases e marcos. Três formas de começar: em branco, de um modelo ou colando uma lista |
| Editar trilha | `/tracks/:id/edit` | Mesmo editor, aplicado a uma trilha existente |
| Trilha | `/tracks/:id` | Caminho vertical de fases e marcos, com toggle de conclusão, anel de progresso, próximo marco, seguidores e últimas evidências |
| Concluir marco | *sheet* sobre `/tracks/:id` | Evidência opcional (link, nota, arquivo, certificado, nenhuma), o que aprendeu, data e tempo gasto. Termina na tela de comemoração |
| Explorar | `/explore` | Trilhas públicas e as de amigos, com busca (título e objetivo), filtros (populares, de amigos, recentes) e a ação "usar como modelo" |
| Amigos | `/friends` | Feed de atividades dos amigos, "boa!" (kudos) e pedidos de amizade |
| Perfil | `/u/:handle` | Estatísticas, mapa de 20 semanas e trilhas visíveis para quem está vendo |
| Ajustes | `/settings` | Idioma, handle, nome exibido e sair. No modo demo, também "recomeçar o demo" |
| Erro | qualquer rota desconhecida | 404 localizada, com volta para as trilhas ou para o início |

### Fica fora do MVP (agora planejado em `docs/roadmap.md`)
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
- `detectBrowserLanguage` com cookie. Logo após o login, quem já fez o onboarding recebe o idioma salvo no perfil (`profiles.locale`); quem está chegando mantém o idioma em que entrou; depois disso vale a última escolha, no seletor do topo (cookie) ou em Ajustes (cookie e perfil).
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
- Regra: `link` exige `url` http(s); `certificate` exige `url` ou `storage_path`; `file` exige `storage_path`; `note` exige `body`.
- Limites: `url` ≤ 2048; `body` e `learned` ≤ 4000.
- `storage_path` é exatamente `{owner}/{milestone}/{arquivo}`, sem `..` nem subpastas: a URL do storage é normalizada, e um `../` levaria a outra pasta.
- Uma trilha tem no máximo 20 fases e 200 marcos, também no banco.

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
- **`owns_track(p_track_id uuid) → bool`**: o usuário é o dono.
- **`can_view_track(p_track_id uuid) → bool`**: verdadeiro se o usuário é o dono, se a trilha é `public`, ou se é `friends` e `are_friends(owner, auth.uid())`.
- **`copy_track(source uuid) → uuid`**: exige `can_view_track`.
  - Copia a trilha, as fases e os marcos **sem** `completed_at`, `time_spent_minutes`, `target_date`, `due_date` e evidências.
  - A cópia nasce `private`, com `source_track_id` preenchido, e incrementa `copies_count` na origem só quando a pessoa ainda não tem outra cópia dela (o contador mede pessoas, não chamadas).
- **`create_track(payload)` / `update_track(p_id, payload)`** (`security invoker`): escrita composta de trilha, fases e marcos numa chamada.
- **`complete_milestone(p_id, p_completed_at, p_minutes, p_evidence) → bool`** (`security invoker`): conclui e grava a evidência na mesma transação; `false` se já estava concluído.
- **`reopen_milestone(p_id) → text[]`** (`security invoker`): reabre, apaga as evidências e devolve os caminhos de arquivo para remover do storage.
- **`sync_track_completed(p_track)`** (interna) e **`record_track_completed(p_track)`**: mantêm o `track_completed` (ver Triggers).
- **`track_progress`** (view): `track_id`, `total`, `done`, `next_milestone_id`, `next_milestone_title`, `last_completed_at`.

### Triggers
- `updated_at` automático em `tracks` e `milestones`.
- **Atividades em `milestones`:**
  - `completed_at` de nulo para valor, ou marco inserido já concluído → grava `milestone_completed`; a primeira conclusão da trilha também grava `track_started`.
  - Desmarcar um marco apaga a atividade `milestone_completed` correspondente.
  - `track_completed` é mantido por `sync_track_completed`: existe uma vez só, enquanto todos os marcos (≥ 1) estão concluídos, com a data da última conclusão. Some quando a trilha deixa de estar completa, inclusive ao inserir ou remover marcos.
- **Outras atividades:** `insert` em `track_follows` grava `track_followed`; deixar de seguir apaga essa atividade.
- **Guardas:** as partes de uma amizade são imutáveis e o status só vai de `pending` para `accepted`; `copies_count` e `source_track_id` vindos do cliente são ignorados; `completed_at` ≤ agora + 1 dia; no máximo 20 fases e 200 marcos por trilha.

### RLS (resumo)
| Tabela | select | insert / update / delete |
|---|---|---|
| profiles | qualquer autenticado | update: só o próprio; insert por trigger; delete só em cascata de `auth.users` |
| tracks | `can_view_track` | só o dono |
| phases, milestones | `can_view_track` da trilha | só o dono da trilha |
| evidences | `can_view_track` da trilha | só o dono |
| friendships | as duas partes | insert: o requester; update (aceitar): o addressee; delete: qualquer das partes |
| track_follows | quem pode ver a trilha (a tela mostra os seguidores) | o próprio, e só se `can_view_track` |
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
- **Metadados:** a linha de metadados é opcional, com chaves `emoji`, `color`, `due` e `visibility` (em minúsculas), só antes da primeira fase ou marco.
- **Fases:** `## ` abre uma fase. Um marco antes da primeira fase cai na fase padrão.
- **Marcos:** `- `, `* `, `+ `, `1.` ou `1)` abrem um marco, com `[ ]`, `[x]` ou `[X]` opcional; `[x]` já nasce concluído. Em modo estruturado, uma linha solta também vira marco.
- **Tag e data:** `#tag` é a primeira hashtag que começa com letra, e sai do título (`#42` fica no título). `@AAAA-MM-DD` é a data do marco (`due_date`).
  - Em marco já concluído, essa data vira `completed_at`. Data de conclusão depois de hoje (no calendário local) gera `future_date` e é trocada pela de hoje.
- **Colar texto simples:** sem título, fase, item de lista ou `>`, cada linha não vazia vira marco (tag e data continuam valendo).
- **Limites:** até 20 fases e 200 marcos. Textos: título 80, objetivo 280, fase 60, marco 140, tag 24 (acima disso, cortado com `too_long`); emoji cortado em 8.
- **Erros:** voltam como uma lista `{ line, code, value? }`, com códigos i18n.
- **Serializador inverso:** `toTrackList(track)`, testado em ida e volta; nenhuma tela exporta ainda.

---

## 5. Arquitetura do app

- **Nuxt 4** (`app/`), em TypeScript estrito.
  - `@nuxtjs/supabase` para auth e cliente.
  - `@nuxtjs/i18n` para idiomas.
  - Tailwind 4 (`@tailwindcss/vite`) com os tokens do protótipo em `@theme`.
- **Leituras:** direto do cliente Supabase, protegidas pela RLS.
- **Escritas compostas** vão por **RPCs SQL**, não por server routes: `create_track`, `update_track`, `complete_milestone` e `reopen_milestone` (`security invoker`) e `copy_track` (`security definer`).
  - São atômicas numa chamada, rodam sob a RLS do usuário e são testadas no PGlite.
  - O upload de evidência vai direto do cliente para o Storage, na pasta do próprio usuário. Os arquivos saem do bucket quando a evidência some (reabrir, remover marco, apagar trilha).
  - A secret key só é usada em `GET /api/evidence/:id/file`, que assina a URL (300 s) depois que a RLS de `evidences` libera a leitura.
- **Dados carregados no cliente** (`useAsyncData({ server: false })`). O SSR renderiza o esqueleto da página; SSR com dados fica para depois.
- **Camada de dados:** a interface `DataRepository` (`app/repositories/types.ts`) tem duas implementações.
  - `supabase.ts`.
  - `demo.ts`: em memória no navegador, semeado por `seed/demo/*.md` e persistido no `localStorage`.
- **Modo demo** (`NUXT_PUBLIC_DATA_MODE=demo`, o padrão quando não há URL do Supabase):
  - roda o app inteiro sem backend;
  - entra-se pelo botão "Ver a demo" na landing ou no login;
  - a proteção de rotas fica em `app/middleware/auth.global.ts` e vale para os dois modos.
- **Pastas:**
  - `app/components/<área>/`
  - `app/composables/`
  - `app/pages/`
  - `app/repositories/`
  - `app/utils/`
  - `server/api/`
  - `shared/` (parser, progresso, tipos)
  - `supabase/migrations/`
  - `seed/`
  - `scripts/`
- **Tokens de design** (do protótipo aprovado): Figtree 400–900, IBM Plex Mono só para números, cinco cores de trilha com gradiente, cantos de 18–28px, sombras suaves, chips preenchidos, abas em pílula e tema claro e escuro. Respeitar `prefers-reduced-motion`.
- **Acessibilidade:** o toggle de marco é um `button` com nome fixo e `aria-pressed`; seguir e aplaudir levam o estado no texto; erros de formulário ficam ligados ao campo; o foco é visível e volta para quem abriu cada diálogo.

---

## 6. Seed

- **Comando:** `npm run seed`, usando `NUXT_SUPABASE_SECRET_KEY` do `.env` local. `npm run seed -- --dry-run` só lê os arquivos e mostra o plano.
  - É **idempotente**: usa ids determinísticos (uuid v5 a partir do caminho do arquivo da trilha, como `demo/01-x.md`, e da posição de fases e marcos). Renomear o arquivo cria outra trilha; `--reset` limpa.
- **Usuários de demonstração:** Ana, Rafa, Lu (handle `luiza`), Bruno, Carla e um usuário `e2e`, todos com e-mail `@demo.zerotohero.local` e a senha `SEED_DEMO_PASSWORD` (mínimo de 8 caracteres).
  - Arquivos `seed/demo/<handle>.<slug>.md`: o prefixo é o dono. A persona "Alex" (`alex.*`) existe só no modo demo do navegador e o seed a ignora.
  - Datas deslocadas para que a conclusão mais recente caia ontem.
  - Amizades: Ana–Rafa, Lu–Ana, Lu–Rafa e e2e–Ana; o dono fica amigo de Ana, Rafa e Lu, e Bruno manda a ele um pedido pendente. Bruno e Carla não têm trilhas.
  - Ana e Lu aplaudem toda trilha demo concluída.
- **Dono:** `SEED_OWNER_EMAIL` aponta para o usuário real, que precisa ter feito login uma vez. As trilhas dele vêm de `seed/personal/*.md`, pasta que **fica fora do git**.
- **Limpeza:** `npm run seed -- --reset` apaga as contas de demonstração inteiras (inclusive o que o usuário `e2e` criou) e as trilhas pessoais do seed.

---

## 7. Qualidade

- **Gates (`npm run gates`):** `sfc:check` (parse dos componentes), `lint` (ESLint via @nuxt/eslint), `typecheck` (nuxi typecheck), `i18n:check` (paridade de chaves e chaves sem uso) e `test` (Vitest no ambiente node: unitários em `tests/unit/`, SQL e RLS em `tests/db/`).
- **E2E:** Playwright em modo demo: criar trilha colando uma lista, concluir marco com evidência, reabrir, copiar modelo, aplaudir, trocar idioma, 404, meta por idioma. O CI roda gates, build e E2E.
- **Segurança:** testes de SQL e RLS no PGlite (`tests/db/*.test.ts`) confirmam, entre outros, que:
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
| `NUXT_SUPABASE_SECRET_KEY` | `.env` local e variável de **runtime** do servidor na Vercel (não de build) | Assinar URLs de arquivos de evidência e rodar o seed (uma chave só, antes havia `SUPABASE_SECRET_KEY` só para o seed). O `nuxt.config` zera o valor de build, então a chave nunca entra no bundle |
| `SEED_OWNER_EMAIL` | `.env` local | Dono das trilhas pessoais do seed |
| `SEED_DEMO_PASSWORD` | `.env` local | Senha dos usuários de demonstração e do usuário de E2E |
| `SUPABASE_PROJECT_REF` | `.env` local | `supabase link` e `npm run db:types` |
| `NUXT_PUBLIC_DATA_MODE` | `.env` e Vercel | `demo` ou `supabase` (padrão: `supabase` se houver URL) |
| `NUXT_PUBLIC_DEV_LOGIN` | `.env` (preview/E2E) | Mostra o login por senha fora do `nuxt dev` |
| `NUXT_PUBLIC_SITE_URL` | `.env` e Vercel | Redirect de OAuth (`<site>/confirm` e `<site>/pt-BR/confirm`) e base de URLs no build |
| `NUXT_PUBLIC_I18N_BASE_URL` | Vercel (runtime) | Canonical e `hreflang`; no build vem de `NUXT_PUBLIC_SITE_URL` |
| `E2E_BASE_URL` | CI ou local | Roda o E2E contra um servidor já no ar, sem subir o dev |

---

## 9. Estado da implementação (2026-09-17)

**Feito**
- **Banco:** oito migrations (profiles, core, storage, RPCs, hardening, activity_consistency, reopen_milestone, security_recheck) e 51 testes de SQL/RLS no PGlite.
- **Hardening**, ao longo de nove revisões imparciais em 2026-09-17:
  - as partes de uma amizade são imutáveis;
  - a evidência só pode ficar em marco próprio, com link http(s) e arquivo exatamente em `{owner}/{milestone}/{arquivo}`;
  - os helpers não são expostos ao `anon`, e `are_friends` só responde sobre pares que incluem quem pergunta;
  - `copies_count` e `source_track_id` são ignorados quando vêm do cliente, e o contador mede pessoas;
  - `completed_at` não aceita data no futuro;
  - `complete_milestone` e `reopen_milestone` são atômicos;
  - `track_completed` é único e acompanha o estado da trilha; deixar de seguir limpa o feed;
  - limites de 20 fases e 200 marcos no banco;
  - a secret key é só de runtime.
- **Código compartilhado:** parser e serializador de lista, utilitários de progresso e os dois repositórios; 64 testes unitários.
- **Telas:** todas as da §1, em EN e PT-BR, nos temas claro e escuro, funcionando a partir de 390px.
- **Seed:** idempotente, com `--dry-run` e `--reset`.
- **E2E:** 12 testes Playwright em modo demo (11 de jornada e 1 smoke).

**Ainda não validado contra um Supabase real**
- O repositório Supabase: queries PostgREST e upload no Storage.
- A migration de storage (o PGlite não tem o schema `storage`).
- O fluxo OAuth.
- A rota de URL assinada (`/api/evidence/:id/file`).
- `npm run db:types`, que deve substituir o `shared/types/database.ts` escrito à mão.
