# TODOS — trabajo diferido

Todo lo que está fuera del scope de V1 / hito actual, anotado para que no se pierda.
Las vagas intenciones son mentiras: si algo se difiere, vive acá con contexto.

## Diferido del review CEO (2026-06-22)

- **E1 — Playground / chat de prueba interactivo en el panel.** Chat que pega directo
  a `/api/query` con un modo "playground", para que el *tenant* pruebe su bot desde el
  panel sin esperar a n8n. Esfuerzo S/M. Diferido porque el harness de evals (E3, en
  scope) ya cubre el "no puedo ver el bot sin n8n" para el dev. Retomar cuando el panel
  esté estable y antes de onboardear clientes que no sean técnicos.

## Diferido por decisión (2026-06-22)

- **Modos de conversación `auto` (lead / customer / seller).** Por ahora el bot tiene un
  solo comportamiento y un solo prompt por tenant. No se detecta tipo de interlocutor ni
  se cambia de modo server-side. Retomar si el negocio necesita que el bot actúe distinto
  con prospecto nuevo vs cliente existente vs venta.

## Diferido del plan original (no V1)

- Self-serve de conexión de Meta (cablear WhatsApp/IG lo hace el platform admin a mano).
- Signup abierto (hoy es solo por invitación).
- Stripe / billing.
- Dominios por tenant.
- "Cada tenant trae su API key" de OpenAI (hoy una sola cuenta).
- DB por cliente (hoy pool compartido + RLS).
- Streaming de respuestas en canales.
- RAG agéntico (hoy RAG simple, patrón agente anotado y diferido).

## Notas técnicas a revisar cuando escale

- **HNSW + filtro por tenant:** con ~20 docs/tenant, prefiltro `WHERE tenant_id` +
  HNSW alcanza. Cuando un tenant tenga miles de chunks, revisar recall del
  post-filtering de pgvector (índice parcial / iterative scan). No optimizar antes.
- **Escape hatch rate limiting:** Upstash + `@upstash/ratelimit` si la latencia de
  los caps en Postgres molesta. No es el default (suma proveedor).
