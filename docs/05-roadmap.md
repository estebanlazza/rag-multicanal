# 05 — Roadmap

Reordenado según el primer hito elegido: **Fundaciones + panel sin canal**. Los canales
(n8n) se implementan después. Las fases del plan original se mantienen, cambia el orden
de shipping.

## Hito 1 — Fundaciones + panel funcionando (sin canal)

Objetivo: schema multi-tenant completo, panel donde un tenant sube docs, edita prompts y
el RAG responde, todo aislado por tenant. Sin WhatsApp todavía. Se ejercita con el
harness de evals.

### Fase 1 — Fundaciones
- Supabase: schema con las 9 tablas, pgvector, índice HNSW en `chunks`.
- RLS prendido por `tenant_id` (panel + ingress vía `set_config`).
- Next.js en Vercel (un solo proyecto). Docker local.
- **Destraba todo el resto.**

### Fase 2 — Auth e invitaciones
- Supabase Auth + middleware protegiendo rutas del panel.
- Dos niveles: platform admin (god-view + selector de tenant) y usuario de cliente
  (RLS-scoped).
- Políticas RLS escritas y **testeadas** (tests de cruce de tenant deben fallar).
- Flujo de invitación: admin crea tenant → (cablea canal, diferido) → invita → el
  cliente acepta, setea contraseña y cae en un panel que ya funciona.

### Fase 3 — Ingesta de documentos por tenant (self-serve)
- Supabase Storage scopeado por `tenant_id`.
- UI de upload + estado "procesando".
- Pipeline: extracción (MarkItDown opt-in) → chunk → embed → upsert en `chunks`
  estampando `tenant_id`.
- **Cap de ingesta** validado antes de embeber.

### Fase 4 — RAG core / `/api/query`
- Endpoint único `/api/query`.
- Retrieval con prefiltro `WHERE tenant_id = $actual AND <similaridad>`.
- Un prompt por tenant (base en español argentino). Sin modos de conversación.
- HMAC listo para n8n (aunque n8n llegue después).
- Logging completo con snapshots de chunk en metadata, scopeado por tenant.
- **[E2 — en scope] Citas / chunks fuente** expuestos en cada respuesta (panel + evals).
  Reusa los snapshots ya logueados. Herramienta #1 para tunear prompts y cazar
  alucinaciones.

### Fase 4.5 — Harness de evals por tenant **[E3 — en scope]**
- Set de pares pregunta / respuesta esperada por tenant.
- Runner que pega a `/api/query` y reporta regresiones al cambiar prompts o reingestar.
- Cubre el hueco "no puedo ver el bot sin n8n" para el dev durante el hito 1.

### Fase 7 (parte panel) — Paneles + tenant cero
- Panel del cliente: ver conversaciones, gestionar docs, editar prompts.
- God-view del platform admin con selector de tenant.

## Hito 2 — Canales (n8n) + landing + go-to-demo

Se planifica en detalle cuando se arranque n8n. Incluye:

### Fase 5 — Integración n8n + canales
- Webhooks WhatsApp / IG / Messenger por n8n.
- Resolución de tenant por `(channel, account_key)` → `connected_accounts`.
- Conversación única por `(tenant_id, channel, contact_key)`.

### Fase 6 — Controles de costo y rate limiting (por tenant)
- Borde (Vercel Firewall) + caps Postgres + circuit breaker de gasto diario.

### Fase 7 (resto) — Landing + tenant cero en vivo
- Landing estática con CTA + QR a WhatsApp, `?text=` para atribución suave.
- Nota de privacidad (Ley 25.326).
- **Tenant cero:** tu demo cableado como primer tenant real.

## Lo que se mantiene del plan original

Endpoint único `/api/query`, GPT-4o-mini + text-embedding-3-small en una cuenta OpenAI,
MarkItDown opt-in por env toggle, logging con snapshots de chunk, RAG simple, Docker
local, prompt base en español argentino.

## Diferido (ver [TODOS.md](../TODOS.md))

Playground interactivo (E1), self-serve de Meta, signup abierto, Stripe, dominios por
tenant, API key por tenant, DB por cliente, streaming en canales, RAG agéntico.
