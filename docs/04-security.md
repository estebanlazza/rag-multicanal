# 04 — Seguridad

El sistema es multi-tenant con pool compartido. La línea entre "funciona" y "fuga de
datos del cliente A al cliente B" es el aislamiento por `tenant_id`. Esto no es "por las
dudas": está en el camino crítico.

## Invariantes (las mismas que en CLAUDE.md)

### 1. RLS load-bearing en el panel
Con usuarios de cliente logueándose y consultando *su* data, el RLS por `tenant_id` es
lo que impide que el cliente A lea las conversaciones del B con una request hecha a mano.

### 2. RLS también en el ingress
n8n pega contra `/api/query` server-to-server. Históricamente esto correría como
service-role (bypassea RLS) y el límite sería "disciplina de filtrado en código". Lo
endurecemos: el ingress setea `app.tenant_id` por request y las políticas RLS lo leen.
Un olvido de filtro deja de ser fuga. Ver [ADR-0002](decisions/0002-rls-on-ingress.md).

### 3. Vector search es frontera, no correctitud
Cada búsqueda en `chunks` debe filtrar `tenant_id`. Olvidarlo una vez = el bot del
cliente A responde con la base del B. Con RLS en el ingress (invariante 2), esto queda
doblemente cubierto.

### 4. `account_key` vs `contact_key`
Ver [03-data-model](03-data-model.md). Confundirlas mezcla tenants o conversaciones.

### 5. HMAC n8n ↔ `/api/query`
El ingress no es superficie pública. Secreto compartido / firma HMAC en cada request.
(Aplica cuando se implemente n8n.)

## Controles de costo (Fase 6) — todo por tenant

- **Borde:** Vercel Firewall + rate limit por IP. Corta flood antes de ejecutar la
  función (sin costo de cómputo).
- **Negocio:** cap en Postgres de mensajes por conversación / contacto / hora.
- **Circuit breaker de gasto diario** por tenant (techo de tokens/día) + caps de tokens
  por respuesta.
- **Cap de ingesta:** validar docs/páginas/tamaño **antes** de embeber. Si alguien sube
  50 PDFs de 500 páginas, te come la factura de embeddings antes de facturarle un peso.
- El runaway de un tenant no se lleva puestos a los demás → además es palanca de
  producto (planes/límites).

## Privacidad

- **Nota de privacidad** en el flujo de la landing/bot (Ley 25.326, Argentina).
- Link con `?text=` pre-cargado es **atribución suave** de campaña (editable por el
  usuario): sirve para saber de dónde vino, **no** para seguridad.

## Modelo de amenazas (resumen)

| Amenaza | Mitigación |
|---|---|
| Cliente A lee data del B vía request manual | RLS por `tenant_id` (panel) |
| Query en ingress olvida filtro de tenant | RLS vía `set_config` (ingress) |
| Vector search cruza bases de conocimiento | `WHERE tenant_id` + RLS |
| Request falsa al ingress | HMAC / secreto compartido |
| Flood / abuso de un tenant | Rate limit borde + caps Postgres + circuit breaker |
| Bomba de embeddings en upload | Cap de ingesta pre-embed |
| Colisión de conversación entre tenants | `UNIQUE (tenant_id, channel, contact_key)` |
