# Zero to Hero — Roadmap pós-MVP

Atualizado: 2026-09-23 · status: **Fase 1 em andamento** (1.1 no ar; falta o OAuth)

O MVP da `docs/spec-mvp.md` está pronto. Daqui em diante o produto cresce por fases. Cada item, ao começar, detalha na spec o que muda no modelo de dados, nas telas e nos testes. Esta página guarda a ordem, as decisões já tomadas e o que ainda precisa ser decidido.

**Ordem:** lançar primeiro. Cada fase seguinte já sobe para produção e pode ser testada por outras pessoas.

---

## Fase 1 — Lançamento

### 1.1 Deploy e domínio
- Vercel, em **`zerotohero.battoni.dev`**.
- Variáveis conforme a spec §8. `NUXT_SUPABASE_SECRET_KEY` só em runtime.
- Um checklist de deploy na spec, do projeto zerado ao primeiro login.
- Páginas `/privacidade` e `/termos`, exigidas pelo Google para publicar a tela de consentimento.
- **Pronto quando:** o build de produção roda na Vercel, `/` e `/pt-BR` respondem no domínio, e o CI continua verde.

### 1.2 OAuth Google e GitHub
- Os dois apps de OAuth, os provedores habilitados no Supabase e as redirect URLs `<site>/confirm` e `<site>/pt-BR/confirm`, em local e em produção.
- **Pronto quando:** as duas contas entram, fazem o onboarding e voltam no idioma certo, em produção.

---

## Fase 2 — Base técnica
Vem antes das features porque elas mexem nos mesmos pontos.

### 2.1 Validação unificada
- Hoje os limites e as regras (tamanhos, 20 fases, 200 marcos, datas) se repetem no parser, no editor, no repositório demo e no SQL.
- Uma fonte só em `shared/`, usada pelo parser, pelo editor e pelo demo, e um teste que confere os mesmos números nas `check` do SQL.
- **Pronto quando:** mudar um limite é mudar um arquivo e uma migration, e o teste acusa se os dois divergirem.

### 2.2 Paridade demo × Supabase
- Os dois modos devolvem os mesmos códigos de erro.
- As abas do modo demo não sobrescrevem o estado uma da outra: sincronizar via evento `storage` ou avisar e recarregar.

### 2.3 Bugs pequenos
- Ordem das trilhas no perfil.
- O contador de cópias de um modelo não diminui quando a cópia é apagada.

### 2.4 Testes contra o Supabase real
- Uma suíte de contrato roda o repositório Supabase contra um banco de verdade, com auth, RLS, RPCs e Storage, além do PGlite.
- **Pré-requisito a decidir:** Supabase local exige Docker (ou OrbStack). A alternativa é um segundo projeto na nuvem só para testes.

---

## Fase 3 — Marco e trilha
Um desenho só para os itens 3.1–3.3: uma migration coerente, o formato de lista estendido e o editor atualizado, sempre em ida e volta pelo parser e pelo serializador.

### 3.1 Checklist no marco
- Sub-itens marcáveis dentro do marco, com progresso (`3/18`) no caminho da trilha.
- **Formato de lista:** item indentado sob o marco (`  - [ ] passo`).
- **A decidir no desenho:** concluir todos os sub-itens conclui o marco, ou só sugere concluir?

### 3.2 Notas e links
- Uma descrição curta e links de material em cada marco. Vão junto quando alguém usa a trilha como modelo.

### 3.3 Campos opcionais
- Extensões do marco que não viram tela própria: tempo estimado, custo e um link de referência (prova, voucher, curso).
- **A decidir no desenho:** a lista final de campos e como aparecem no formato de lista.

### 3.4 Exportar como lista
- Botão na trilha que gera o texto no formato de lista, via `toTrackList`, para copiar ou baixar em `.md`.
- Inclui checklist, notas e campos opcionais.

---

## Fase 4 — Páginas públicas e desempenho

### 4.1 SSR com dados
- Trilha pública e perfil renderizados no servidor, com título, descrição e `og:image` para o preview de link, e indexáveis.
- As telas privadas continuam carregando no cliente.

### 4.2 Bundle
- Tirar o supabase-js (~48 KB gz) do bundle do modo demo, carregando o módulo conforme o modo.
- Hospedar Figtree e IBM Plex Mono no próprio app, em vez do Google Fonts.

---

## Fase 5 — Social

### 5.1 Comentários
- Comentar nas atividades do feed e nas trilhas públicas.
- Cada pessoa apaga o próprio comentário; o dono da trilha apaga qualquer um na trilha dele.
- Leitura segue `can_view_track` e `can_view_activity`.

### 5.2 Notificações (só in-app)
- **Decidido:** só dentro do app, com um sininho e uma lista. Sem e-mail e sem push.
- **Eventos:** pedido de amizade, aceite, "boa!" recebido, comentário, e marco vencido. O vencido é calculado na leitura e não precisa de agendador.
- Marcar como lida, uma por uma ou todas.

### 5.3 Trilha com vários donos
- Convidar pessoas para editar a trilha e concluir marcos.
- **A decidir no desenho:** papéis (dono × editor), se a conclusão é da trilha ou de cada pessoa, e o que acontece quando o dono sai.

---

## Fase 6 — IA

### 6.1 Gerador de perguntas
- Gera perguntas de revisão ou de simulado a partir dos marcos, das notas e do checklist de uma trilha.
- **Decidido:** a pessoa traz a própria chave da API do Claude. O app não paga o uso.
- **Proposta de desenho:** a chave fica só no navegador da pessoa e a chamada vai direto do navegador à API, então o servidor do app nunca vê a chave. Precisa ser confirmada no início do item, junto com o modelo padrão e o formato das perguntas.

---

## Fora do roadmap por enquanto
- Notificação por e-mail ou push. Pode voltar depois da 5.2, se o in-app provar valor.
