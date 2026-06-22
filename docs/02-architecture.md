# 02 — Arquitectura

## Vista general

```
                       ┌─────────────────────────────┐
   Lead final          │   Landing pública (estática) │
   (su teléfono)       │   CTA + QR a WhatsApp        │
        │              └─────────────────────────────┘
        │ WhatsApp/IG/Messenger
        ▼
   ┌─────────┐   webhook    ┌──────────────────────────────┐
   │   n8n   │ ───────────► │  Next.js (Vercel)            │
   │ (canal) │   HMAC       │  ┌────────────────────────┐  │
   └─────────┘ ◄─────────── │  │ /api/query (ingress)   │  │
                  respuesta │  │  set_config tenant_id  │  │
                            │  └───────────┬────────────┘  │
   Platform admin           │  ┌───────────┴────────────┐  │
   + usuarios tenant ─────► │  │ Panel (RLS por tenant) │  │
   (Supabase Auth)          │  └───────────┬────────────┘  │
                            └──────────────┼───────────────┘
                                           ▼
                            ┌──────────────────────────────┐
                            │ Supabase                     │
                            │  Postgres + pgvector + RLS   │
                            │  Auth · Storage              │
                            └──────────────┬───────────────┘
                                           │ embeddings / chat
                                           ▼
                                      ┌─────────┐
                                      │ OpenAI  │
                                      └─────────┘
```

> n8n y los canales están **diferidos**: se implementan después del hito "Fundaciones
> + panel sin canal". Hasta entonces, `/api/query` se ejercita desde el harness de
> evals (ver [05-roadmap](05-roadmap.md)).

## Flujo de una consulta del lead (cuando n8n esté activo)

```
1. Lead manda mensaje por WhatsApp al número del negocio.
2. Meta → webhook → n8n.
3. n8n arma (channel, account_key, contact_key, text) y pega a /api/query con HMAC.
4. /api/query:
   a. Valida HMAC.
   b. Resuelve tenant: SELECT tenant_id FROM connected_accounts
      WHERE channel = $channel AND account_key = $account_key.
   c. Abre transacción → set_config('app.tenant_id', tenant_id).
   d. Upsert conversación por (tenant_id, channel, contact_key).
   e. Embed query → vector search en chunks (WHERE tenant_id = $actual, vía RLS).
   f. Arma prompt (tabla prompts, uno por tenant).
   g. Llama OpenAI → respuesta.
   h. Loguea todo con snapshot de chunks en metadata (scopeado por tenant).
5. n8n recibe la respuesta y la manda al lead por el canal.
```

## Flujo de ingesta de documentos (self-serve, panel)

```
1. Usuario del tenant sube archivo → Supabase Storage (scopeado por tenant_id).
2. Cap de ingesta: validar docs/páginas/tamaño ANTES de embeber. Rechazar si excede.
3. Extracción (MarkItDown opt-in vía env toggle) → chunk → embed (text-embedding-3-small).
4. Upsert en chunks estampando tenant_id.
5. Estado "procesando" → "listo" visible en el panel.
```

## Resolución de tenant

- **Tenant** se resuelve por cuenta destino: `(channel, account_key)` →
  `connected_accounts` → `tenant_id`. n8n queda tonto, la fuente de verdad es Postgres.
- No hay modos de conversación: un solo comportamiento, un prompt por tenant. (Los
  modos `lead/customer/seller` están diferidos — ver [TODOS.md](../TODOS.md).)

## Decisiones clave

- Pool compartido multi-tenant + RLS, no DB por cliente — [ADR-0001](decisions/0001-multi-tenant-pool-rls.md).
- RLS también en el ingress (no solo filtrado en código) — [ADR-0002](decisions/0002-rls-on-ingress.md).
- RAG simple (no agéntico) en V1. Patrón agente anotado y diferido.
