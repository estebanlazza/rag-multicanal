-- ============================================================================
-- Rol del ingress (ADR-0002). /api/query se conecta con ESTE rol, NO con service_role.
-- Clave: NOBYPASSRLS. El ingress corre con RLS activo y setea app.tenant_id por request,
-- así un olvido de filtro NO es fuga: las políticas lo tapan.
--
-- Producción: cambiar la contraseña y guardarla en SUPABASE_DB_URL (env de Vercel).
--   ALTER ROLE app_ingress PASSWORD '<secreto-fuerte>';
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_ingress') then
    create role app_ingress login password 'CHANGE_ME_IN_PROD' nobypassrls;
  end if;
end
$$;

-- Permite que `postgres` asuma app_ingress (SET ROLE) para los tests de aislamiento.
-- En prod el ingress se conecta directo como app_ingress; esto es solo conveniencia.
grant app_ingress to postgres;

-- Acceso al schema y a las tablas (RLS sigue aplicando encima de estos grants).
grant usage on schema public to app_ingress;
grant select, insert, update on all tables in schema public to app_ingress;
grant usage, select on all sequences in schema public to app_ingress;

-- Tablas/secuencias futuras heredan los mismos permisos.
alter default privileges in schema public
  grant select, insert, update on tables to app_ingress;
alter default privileges in schema public
  grant usage, select on sequences to app_ingress;

-- Funciones que usan las políticas y el ingress.
grant execute on function app_current_tenant_id()            to app_ingress;
grant execute on function app_is_platform_admin()            to app_ingress;
grant execute on function app_can_access_tenant(uuid)        to app_ingress;
grant execute on function resolve_tenant(text, text)         to app_ingress;

-- Las políticas referencian auth.uid()/auth.jwt(); el ingress (sin usuario) las llama
-- y deben devolver NULL sin error.
grant usage on schema auth to app_ingress;
grant execute on function auth.uid()  to app_ingress;
grant execute on function auth.jwt()  to app_ingress;

-- ── Panel: rol `authenticated` (usuarios logueados). RLS hace el scoping. ─────
-- Supabase suele auto-otorgar esto; lo hacemos explícito (explícito > clever).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
