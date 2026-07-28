# CurrentTI Ads

CRM com **agente SDR de IA** para WhatsApp. App **100% local**, sem Lovable.
React + Vite + TypeScript + Tailwind, com backend Supabase **próprio** (opcional).

A especificação completa do produto está em [`docs/PROJECT_PROMPT.md`](docs/PROJECT_PROMPT.md).

---

## Rodar agora (backend real, local)

O app roda com um **servidor real** (Node) que faz autenticação de verdade (login/senha
com hash) e **salva os dados em disco** (`server/data.json`). Não precisa de Docker nem
de contas externas.

```bash
npm install
npm start      # sobe o servidor (porta 8787) + o site (porta 5173) juntos
```

Abra <http://localhost:5173>.

**Conta oficial (já criada):**

| Papel | E-mail | Senha |
|---|---|---|
| Administrador | `marcos@nucleo1.com` | `Q7admin2026` |

> Troque a senha depois em **Perfil → Trocar senha**. Você também pode criar novas contas
> em **Criar conta** — elas entram como “pendente” e um administrador aprova na tela **Admin**
> (o e-mail `marcos@nucleo1.com` entra sempre como admin aprovado).

O que funciona de verdade: login/cadastro persistentes, aprovação de usuários, onboarding
em 4 passos, configuração do agente + Playground de IA (Gemini), instâncias de WhatsApp,
e **CRM Kanban com dados reais** (crie leads em “Novo lead”, arraste entre etapas — tudo salvo).

### Rodar em dois terminais (alternativa)

```bash
npm run server   # terminal 1 — API em http://localhost:8787
npm run dev      # terminal 2 — site em http://localhost:5173
```

### Modo demonstração (opcional)

Para uma versão só-frontend com dados de exemplo em memória (útil para publicar como demo),
rode com a variável `VITE_USE_MOCK=true`:

```bash
VITE_USE_MOCK=true npm run dev
```

### Fazer a IA responder (grátis, com Google Gemini)

1. Pegue uma **chave grátis** em <https://aistudio.google.com/app/apikey>.
2. No app, vá em **Agente IA** → cole a chave em *Integração de IA — Google Gemini* → **Testar chave**.
3. Use o **Playground** na mesma tela: escreva como um lead e o agente responde ao vivo,
   usando o prompt montado a partir da configuração.

> A chave fica salva apenas no seu navegador (localStorage) no modo demo. Em produção,
> configure-a como secret no backend (`supabase secrets set GEMINI_API_KEY=...`), nunca no frontend.

### Conectar o WhatsApp (UaiZapi)

Vá em **WhatsApp** → *Conexão UaiZapi (API)* → informe **Base URL** e **Token** da sua conta →
**Testar conexão**. O envio real de mensagens deve passar pela edge function `send-message`
(evita CORS e mantém o token fora do navegador).

---

## Conectar seu Supabase (produção, fora do Lovable)

1. Crie um projeto grátis em <https://supabase.com>.
2. Copie o `.env`:
   ```bash
   cp .env.example .env
   ```
   Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
   Ao preencher, o app **sai do modo mock automaticamente**.
3. Aplique o schema (tabelas, RLS, `has_role`, trigger de signup):
   - Via SQL Editor do Supabase: cole `supabase/migrations/0001_init.sql` e depois
     `supabase/migrations/0002_policies.sql`; **ou**
   - Via CLI:
     ```bash
     npm i -g supabase
     supabase link --project-ref SEU_REF
     supabase db push
     ```
