-- ============================================================================
-- RLS — la frontera de aislamiento real. Dos caminos en una sola política:
--   panel    → auth.uid() vía memberships
--   ingress  → current_setting('app.tenant_id') seteado por request (ADR-0002)
--   god-view → flag app_metadata.is_platform_admin en el JWT
-- Ver docs/04-security.md y docs/decisions/0002-rls-on-ingress.md.
-- ============================================================================

-- Tenant actual del ingress. NULL si no se seteó → las políticas no matchean (falla cerrado).
create or replace function app_current_tenant_id()
returns uuid
language sql stable
as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

-- Platform admin: flag en el JWT (vos, dueño de la plataforma).
-- security definer: corre como el dueño (postgres) que sí accede al schema auth, así los
-- roles app_ingress/authenticated no necesitan permisos directos sobre auth. Lee el JWT
-- de la sesión vía GUC, que no cambia bajo definer.
create or replace function app_is_platform_admin()
returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean, false)
$$;

-- Tenants del usuario logueado. security definer para no recursar el RLS de memberships.
create or replace function app_user_tenant_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select tenant_id from memberships where user_id = auth.uid()
$$;

-- Predicado de acceso a un tenant. Cubre los tres caminos.
create or replace function app_can_access_tenant(t uuid)
returns boolean
language sql stable
as $$
  select
    t = app_current_tenant_id()              -- ingress
    or t in (select app_user_tenant_ids())   -- panel
    or app_is_platform_admin()               -- god-view
$$;

-- Resolución de tenant para el ingress: por (channel, account_key) ANTES de setear
-- app.tenant_id (chicken-and-egg). security definer para saltear el RLS de la tabla.
create or replace function resolve_tenant(p_channel text, p_account_key text)
returns uuid
language sql stable security definer set search_path = public
as $$
  select tenant_id
  from connected_accounts
  where channel = p_channel and account_key = p_account_key
$$;

-- ── Prender RLS en todo ─────────────────────────────────────────────────────
alter table tenants            enable row level security;
alter table memberships        enable row level security;
alter table connected_accounts enable row level security;
alter table contacts           enable row level security;
alter table conversations      enable row level security;
alter table messages           enable row level security;
alter table documents          enable row level security;
alter table chunks             enable row level security;
alter table prompts            enable row level security;

-- ── Políticas ───────────────────────────────────────────────────────────────

-- tenants: ves los tuyos (panel), el del ingress, o todos (platform admin).
create policy tenants_access on tenants
  for all
  using (
    id in (select app_user_tenant_ids())
    or id = app_current_tenant_id()
    or app_is_platform_admin()
  )
  with check (app_is_platform_admin());

-- memberships: ves las tuyas; platform admin ve todas.
create policy memberships_access on memberships
  for all
  using (user_id = auth.uid() or app_is_platform_admin())
  with check (app_is_platform_admin());

-- Tablas con tenant_id: mismo predicado para SELECT/INSERT/UPDATE/DELETE.
create policy connected_accounts_access on connected_accounts
  for all using (app_can_access_tenant(tenant_id)) with check (app_can_access_tenant(tenant_id));

create policy contacts_access on contacts
  for all using (app_can_access_tenant(tenant_id)) with check (app_can_access_tenant(tenant_id));

create policy conversations_access on conversations
  for all using (app_can_access_tenant(tenant_id)) with check (app_can_access_tenant(tenant_id));

create policy messages_access on messages
  for all using (app_can_access_tenant(tenant_id)) with check (app_can_access_tenant(tenant_id));

create policy documents_access on documents
  for all using (app_can_access_tenant(tenant_id)) with check (app_can_access_tenant(tenant_id));

create policy chunks_access on chunks
  for all using (app_can_access_tenant(tenant_id)) with check (app_can_access_tenant(tenant_id));

create policy prompts_access on prompts
  for all using (app_can_access_tenant(tenant_id)) with check (app_can_access_tenant(tenant_id));
