-- ============================================================================
-- Evals (E3): casos de prueba por tenant + resultados de la última corrida.
-- Y match_chunks(): retrieval unificado que usan /api/query y el runner de evals.
-- ============================================================================

-- Retrieval compartido. SECURITY INVOKER: corre bajo el RLS del que llama
-- (app.tenant_id en el ingress, auth.uid en el panel). El p_tenant es prefiltro
-- para el índice; RLS igual garantiza el aislamiento por si se pasa otro.
create or replace function match_chunks(
  p_tenant uuid,
  query_embedding vector(1536),
  match_count int default 5
)
returns table (id uuid, document_id uuid, content text, similarity float)
language sql stable
as $$
  select c.id, c.document_id, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.tenant_id = p_tenant and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count
$$;

grant execute on function match_chunks(uuid, vector, int) to authenticated, app_ingress;

-- ── Casos de eval (dato del tenant, RLS-scoped) ─────────────────────────────
create table eval_cases (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  question             text not null,
  expected_document_id uuid references documents(id) on delete set null,
  must_include         text[] not null default '{}',
  must_not_include     text[] not null default '{}',
  should_defer         boolean not null default false,
  note                 text,
  created_at           timestamptz not null default now()
);
create index idx_eval_cases_tenant on eval_cases (tenant_id);

alter table eval_cases enable row level security;
create policy eval_cases_access on eval_cases
  for all using (app_can_access_tenant(tenant_id))
  with check (app_can_access_tenant(tenant_id));

-- ── Resultado de la última corrida por caso (upsert por eval_case_id) ───────
create table eval_results (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  eval_case_id   uuid not null unique references eval_cases(id) on delete cascade,
  ran_at         timestamptz not null default now(),
  retrieval_ok   boolean,
  answer_ok      boolean,
  defer_ok       boolean,
  top_similarity float,
  answer         text,
  model          text,
  provider       text
);
create index idx_eval_results_tenant on eval_results (tenant_id);

alter table eval_results enable row level security;
create policy eval_results_access on eval_results
  for all using (app_can_access_tenant(tenant_id))
  with check (app_can_access_tenant(tenant_id));
