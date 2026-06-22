# Plan de trabajo — RAG conversacional multi-tenant (V1)

> Versión revisada del plan de implementación. Incorpora el re-scope decidido en la última ronda de definiciones: producto multi-tenant, onboarding por invitación, CTA a WhatsApp en vez de widget, y panel self-serve para clientes. Reemplaza la sección de fases y el modelo de datos del `plan_implementacion.md` original. Los apéndices del plan original (prompts base en español argentino, Docker, costos, manual) se mantienen vigentes salvo donde se indique.

---

## 1. Qué es ahora el producto

Una plataforma multi-tenant donde:

- **Vos (platform admin)** das de alta cada cliente, cableás su WhatsApp/IG/Messenger en n8n, y lo invitás.
- **Cada cliente (tenant)** se registra aceptando la invitación, se loguea, sube sus documentos, ve sus conversaciones y edita sus prompts — todo scopeado a su propio tenant.
- **El prospecto / lead final** nunca entra a ninguna pantalla: conversa con el bot del cliente por WhatsApp (u otro canal), desde su propio teléfono.
- **La landing pública** vende el producto y dirige al bot vía CTA grandes + QR a WhatsApp. Es estática: no hace una sola llamada viva a la API.
- **Tu propio demo es el tenant cero** (dogfood): el bot que vende el producto es un tenant más del sistema.

### Modelo de tenancy
- Pool compartido: un solo Postgres con `tenant_id` en todo + RLS. No DB por cliente.
- Provisioning **manual** vía invitación. Sin signup abierto, sin Stripe/billing, sin dominios por tenant, sin self-serve de conexión de Meta (es laburo técnico tuyo en V1).
- Una sola cuenta OpenAI por ahora. "Cada tenant trae su API key" queda **diferido**.

---

## 2. Las tres superficies (y sus fronteras de seguridad)

| Superficie | Quién entra | Auth | Frontera de aislamiento real |
|---|---|---|---|
| Landing pública | Cualquiera | Ninguna | N/A — estática, sin API |
| Panel | Platform admin + usuarios de cada cliente | Supabase Auth | **RLS por `tenant_id`** (load-bearing) |
| Ingress `/api/query` | Solo n8n (server-to-server) | **HMAC / secreto compartido** | **`WHERE tenant_id = $actual` en código** (corre como service role, bypassea RLS) |

> **Punto crítico de seguridad #1 — RLS load-bearing.** Con usuarios de cliente logueándose y consultando *su* data, el RLS por `tenant_id` es lo que impide que el cliente A lea las conversaciones del cliente B con una request hecha a mano. Está en el camino crítico, no en "por las dudas".
>
> **Punto crítico de seguridad #2 — el ingress no tiene RLS.** n8n pega contra `/api/query` como service role, que bypassea RLS. Ahí el límite es la disciplina de filtrado en código: cada query estampa y filtra `tenant_id`. RLS para el panel, disciplina de filtrado en el ingress.
>
> **Punto crítico de seguridad #3 — el vector search es frontera, no correctitud.** Cada búsqueda en `chunks` debe ser `WHERE tenant_id = $actual AND <similaridad>`. Olvidarlo una vez = el bot del cliente A responde con la base de conocimiento del cliente B.

---

## 3. Modelo de datos

### Tablas nuevas (multi-tenant)

**`tenants`** — el negocio cliente.
- `id`, `name`, `slug`, `status`, límites/caps (ver Fase 6), `created_at`.

**`memberships`** — usuario ↔ tenant ↔ rol. Soporta "un usuario, un tenant" hoy y "una agencia maneja varios" mañana sin migrar.
- `id`, `user_id` (→ Supabase Auth), `tenant_id`, `role` (`platform_admin` | `tenant_admin` | …), `created_at`.
- El **platform admin** se modela como membership especial o flag a nivel usuario que da god-view sobre todos los tenants vía selector.

**`connected_accounts`** — la pieza que conecta tu provisioning manual con el sistema. "Conectar el WhatsApp del cliente" = insertar una fila acá.
- `id`, `tenant_id`, `channel` (`whatsapp` | `instagram` | `messenger`), `account_key`, `created_at`.
- **`account_key`** = la cuenta del *negocio* que recibe el mensaje (su número de WhatsApp, su page id de Facebook). Resuelve *qué tenant es*.
- Único por `(channel, account_key)`.

### Las 6 tablas existentes — ahora con `tenant_id`
`contacts`, `conversations`, `messages`, `documents`, `chunks`, `prompts` — todas llevan `tenant_id`.

> **Las dos claves que no hay que confundir** (corrección sobre "channel + key"):
> - **`account_key`** (en `connected_accounts`) = quién *recibió* → resuelve el tenant.
> - **`contact_key`** (en `contacts` / `conversations`) = quién *mandó* (el lead final) → resuelve la conversación dentro del tenant.

### Cambio de unicidad de conversación
La conversación única ya **no** es por `(channel, key)`. Ahora es:

```
UNIQUE (tenant_id, channel, contact_key)
```

> Sin `tenant_id` en esa clave, el día que el mismo lead final le escriba a dos de tus tenants, te colisionan las conversaciones. Es sutil y muerde tarde.

---

## 4. Fases

### Fase 1 — Fundaciones
Levantar el esqueleto con el schema multi-tenant completo desde el día cero.
- Supabase: schema con las 9 tablas (`tenants`, `memberships`, `connected_accounts` + las 6 con `tenant_id`), pgvector, índice HNSW en `chunks`.
- RLS prendido por `tenant_id` en las tablas del panel (ya load-bearing — ver Fase 2).
- Proyecto Next.js en Vercel (front + back, único proyecto).
- Docker local funcionando (apéndice Docker del plan original sigue válido).
- **Destraba todo el resto.**

