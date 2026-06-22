# RAG Chatbot — bot conversacional multi-tenant

Bot con IA que responde por WhatsApp (e IG/Messenger) usando la base de conocimiento de
cada negocio (RAG). Plataforma multi-tenant: muchos negocios, datos aislados por tenant.

- **Producto y features:** [docs/01-overview.md](docs/01-overview.md)
- **Arquitectura, modelo de datos, seguridad, roadmap:** [docs/](docs/README.md)
- **Lineamientos para trabajar:** [CLAUDE.md](CLAUDE.md)

## Stack

Next.js (Vercel) · Supabase (Postgres + pgvector + Auth + Storage) · OpenAI
(gpt-4o-mini + text-embedding-3-small) · n8n para canales (diferido).

## Estado: Fase 1 — Fundaciones

Esqueleto multi-tenant con schema completo, RLS (panel + ingress) y scaffold de Next.
Sin canales, sin pipeline de ingesta, sin `/api/query` todavía (ver
[docs/05-roadmap.md](docs/05-roadmap.md)).

## Setup local

Requisitos: Node 22+, Docker, npm.

```bash
# 1. Dependencias
npm install

# 2. Levantar Supabase local (Postgres + Auth + Storage en Docker)
npx supabase start
# Imprime las URLs y keys locales. Copialas al .env.local.

# 3. Variables de entorno
cp .env.example .env.local
# Completar NEXT_PUBLIC_SUPABASE_URL / ANON_KEY con lo que imprimió supabase start.

# 4. Aplicar migraciones (schema + RLS)
npx supabase db reset

# 5. Correr los tests de aislamiento RLS (entregable de Fase 1)
npm run db:test

# 6. Levantar la app
npm run dev
# http://localhost:3000  ·  healthcheck: http://localhost:3000/api/health
```

## Migraciones

Viven en [supabase/migrations/](supabase/migrations/), versionadas:

| Archivo | Qué hace |
|---|---|
| `0001_extensions.sql` | pgvector |
| `0002_tables.sql` | Las 9 tablas multi-tenant |
| `0003_indexes.sql` | Índices por tenant + HNSW para vector search |
| `0004_rls.sql` | RLS: panel (auth.uid) + ingress (app.tenant_id) + god-view |
| `0005_ingress_role.sql` | Rol `app_ingress` (RLS-enforced) + grants del panel |

## Tests de aislamiento

[supabase/tests/rls_isolation.sql](supabase/tests/rls_isolation.sql) prueba que un tenant
no puede ver datos de otro por ningún camino (ingress, panel, cruce explícito) y que el
platform admin sí ve todo. `npm run db:test` los corre contra el Postgres local.

## Deploy

Next → Vercel (sin Docker). Supabase gestionado. Detalle en
[docs/06-deployment.md](docs/06-deployment.md).
