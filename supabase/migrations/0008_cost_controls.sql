-- ============================================================================
-- Fase 6 — controles de costo y rate limiting, todo por tenant.
-- El runaway de un tenant no se lleva puestos a los demás.
-- ============================================================================

-- Cap de mensajes por hora (por conversación/contacto). daily_token_cap ya existe.
alter table tenants
  add column messages_per_hour_cap int not null default 30;

-- Consumo diario de tokens por tenant (circuit breaker). Upsert por (tenant, día).
create table token_usage (
  tenant_id     uuid not null references tenants(id) on delete cascade,
  usage_date    date not null default current_date,
  total_tokens  bigint not null default 0,
  request_count int not null default 0,
  primary key (tenant_id, usage_date)
);

alter table token_usage enable row level security;
create policy token_usage_access on token_usage
  for all using (app_can_access_tenant(tenant_id))
  with check (app_can_access_tenant(tenant_id));
