-- ============================================================================
-- Storage para documentos crudos, scopeado por tenant.
-- Convención de path: {tenant_id}/{document_id}/{filename}
-- El primer segmento del path = tenant_id → reusa app_can_access_tenant() para RLS,
-- igual que las tablas. Bucket privado (no público).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Helper: tenant_id embebido en el path del objeto (primer segmento).
create or replace function storage_object_tenant_id(object_name text)
returns uuid
language sql stable
as $$
  select nullif((storage.foldername(object_name))[1], '')::uuid
$$;

-- Mismo predicado de acceso que las tablas de negocio: panel (auth.uid) + ingress
-- (app.tenant_id) + god-view. Cubre select/insert/update/delete sobre el bucket.
create policy "documents tenant read" on storage.objects
  for select
  using (bucket_id = 'documents'
         and app_can_access_tenant(storage_object_tenant_id(name)));

create policy "documents tenant insert" on storage.objects
  for insert
  with check (bucket_id = 'documents'
              and app_can_access_tenant(storage_object_tenant_id(name)));

create policy "documents tenant update" on storage.objects
  for update
  using (bucket_id = 'documents'
         and app_can_access_tenant(storage_object_tenant_id(name)))
  with check (bucket_id = 'documents'
              and app_can_access_tenant(storage_object_tenant_id(name)));

create policy "documents tenant delete" on storage.objects
  for delete
  using (bucket_id = 'documents'
         and app_can_access_tenant(storage_object_tenant_id(name)));
