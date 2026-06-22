-- ============================================================================
-- Schema multi-tenant completo. Las 9 tablas. Todas las de negocio con tenant_id.
-- Ver docs/03-data-model.md.
-- ============================================================================

-- ── Plataforma ──────────────────────────────────────────────────────────────

create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  status      text not null default 'active' check (status in ('active', 'suspended')),
  -- caps (Fase 6): el cap de ingesta se valida ANTES de embeber.
  max_documents     int  not null default 50,
  max_pages         int  not null default 2000,
  daily_token_cap   int  not null default 200000,
  created_at  timestamptz not null default now()
);

-- usuario ↔ tenant ↔ rol. Hoy un solo rol del tenant: owner.
-- El platform admin NO va acá: es flag a nivel usuario (app_metadata.is_platform_admin).
create table memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner')),
  created_at  timestamptz not null default now(),
  unique (user_id, tenant_id)
);

-- "Conectar el WhatsApp del cliente" = una fila acá.
-- account_key = quién RECIBIÓ (cuenta del negocio) → resuelve el tenant.
create table connected_accounts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  channel     text not null check (channel in ('whatsapp', 'instagram', 'messenger')),
  account_key text not null,
  created_at  timestamptz not null default now(),
  unique (channel, account_key)
);

-- ── Negocio (todas con tenant_id) ───────────────────────────────────────────

-- contact_key = quién MANDÓ (el lead) → resuelve la conversación dentro del tenant.
create table contacts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  channel      text not null check (channel in ('whatsapp', 'instagram', 'messenger')),
  contact_key  text not null,
  display_name text,
  created_at   timestamptz not null default now(),
  unique (tenant_id, channel, contact_key)
);

create table conversations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  contact_id   uuid references contacts(id) on delete set null,
  channel      text not null check (channel in ('whatsapp', 'instagram', 'messenger')),
  contact_key  text not null,
  status       text not null default 'open' check (status in ('open', 'closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Invariante: conversación única por tenant. Sin tenant_id en la clave, dos tenants
  -- con el mismo lead colisionan.
  unique (tenant_id, channel, contact_key)
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  -- snapshot de chunks usados (citas E2) y metadata de la respuesta.
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create table documents (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  title        text,
  storage_path text,
  status       text not null default 'pending'
                 check (status in ('pending', 'processing', 'ready', 'error')),
  error        text,
  page_count   int,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table chunks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int  not null default 0,
  content     text not null,
  embedding   vector(1536),          -- text-embedding-3-small
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- Un prompt por tenant (sin modos de conversación).
create table prompts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id)
);
