-- =============================================================================
-- Q7 Educação — schema inicial
-- Convenções de segurança (docs/PROJECT_PROMPT.md §11):
--   * RLS habilitada em todas as tabelas de dados
--   * papéis NUNCA em profiles -> tabela separada user_roles + enum app_role
--   * autorização via has_role() SECURITY DEFINER (schema private, não exposto)
--   * políticas admin condicionadas por has_role(), nunca USING (true)
-- =============================================================================

-- ---- enum de papéis ---------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

-- ---- status de acesso do usuário -------------------------------------------
do $$ begin
  create type public.profile_status as enum ('pending', 'approved', 'blocked');
exception when duplicate_object then null; end $$;

-- ---- profiles (SEM papéis) --------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  status public.profile_status not null default 'pending',
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ---- user_roles (tabela SEPARADA de papéis) --------------------------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- ---- has_role() em schema PRIVATE, SECURITY DEFINER (evita recursão de RLS) --
create schema if not exists private;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
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

-- wrapper público chamável via RPC pelo frontend (checa só o próprio usuário ou admin)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_role(_user_id, _role);
$$;

revoke all on function private.has_role(uuid, public.app_role) from anon, authenticated;

-- ---- trigger: cria profile no signup ---------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'pending'                        -- novo usuário começa bloqueado (paywall)
  );
  -- papel default 'user' (acesso liberado só após aprovação de admin)
  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Tabelas de produto
-- =============================================================================
create table if not exists public.sdr_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  agent_name text not null default 'Sofia',
  company_context text not null default '',
  products text not null default '',
  qualification_criteria text not null default '',
  communication_style text not null default '',
  handoff_rules text not null default '',
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.sdr_configs enable row level security;

create table if not exists public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  status text not null default 'disconnected',
  external_id text,                 -- id da instância na UaiZapi
  created_at timestamptz not null default now()
);
alter table public.whatsapp_instances enable row level security;

create table if not exists public.crm_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_name text not null,
  phone text not null,
  stage text not null default 'conversas',   -- conversas|negociando|ganho|perda
  last_message text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.crm_cards enable row level security;

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instance_id uuid references public.whatsapp_instances(id) on delete set null,
  lead_name text not null default '',
  phone text not null,
  last_message text not null default '',
  unread int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.chats enable row level security;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  "from" text not null,             -- 'lead' | 'agent'
  text text not null,
  at timestamptz not null default now()
);
alter table public.messages enable row level security;

-- app_settings global (admin-only) — docs §11.4
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