### Fase 2 — Auth e invitaciones
- Supabase Auth + middleware de Next protegiendo rutas del panel.
- **Dos niveles**: platform admin (god-view + selector de tenant) y usuario de cliente (RLS-scoped a su tenant).
- Políticas RLS por `tenant_id` escritas y testeadas (frontera real del panel).
- **Flujo de invitación** (sin signup abierto): platform admin crea el tenant → cablea su canal en `connected_accounts` → manda invitación → el cliente acepta, setea contraseña, y cae en un panel **que ya funciona** (no un dead-end con el canal sin cablear).

### Fase 3 — Ingesta de documentos por tenant (self-serve)
- Supabase Storage para archivos crudos, scopeado por `tenant_id`.
- UI de upload en el panel del cliente + estado "procesando" visible.
- Pipeline: extracción (MarkItDown **opt-in** vía env toggle, se mantiene del plan original) → chunk → embed (`text-embedding-3-small`) → upsert en `chunks` **estampando `tenant_id`**.
- **Cap de ingesta por tenant** (límite de docs / páginas / tamaño). Si alguien sube 50 PDFs de 500 páginas, te come la factura de embeddings antes de facturarle un peso.

### Fase 4 — RAG core / `/api/query`
- Endpoint único `/api/query` con `mode: "auto"` resuelto server-side (lead/customer/seller — se mantiene del plan original).
- Retrieval con **prefiltro `WHERE tenant_id = $actual AND <similaridad>`** (frontera de seguridad #3). Para ~20 docs/tenant, prefiltro + HNSW alcanza; no sobre-ingenierizar el índice.
- Prompts por tenant y por modo (tabla `prompts`, base en español argentino del apéndice original).
- **HMAC / secreto compartido n8n ↔ API** (el ingress no es superficie pública).
- Logging completo con snapshots de chunk en JSON metadata, **scopeado por tenant** (se mantiene, ahora con `tenant_id`).

### Fase 5 — Integración n8n + canales
- Webhooks WhatsApp / Instagram / Messenger entrando por n8n.
- **Resolución de tenant por cuenta destino**: n8n manda `(channel, account_key)` → la API mapea contra `connected_accounts` → `tenant_id`. n8n queda tonto, una sola fuente de verdad en Postgres.
- Mapeo correcto `account_key` (destino → tenant) vs `contact_key` (emisor → conversación).
- Conversación única por `(tenant_id, channel, contact_key)`.

### Fase 6 — Controles de costo y rate limiting (todo **por tenant**)
- **Borde**: Vercel Firewall, rate limit por IP, corta flood antes de ejecutar la función (sin costo de cómputo).
- **Negocio**: cap en Postgres de mensajes por conversación / contacto / hora. Data que ya vive en Supabase, portable.
- **Circuit breaker de gasto diario** por tenant (techo de tokens/día) + caps de tokens por respuesta.
- El runaway de un tenant no se lleva puestos a los demás → además es palanca de producto (planes/límites).
- *Escape hatch* anotado: Upstash + `@upstash/ratelimit` si la latencia de Postgres molesta. No es el default (suma proveedor).

### Fase 7 — Landing pública + paneles + go-to-demo
- **Landing estática** con CTA grandes + **QR** al lado (resuelve la fricción de `wa.me` en desktop: el visitante escanea y cae en WhatsApp mobile sin login).
- Link con `?text=` pre-cargado para **atribución suave** de campaña (editable por el usuario → sirve para saber de dónde vino, no para seguridad).
- **Nota de privacidad** en el flujo (Ley 25.326).
- Panel del cliente: ver conversaciones, gestionar docs, editar prompts.
- God-view del platform admin con selector de tenant.
- **Tenant cero**: tu propio demo cableado como primer tenant (valida el modelo + te da la demo gratis).

---

## 5. Delta vs. plan original (qué cambió)

| Tema | Plan original | Ahora |
|---|---|---|
| Tenancy | Single-tenant | Multi-tenant, pool compartido + RLS |
| Tablas | 6 | 9 (+`tenants`, `memberships`, `connected_accounts`), las 6 con `tenant_id` |
| Conversación única | `(channel, key)` | `(tenant_id, channel, contact_key)` |
| Captura / entrada | Widget web anónimo | CTA + QR a WhatsApp (mata el problema de identidad) |
| Auth | Sin auth interno en V1 | Supabase Auth, 2 niveles, RLS load-bearing |
| Onboarding | N/A | Invitación (sin signup abierto) |
| Ingesta | Carga interna | Self-serve por cliente, con cap de ingesta por tenant |
| Rate limit / costo | No contemplado | Por tenant: borde + Postgres + circuit breaker |
| Resolución de modo/tenant | `mode auto` server-side | + tenant por `account_key` server-side |

---

## 6. Lo que se mantiene del plan original
Siguen vigentes sin cambios estructurales (y sus apéndices aplican): el endpoint único `/api/query`, `mode: "auto"` server-side, GPT-4o-mini + text-embedding-3-small en una cuenta OpenAI, MarkItDown opt-in por env toggle, logging completo con snapshots de chunk, RAG simple (no agéntico — el patrón agente sigue anotado y diferido), Docker local, y los prompts base en español argentino.

---

## 7. Diferido explícitamente (no V1)
Self-serve de conexión de Meta · signup abierto · Stripe / billing · dominios por tenant · "cada tenant trae su API key" de OpenAI · DB por cliente · streaming en canales · RAG agéntico.