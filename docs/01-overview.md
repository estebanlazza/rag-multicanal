# 01 — Overview del producto

## Qué es

Plataforma multi-tenant donde:

- **Vos (platform admin)** das de alta cada cliente, cableás su WhatsApp/IG/Messenger
  en n8n, y lo invitás.
- **Cada cliente (tenant)** acepta la invitación, se loguea, sube sus documentos, ve
  sus conversaciones y edita sus prompts — todo scopeado a su propio tenant.
- **El lead final** nunca entra a ninguna pantalla: conversa con el bot del cliente por
  WhatsApp (u otro canal) desde su propio teléfono.
- **La landing pública** vende el producto y dirige al bot vía CTA + QR. Es estática:
  no hace una sola llamada viva a la API.
- **Tu propio demo es el tenant cero** (dogfood): el bot que vende el producto es un
  tenant más del sistema.

## Modelo de tenancy

- **Pool compartido:** un solo Postgres con `tenant_id` en todo + RLS. No DB por cliente.
- **Provisioning manual** por invitación. Sin signup abierto, sin Stripe/billing, sin
  dominios por tenant, sin self-serve de conexión de Meta (V1: es laburo técnico tuyo).
- Una sola cuenta OpenAI por ahora. "Cada tenant trae su API key" queda diferido.

## Las tres superficies

| Superficie | Quién entra | Auth | Frontera de aislamiento |
|---|---|---|---|
| Landing pública | Cualquiera | Ninguna | N/A — estática, sin API |
| Panel | Platform admin + usuarios de cada cliente | Supabase Auth | **RLS por `tenant_id`** |
| Ingress `/api/query` | Solo n8n (server-to-server) | **HMAC** | **RLS vía `set_config` por request** (ver [ADR-0002](decisions/0002-rls-on-ingress.md)) |

## Stack

- Next.js (App Router) en Vercel — front + back, un solo proyecto.
- Supabase: Postgres + pgvector + Auth + Storage.
- n8n: orquestación de canales (**diferido**, post hito 1).
- OpenAI: GPT-4o-mini + text-embedding-3-small.
- Docker local.

## Documentos relacionados

- [02 — Arquitectura](02-architecture.md)
- [03 — Modelo de datos](03-data-model.md)
- [04 — Seguridad](04-security.md)
- [05 — Roadmap](05-roadmap.md)
- [ADR-0001 — Multi-tenant pool + RLS](decisions/0001-multi-tenant-pool-rls.md)
- [ADR-0002 — RLS también en el ingress](decisions/0002-rls-on-ingress.md)
