-- ============================================================================
-- Tests de aislamiento RLS. Entregable de Fase 1, NO opcional.
-- Prueba que un tenant no puede ver datos de otro por NINGÚN camino:
--   1) ingress (app.tenant_id)   2) panel (auth.uid)   3) que el cruce explícito falla
-- y que el platform admin SÍ ve todo.
--
-- Correr contra el Postgres local de Supabase como superusuario:
--   supabase db reset && psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--     -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation.sql
-- Se envuelve en una transacción con ROLLBACK: no deja datos.
-- ============================================================================

\set ON_ERROR_STOP on
begin;

-- ── Seed (como postgres: bypassea RLS) ──────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@test.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@test.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'admin@test.com');

insert into tenants (id, name, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tenant A', 'tenant-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tenant B', 'tenant-b');

insert into memberships (user_id, tenant_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');

insert into connected_accounts (tenant_id, channel, account_key) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'whatsapp', 'A-num'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'whatsapp', 'B-num');

insert into documents (id, tenant_id, title, status) values
  ('aa000000-0000-0000-0000-0000000000aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Doc A', 'ready'),
  ('bb000000-0000-0000-0000-0000000000bb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Doc B', 'ready');

insert into chunks (tenant_id, document_id, content) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aa000000-0000-0000-0000-0000000000aa', 'contenido A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bb000000-0000-0000-0000-0000000000bb', 'contenido B');

-- Helper de resolución de tenant (lo usa el ingress) funciona con security definer.
do $$
begin
  assert resolve_tenant('whatsapp', 'A-num') = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'resolve_tenant debe mapear A-num → Tenant A';
  raise notice 'OK  resolve_tenant';
end $$;

-- ── 1) INGRESS: app.tenant_id = A → solo ve A ───────────────────────────────
set local role app_ingress;
select set_config('app.tenant_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

do $$
begin
  assert (select count(*) from chunks) = 1, 'ingress A: debe ver exactamente 1 chunk';
  assert (select count(*) from documents) = 1, 'ingress A: debe ver exactamente 1 doc';
  -- EL test clave: aunque pida B explícitamente, RLS no lo deja.
  assert (select count(*) from chunks
          where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0,
    'ingress A: NO puede ver chunks de B ni pidiéndolos a mano';
  raise notice 'OK  ingress aislado (A no ve B)';
end $$;
reset role;

-- ── 1b) INGRESS sin app.tenant_id → no ve nada (falla cerrado) ──────────────
set local role app_ingress;
select set_config('app.tenant_id', '', true);
do $$
begin
  assert (select count(*) from chunks) = 0,
    'ingress sin tenant seteado: debe ver 0 (falla cerrado, no abierto)';
  raise notice 'OK  ingress falla cerrado sin app.tenant_id';
end $$;
reset role;

-- ── 2) PANEL: usuario A logueado → solo ve A ────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","app_metadata":{}}', true);
select set_config('app.tenant_id', '', true);  -- limpiar contexto de ingress

do $$
begin
  assert (select count(*) from chunks) = 1, 'panel A: debe ver solo sus chunks';
  assert (select count(*) from documents) = 1, 'panel A: debe ver solo sus docs';
  assert (select count(*) from conversations
          where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0,
    'panel A: NO puede ver data de B';
  raise notice 'OK  panel aislado (usuario A no ve B)';
end $$;
reset role;

-- ── 3) PLATFORM ADMIN: flag is_platform_admin → ve todo ─────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","app_metadata":{"is_platform_admin":true}}', true);

do $$
begin
  assert (select count(*) from chunks) = 2, 'platform admin: debe ver chunks de ambos tenants';
  assert (select count(*) from tenants) = 2, 'platform admin: debe ver ambos tenants';
  raise notice 'OK  platform admin god-view (ve A y B)';
end $$;
reset role;

do $$ begin raise notice '== TODOS LOS TESTS DE AISLAMIENTO PASARON =='; end $$;

rollback;
