-- =============================================================================
-- Políticas de RLS — Q7 Educação
-- Padrão: dono do registro acessa o seu; admin acessa tudo via has_role().
-- Nenhuma política com USING (true). (docs/PROJECT_PROMPT.md §11)
-- =============================================================================

-- ---- profiles ---------------------------------------------------------------
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or private.has_role(auth.uid(), 'admin'));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- admin aprova/bloqueia usuários (muda status)
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (private.has_role(auth.uid(), 'admin'))
  with check (private.has_role(auth.uid(), 'admin'));

-- ---- user_roles: leitura própria/admin; escrita só admin --------------------
create policy "user_roles_select" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or private.has_role(auth.uid(), 'admin'));

create policy "user_roles_admin_write" on public.user_roles
  for all to authenticated
  using (private.has_role(auth.uid(), 'admin'))
  with check (private.has_role(auth.uid(), 'admin'));

-- ---- helper de política "dono do registro" ---------------------------------
-- sdr_configs
create policy "sdr_owner_all" on public.sdr_configs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- whatsapp_instances
create policy "wa_owner_all" on public.whatsapp_instances
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- crm_cards
create policy "crm_owner_all" on public.crm_cards
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- chats
create policy "chats_owner_all" on public.chats
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- messages (via chat do dono)
create policy "messages_owner_select" on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.chats c
    where c.id = messages.chat_id and c.user_id = auth.uid()
  ));

-- ---- app_settings: SOMENTE admin (docs §11.4) ------------------------------
create policy "settings_admin_all" on public.app_settings
  for all to authenticated
  using (private.has_role(auth.uid(), 'admin'))
  with check (private.has_role(auth.uid(), 'admin'));

-- =============================================================================
-- GRANTs / revokes de segurança
-- =============================================================================
revoke all on all functions in schema private from anon, authenticated;
