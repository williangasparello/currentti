# Q7 Educação — Prompt de Reconstrução do Projeto

> **O que é este documento**
> Especificação única e detalhada para **reconstruir o sistema Q7 Educação do zero** em outro workspace (ou como referência viva do projeto atual). Cobre identidade, arquitetura, modelo de dados, autenticação, telas, fluxos, edge functions, prompt do agente de IA, integrações, segurança, convenções e checklist de reconstrução.
>
> **Fonte deste documento**
> Reconstruído a partir da especificação de planejamento do projeto e das memórias disponíveis. **Não** foi gerado com acesso ao código-fonte real (`src/`, `supabase/functions/`) nem ao banco de dados vivo neste ambiente.
>
> **Como ler os marcadores**
> - ✅ **Confirmado** — regra/decisão estável do projeto.
> - ⚠️ **Validar no workspace original** — precisa ser confirmado contra o código real, o `supabase/config.toml` ou o banco (via `read_query`) antes de tratar como verdade absoluta. Onde aparece, o valor é a *melhor reconstrução*, não uma certeza.
>
> **Idioma:** português (padrão do projeto).
> **Escopo:** documento combinado — spec técnico **+** briefing de produto.

---

## Índice

1. [Identidade & Marca](#1-identidade--marca)
2. [Público e Proposta de Valor](#2-público-e-proposta-de-valor)
3. [Arquitetura de Alto Nível](#3-arquitetura-de-alto-nível)
4. [Modelo de Dados](#4-modelo-de-dados)
5. [Autenticação & Autorização](#5-autenticação--autorização)
6. [Navegação, Rotas e Layout](#6-navegação-rotas-e-layout)
7. [Fluxos Principais](#7-fluxos-principais)
8. [Edge Functions / Backend](#8-edge-functions--backend)
9. [Prompt do Agente SDR / IA](#9-prompt-do-agente-sdr--ia)
10. [Integrações Externas](#10-integrações-externas)
11. [Segurança](#11-segurança)
12. [Convenções de Código](#12-convenções-de-código)
13. [Secrets Necessários](#13-secrets-necessários)
14. [Checklist para Recriar em Outro Workspace](#14-checklist-para-recriar-em-outro-workspace)
15. [Pendências de Validação](#15-pendências-de-validação-consolidado)

---

## 1. Identidade & Marca

### 1.1 Nome e posicionamento
- **Nome do produto:** **Q7 Educação**. ✅
- **Posicionamento:** plataforma de CRM com **agente de IA (SDR)** que atende leads via **WhatsApp**, qualifica, negocia e organiza o funil de vendas para o negócio de educação da Q7. ⚠️ *validar a frase-posicionamento oficial no workspace original.*

### 1.2 Identidade visual
- **Tema:** claro (light). ✅
- **Cor primária (teal):** `#3FB8BE`. ✅
- **Paleta de apoio:** tons de cinza para superfícies, textos e bordas. ⚠️ *validar os valores exatos dos cinzas em `index.css` / `tailwind.config.ts`.*
- **Logo:** logotipo **Q7**. ⚠️ *validar arquivo/asset e uso (SVG, tamanhos, versão clara/escura).*

### 1.3 Nomes legados PROIBIDOS
Estes nomes são de fases/produtos anteriores e **não podem aparecer** em UI, copy, código visível ao usuário, prompts ou documentação do produto:
- ❌ **Núcleo**
- ❌ **Inov4**

> Observação: o e-mail do super admin (`marcos@nucleo1.com`) contém "nucleo" por ser um endereço real preexistente — isso é um dado de conta, **não** uma referência de marca, e é a única exceção tolerada. Não usar "Núcleo" como nome de produto em lugar nenhum.

---

## 2. Público e Proposta de Valor

- **Para quem:** equipe comercial da Q7 Educação (e, no modelo multiusuário, contas de clientes aprovadas). ⚠️ *validar se é uso interno único ou SaaS multi-tenant.*
- **Dor resolvida:** atendimento e qualificação de leads de WhatsApp em escala, sem depender de resposta manual imediata; centralização das conversas num funil (CRM) e automação do primeiro atendimento por um agente SDR de IA.
- **Proposta de valor:**
  1. Conectar o WhatsApp do negócio.
  2. Um agente de IA atende, qualifica e negocia com os leads automaticamente.
  3. As conversas viram cards num CRM Kanban, com controle humano quando necessário.

---

## 3. Arquitetura de Alto Nível

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend: React + Vite + TypeScript                         │
│  UI: Tailwind CSS + shadcn/ui                                │
│  Estado/dados: cliente Supabase (Lovable Cloud)              │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Lovable Cloud (Supabase gerenciado)                         │
│   • Postgres (schema public + private)                       │
│   • Auth (signup/login, sessão JWT)                          │
│   • Edge Functions (Deno) — ver seção 8                      │
│   • RLS em todas as tabelas de dados                         │
└───────┬───────────────────────┬───────────────────┬──────────┘
        │                       │                   │
        ▼                       ▼                   ▼
  UaiZapi (WhatsApp)     Lovable AI Gateway     N8N (webhooks/
  instâncias, envio,     (modelo LLM do          automações
  webhooks de mensagens  agente SDR)             legadas/fallback)
```

- **Frontend:** React + Vite + TypeScript, Tailwind + shadcn/ui. ✅
- **Backend/plataforma:** **Lovable Cloud** — provê banco Postgres, autenticação e edge functions (Supabase gerenciado). ✅
- **Integrações externas:**
  - **UaiZapi** → camada de WhatsApp (instâncias, envio/recebimento). ✅
  - **Lovable AI Gateway** → LLM que roda o agente SDR. ✅
  - **N8N** → automações externas / webhooks legados (fallback). ✅

---

## 4. Modelo de Dados

> ⚠️ **Aviso importante:** a lista de tabelas, colunas, FKs e policies abaixo é a **melhor reconstrução** a partir da especificação. Sem acesso ao banco vivo neste ambiente, **cada tabela/coluna deve ser confirmada** contra `supabase/migrations/*` e/ou `read_query` no workspace original. A planta abaixo descreve a *intenção* do modelo.

### 4.1 Princípios do modelo
- **RLS obrigatória** em toda tabela que contém dados de usuário. ✅
- **Papéis (roles) NUNCA ficam na tabela de perfil.** Existe uma **tabela separada de papéis** (`user_roles`) + **enum `app_role`**. ✅
- Autorização é feita por **função `has_role()`** (SECURITY DEFINER), nunca por checagem de coluna em `profiles`. ✅

### 4.2 Enum e papéis
```sql
-- enum de papéis da aplicação
create type public.app_role as enum ('admin', 'user');  -- ⚠️ validar os valores exatos (ex.: 'super_admin'?)

-- papéis por usuário (tabela SEPARADA de profiles)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;
```
⚠️ *Validar: nomes exatos do enum, se há papel `super_admin` distinto de `admin`, e as colunas reais.*

### 4.3 Tabelas principais esperadas
Relações esperadas entre as entidades do produto:

| Tabela (esperada) | Propósito | Relações-chave |
|---|---|---|
| `profiles` | Perfil do usuário (nome, dados de conta, status de aprovação/paywall). **Sem papéis.** | 1:1 com `auth.users` |
| `user_roles` | Papéis do usuário (`admin`/`user`). | N:1 com `auth.users` |
| `sdr_configs` | Configuração do agente SDR por usuário/conta (persona, empresa, produtos, estilo, etc.). | N:1 com usuário |
| `ai_prompts` | Prompts/blocos de prompt salvos, usados para montar o prompt do agente. | relaciona com `sdr_configs`/usuário |
| `whatsapp_instances` | Instâncias de WhatsApp conectadas via UaiZapi (token, status, telefone). | N:1 com usuário |
| `chats` / `conversations` | Conversas de WhatsApp sincronizadas. | N:1 com instância/usuário |
| `messages` | Mensagens individuais dentro de cada chat. | N:1 com chat |
| `leads` | Leads/contatos qualificados. | relaciona com chats/CRM |
| `crm_cards` / `crm_stages` | Cards e estágios do funil Kanban. | N:1 com lead/usuário |
| `app_settings` | Configurações globais da aplicação (admin-only). | global |

⚠️ **Validar:** nomes reais das tabelas, número total (a spec original menciona ~14 tabelas no schema `public`), todas as colunas, tipos, FKs, defaults e índices. Tratar a tabela acima como *mapa conceitual*, não DDL final.

### 4.4 Funções internas
```sql
-- checagem de papel — SECURITY DEFINER, evita recursão de RLS
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- trigger de criação de usuário: cria profile e papel default ao registrar
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, ...) values (new.id, ...);
  -- ⚠️ validar: papel default atribuído no signup (provavelmente 'user' bloqueado até aprovação)
  return new;
end;
$$;
```
⚠️ *Validar corpo real de `has_role` e `handle_new_user`, o schema onde vivem (`public` vs `private` — ver seção 11), e o trigger `on auth.users`.*

---

## 5. Autenticação & Autorização

### 5.1 Fluxo de acesso
1. **Signup / Login** via Supabase Auth. ✅
2. **Novo usuário começa BLOQUEADO** — cai num **paywall / tela de espera** até ser **aprovado por um admin**. ✅
3. **Aprovação por admin** libera o acesso ao app. ✅
4. Após aprovado, usuário faz o **onboarding em 4 passos** (ver 7.4). ✅

### 5.2 Super admin
- **Super admin:** `marcos@nucleo1.com`. ✅
- Tem acesso às telas/ações administrativas, incluindo **aprovação de novos usuários**. ⚠️ *validar como o super admin é identificado — por e-mail hardcoded, por papel `admin` em `user_roles`, ou ambos.*

### 5.3 Regras de autorização
- Toda checagem de permissão passa por **`has_role()`**, nunca por coluna em `profiles`. ✅
- Papéis vivem só em `user_roles`. ✅
- Usuário não-aprovado não acessa dados do produto (garantido por RLS + gate de UI). ⚠️ *validar onde o gate de paywall é aplicado (RLS, edge function, ou só no frontend).*

---

## 6. Navegação, Rotas e Layout

### 6.1 Sidebar (6 itens)
Layout principal com barra lateral de **exatamente 6 itens**: ✅

| # | Item | Propósito da tela |
|---|---|---|
| 1 | **Dashboard** | Visão geral / conversas / métricas. |
| 2 | **Configuração** | Setup inicial e ajustes da conta (onboarding em 4 passos). |
| 3 | **Agente IA** | Configuração do agente SDR: prompt, mídia, controle liga/desliga. |
| 4 | **WhatsApp** | Conexão e gestão de instâncias (UaiZapi). |
| 5 | **CRM** | Funil Kanban de leads. |
| 6 | **Perfil** | Dados do usuário. |

### 6.2 Removidos / ausentes
- ❌ **Prospecção** — não existe / foi removido.
- ❌ **Agenda** — não existe / foi removido.

> Garantir que nenhuma rota, item de menu ou link residual para *Prospecção* ou *Agenda* exista na reconstrução.

### 6.3 Rotas (esperadas)
⚠️ *Validar os paths exatos em `src/App.tsx`.* Estrutura provável:

| Rota | Tela | Acesso |
|---|---|---|
| `/login`, `/signup` | Autenticação | público |
| `/` ou `/dashboard` | Dashboard | aprovado |
| `/configuracao` | Configuração / onboarding | aprovado |
| `/agente` | Agente IA | aprovado |
| `/whatsapp` | WhatsApp / instâncias | aprovado |
| `/crm` | CRM Kanban | aprovado |
| `/perfil` | Perfil | aprovado |
| `/aguardando` (ou similar) | Paywall/espera | logado, não-aprovado |
| `/admin` (ou seção) | Aprovação de usuários | admin |

---

## 7. Fluxos Principais

### 7.1 Login / Autenticação
Signup e login via Supabase Auth; sessão JWT; redirecionamento conforme status (aprovado → app; pendente → paywall). ⚠️ *validar mensagens de erro traduzidas (`translateError`).*

### 7.2 Paywall (novo usuário)
Após signup, o usuário não-aprovado vê uma tela de espera/paywall e **não acessa** o restante do app até aprovação.

### 7.3 Aprovação de usuários (admin)
Admin vê a lista de usuários pendentes e **aprova** (concede acesso / atribui papel). ⚠️ *validar se aprovação muda flag em `profiles` ou insere papel em `user_roles`.*

### 7.4 Onboarding / Configuração inicial — 4 passos
Componente tipo **SetupStepper** com 4 etapas. ✅ ⚠️ *validar o conteúdo exato de cada passo.* Reconstrução esperada:
1. Dados do negócio / perfil.
2. Conexão do WhatsApp (instância UaiZapi).
3. Configuração do agente SDR (persona, empresa, produtos).
4. Revisão / ativação.

### 7.5 Conexão de WhatsApp (UaiZapi)
- Criar/registrar **instância** de WhatsApp.
- Exibir **QR code** / status de conexão.
- Persistir a instância em `whatsapp_instances` com token e status. ⚠️ *validar campos e fluxo de QR.*

### 7.6 Configuração do agente SDR / IA
- **Prompt builder:** monta o prompt do agente a partir de `sdr_configs` + `ai_prompts` (ver seção 9).
- **Upload de mídia:** materiais que o agente pode enviar. ⚠️ *validar storage/bucket.*
- **Controle do agente:** liga/desliga o agente por conversa/instância. ⚠️ *validar granularidade (global vs por chat).*

### 7.7 CRM Kanban
- Colunas do funil: **Conversas → Negociando → Ganho → Perda**. ✅ ⚠️ *validar nomes exatos e se são configuráveis.*
- Cards movíveis entre estágios (drag & drop).

### 7.8 Sincronização WhatsApp → CRM
- Mensagens recebidas via webhook são sincronizadas em `chats`/`messages` e refletidas como cards/leads no CRM. ⚠️ *validar a função e o gatilho de sincronização.*

### 7.9 Chat / Dashboard de conversas
- Visualização de conversas **somente leitura (read-only)** no dashboard. ✅ ⚠️ *validar se há qualquer ação de envio manual a partir daí.*

---

## 8. Edge Functions / Backend

### 8.1 Padrões obrigatórios (todas as funções)
- **Resposta sempre HTTP 200** com corpo padronizado: ✅
  ```json
  { "ok": true,  "data": { ... }, "error": null }
  { "ok": false, "data": null,    "error": "mensagem" }
  ```
  (Erros de negócio vão no corpo, não no status HTTP.)
- **Parsing seguro:** sempre `await response.text()` **antes** de `JSON.parse()` — nunca `response.json()` direto, para não quebrar com corpo vazio/HTML. ✅
- **`verify_jwt`** ligado por padrão; **`verify_jwt=false` apenas** para webhooks que recebem chamadas externas sem sessão. ✅
- Secrets lidos de variáveis de ambiente, **nunca hardcoded**. ✅

### 8.2 Categorias de funções esperadas
⚠️ *A spec original cita ~12 edge functions. Sem o `supabase/functions/` real, listo as categorias esperadas — validar nomes, quantidade, I/O e `verify_jwt` de cada uma em `supabase/config.toml`.*

| Categoria | Propósito | `verify_jwt` esperado |
|---|---|---|
| **Conexão WhatsApp** | Criar instância, obter QR/status na UaiZapi. | `true` |
| **Webhook WhatsApp** | Receber mensagens/eventos da UaiZapi. | **`false`** (externo) |
| **Envio de mensagens** | Enviar mensagem WhatsApp via UaiZapi. | `true` |
| **Sincronização de chats** | Persistir conversas/mensagens no banco e refletir no CRM. | `true` ou `false` conforme origem |
| **Agente IA / SDR** | Montar prompt, chamar Lovable AI Gateway, gerar resposta do agente. | `true`/`false` conforme gatilho |
| **Integrações N8N** | Disparar/receber webhooks de automação externa. | `false` para entrada externa |
| **Administração / aprovação** | Aprovar usuários, ações admin-only. | `true` |

Para **cada função**, documentar no workspace original: propósito, input, output (`{ok,data,error}`), secrets usados e `verify_jwt`.

---

## 9. Prompt do Agente SDR / IA

### 9.1 Como o prompt é montado
- O prompt é **dinâmico**, montado em tempo de execução a partir de **`sdr_configs`** (config estruturada) + **`ai_prompts`** (blocos/textos salvos). ✅
- Existe um builder (esperado: `buildPromptFromSdrConfig`) que concatena os blocos em ordem definida, com **fallbacks** quando um campo está vazio. ⚠️ *validar nome e implementação real do builder e a ordem exata.*

### 9.2 Ordem/estrutura esperada dos blocos
⚠️ *validar contra o builder real:*
1. **Persona / nome do agente** (quem ele é).
2. **Papel** (SDR — qualificar e conduzir a conversa).
3. **Contexto da empresa** — Q7 Educação (o que é, o que vende).
4. **Produtos / ofertas**.
5. **Regras de atendimento via WhatsApp** (tom, tamanho de mensagem, cadência).
6. **Uso de dados do lead** (nome, histórico da conversa).
7. **Critérios de qualificação** (o que perguntar / como classificar).
8. **Estilo de comunicação** (formalidade, emojis, voz da marca).
9. **Limites e comportamento seguro** (o que não fazer, não inventar, não prometer).
10. **Encaminhamento humano** — quando e como transferir para atendente.

### 9.3 Princípios de comportamento
- Não inventar informações; usar apenas o contexto da Q7 e do lead.
- Respeitar a marca (nunca citar nomes legados — seção 1.3).
- Escalar para humano em casos fora do escopo/negociação sensível.

> **Conteúdo real dos prompts salvos no banco:** não exportável neste ambiente (sem MCP do Supabase). ⚠️ *Para incluir o texto real de `ai_prompts`/`sdr_configs`, rodar `read_query` no workspace original.*

---

## 10. Integrações Externas

### 10.1 UaiZapi (WhatsApp)
- Camada de instâncias, envio e recebimento de mensagens de WhatsApp.
- Autenticação por **token** de instância. ⚠️ *validar endpoints, base URL e formato de token.*
- Webhooks de entrada apontam para a edge function de webhook (com `verify_jwt=false`).

### 10.2 Lovable AI Gateway
- Gateway de LLM que roda o agente SDR. ✅
- ⚠️ *validar modelo padrão e política de fallback (modelo secundário, timeout, retries).*

### 10.3 N8N
- Automações externas / webhooks **legados**, usados como **fallback**/orquestração. ✅ ⚠️ *validar quais fluxos ainda dependem de N8N vs migrados para edge functions.*

---

## 11. Segurança

### 11.1 RLS e GRANTs
- **RLS habilitada** em todas as tabelas de dados. ✅
- Políticas administrativas **nunca** com `USING (true)** — sempre condicionadas por `has_role(auth.uid(), 'admin')`. ✅
- GRANTs padrão revisados; funções sensíveis **não expostas** a `anon`/`authenticated` quando não devem ser. ✅

### 11.2 Isolamento de `has_role`
- `has_role` como **SECURITY DEFINER** para evitar recursão de RLS. ✅
- ⚠️ *validar se `has_role` vive em schema `private` (recomendado) e não é chamável diretamente por `anon`/`authenticated`.*

### 11.3 Regras invioláveis
- Papéis **só** em `user_roles`, **nunca** em `profiles`. ✅
- Novos usuários começam **bloqueados** (paywall) até aprovação. ✅
- Webhooks com `verify_jwt=false` **apenas** quando estritamente necessário (entrada externa). ✅
- Segredos privados **nunca** no código nem no repositório. ✅

### 11.4 Correções recentes conhecidas
- `app_settings` tornada **admin-only**. ✅
- **Revokes** de permissões excessivas em funções/tabelas sensíveis. ✅
- ⚠️ *validar a lista completa de migrações de segurança no workspace original.*

---

## 12. Convenções de Código

- **Design tokens no `index.css`** (variáveis CSS / tema shadcn). **Nunca** cores hardcoded em componentes — usar tokens (`--primary`, etc.). Cor primária teal `#3FB8BE` definida como token. ✅
- **Erros/toasts traduzidos** via helper `translateError` — mensagens de erro sempre em português para o usuário. ✅ ⚠️ *validar localização do helper.*
- **Edge functions:** resposta HTTP 200 padronizada `{ok,data,error}` + parse seguro com `text()` antes de `JSON.parse()` (ver 8.1). ✅
- **UI:** shadcn/ui + Tailwind; componentes reutilizáveis. ✅
- **Sem nomes legados** (Núcleo, Inov4) em nenhum lugar visível. ✅

---

## 13. Secrets Necessários

⚠️ *Listar apenas os **nomes** das variáveis — nunca os valores. Validar o conjunto real no painel de secrets do workspace original.*

| Secret (nome esperado) | Uso |
|---|---|
| `UAIZAPI_TOKEN` / `UAIZAPI_BASE_URL` | Autenticação e base da UaiZapi (WhatsApp). |
| `LOVABLE_AI_*` (gateway key) | Chamada ao Lovable AI Gateway (agente SDR). |
| `N8N_WEBHOOK_URL` / `N8N_*` | Webhooks/automação N8N. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Cliente e funções (service role só no backend). |

> Nunca commitar valores. Nunca expor `SERVICE_ROLE_KEY` no frontend.

---

## 14. Checklist para Recriar em Outro Workspace

- [ ] **1. App base** — React + Vite + TS, Tailwind + shadcn/ui.
- [ ] **2. Identidade visual** — tema claro, teal `#3FB8BE` como token em `index.css`; logo Q7; sem nomes legados.
- [ ] **3. Banco e RLS** — criar tabelas (seção 4), enum `app_role`, `user_roles` separada, `has_role`, `handle_new_user`, RLS em tudo.
- [ ] **4. Autenticação e fluxo admin** — signup/login, paywall para novos usuários, aprovação por admin, super admin `marcos@nucleo1.com`.
- [ ] **5. Páginas e sidebar** — 6 itens (Dashboard, Configuração, Agente IA, WhatsApp, CRM, Perfil); **sem** Prospecção/Agenda.
- [ ] **6. Edge functions** — categorias da seção 8, padrão `{ok,data,error}` + parse seguro, `verify_jwt` correto por função.
- [ ] **7. Integrações** — UaiZapi (WhatsApp), Lovable AI Gateway (IA), N8N (automação); configurar secrets por nome.
- [ ] **8. Prompt do agente** — builder a partir de `sdr_configs`+`ai_prompts` na ordem da seção 9.
- [ ] **9. Testar webhooks e WhatsApp** — conexão de instância, QR, recebimento, envio.
- [ ] **10. Testar CRM e agente** — sincronização conversa→card, funil Conversas/Negociando/Ganho/Perda, agente respondendo e escalando para humano.

---

## 15. Pendências de Validação (consolidado)

Itens marcados ⚠️ que devem ser confirmados no **workspace original** (via código real, `supabase/config.toml`, e `read_query` no banco):

1. **Modelo de dados** — nomes/colunas/FKs reais de todas as tabelas (spec cita ~14); confirmar a lista da seção 4.3 como DDL.
2. **Enum `app_role`** — valores reais (existe `super_admin`?).
3. **`has_role` / `handle_new_user`** — corpo real, schema (`public` vs `private`), trigger.
4. **Identificação do super admin** — e-mail hardcoded vs papel em `user_roles`.
5. **Gate de paywall** — onde é aplicado (RLS, edge function, frontend).
6. **Rotas** (`src/App.tsx`) — paths exatos.
7. **SetupStepper** — conteúdo real dos 4 passos.
8. **Edge functions** — nomes, quantidade exata (~12), I/O, secrets e `verify_jwt` de cada (`supabase/config.toml`).
9. **Builder do prompt** — nome real (`buildPromptFromSdrConfig`?) e ordem/fallbacks exatos.
10. **Conteúdo real dos prompts** — exportar `ai_prompts`/`sdr_configs` via `read_query`.
11. **UaiZapi** — endpoints, base URL, formato do token.
12. **Lovable AI Gateway** — modelo padrão e fallback.
13. **N8N** — fluxos ainda ativos.
14. **Design tokens** — valores exatos dos cinzas e nome dos tokens em `index.css`/`tailwind.config.ts`.
15. **Migrações de segurança** — lista completa (revokes, `app_settings` admin-only, etc.).
16. **CRM** — nomes exatos dos estágios e se são configuráveis.

---

*Documento gerado como spec de reconstrução. Não altera lógica do app, banco, funções ou segurança. Onde um detalhe real não estava disponível, foi marcado como "validar no workspace original" em vez de afirmado como certeza.*