4. Torne-se admin (após se cadastrar pelo app):
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'marcos@nucleo1.com'
   on conflict do nothing;
   ```
5. (Opcional) Suba as edge functions e configure os secrets:
   ```bash
   supabase functions deploy whatsapp-connect send-message ai-agent whatsapp-webhook
   supabase secrets set UAIZAPI_BASE_URL=... UAIZAPI_TOKEN=... LOVABLE_AI_API_KEY=... AI_API_URL=...
   ```

---

## Publicar online (grátis)

Este app é um site estático (Vite SPA) e no modo demo roda **sem backend** — perfeito
para publicar e mostrar. Cada visitante usa a própria chave do Gemini (fica no navegador dele).

> **Importante:** a raiz do projeto é a pasta `CRM-IA/`. Ao conectar o repositório na
> Vercel/Netlify, defina o **Root Directory / Base directory** como `CRM-IA` (se você
> versionar a pasta pai) — ou versione só o conteúdo de `CRM-IA` como raiz do repositório.

### Opção 1 — Vercel (recomendada, mais fácil)

1. Suba o código para o GitHub (veja abaixo).
2. Entre em <https://vercel.com/new> com sua conta GitHub.
3. Importe o repositório. A Vercel detecta **Vite** automaticamente (build `npm run build`,
   saída `dist`). O arquivo `vercel.json` já cuida das rotas SPA.
4. Clique em **Deploy**. Em ~1 min você recebe uma URL `https://seu-app.vercel.app`.

### Opção 2 — Netlify

1. Suba o código para o GitHub.
2. Entre em <https://app.netlify.com/start>, escolha o repositório.
3. Build: `npm run build` · Publish: `dist` (já vem no `netlify.toml`). **Deploy**.

### Opção 3 — Cloudflare Pages

1. <https://pages.cloudflare.com> → conecte o GitHub.
2. Framework preset: **Vite** · Build: `npm run build` · Output: `dist`.

### Subir para o GitHub

O projeto já é um repositório git com um commit inicial. Falta só apontar para o seu GitHub:

```bash
# crie um repositório vazio em https://github.com/new (ex.: q7-educacao)
git remote add origin https://github.com/SEU_USUARIO/q7-educacao.git
git branch -M main
git push -u origin main
```

### Comparação rápida

| Serviço | Grátis | Facilidade | Domínio |
|---|---|---|---|
| **Vercel** | ✅ generoso | ⭐⭐⭐ | `*.vercel.app` |
| **Netlify** | ✅ generoso | ⭐⭐⭐ | `*.netlify.app` |
| **Cloudflare Pages** | ✅ ilimitado | ⭐⭐ | `*.pages.dev` |
| **GitHub Pages** | ✅ | ⭐ (precisa `base` no Vite) | `*.github.io` |

> Para virar um produto real (multiusuário, dados persistentes, WhatsApp de verdade),
> conecte o **Supabase** (seção acima) e faça deploy das edge functions. A hospedagem do
> frontend continua grátis nas opções acima.

## Estrutura

```
src/
  lib/backend/     # camada única de backend: mock (memória) OU supabase (real)
  lib/promptBuilder.ts   # monta o prompt do agente SDR
  hooks/           # useAuth, useToast
  components/      # ui/ (kit), layout/ (sidebar, header), RouteGuards
  pages/           # Login, Signup, Paywall, Dashboard, Configuracao,
                   # AgenteIA, WhatsApp, CRM, Perfil, Admin
  types/domain.ts  # tipos do domínio
supabase/
  migrations/      # schema + RLS + has_role + trigger
  functions/       # edge functions (padrão {ok,data,error}, verify_jwt em config.toml)
docs/PROJECT_PROMPT.md   # especificação completa do produto
```

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção (type-check + Vite)
- `npm run preview` — pré-visualiza o build
- `npm run typecheck` — checagem de tipos

## Convenções

- Cor primária **teal `#3FB8BE`** e demais cores só via tokens em `src/index.css` (nunca hardcoded).
- Erros ao usuário sempre traduzidos (`src/lib/translateError.ts`).
- Sem nomes legados (Núcleo, Inov4) na UI.
- Edge functions: HTTP 200 com `{ ok, data, error }`; parse seguro (`text()` antes de `JSON.parse`).
