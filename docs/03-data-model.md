# 03 — Modelo de datos

9 tablas: 3 nuevas (multi-tenant) + las 6 heredadas, todas con `tenant_id`.

## Tablas nuevas

### `tenants` — el negocio cliente
`id`, `name`, `slug`, `status`, límites/caps (ver Fase 6), `created_at`.

### `memberships` — usuario ↔ tenant ↔ rol
Soporta "un usuario, un tenant" hoy y "una agencia maneja varios" mañana sin migrar.
- `id`, `user_id` (→ Supabase Auth), `tenant_id`, `role` (`owner`), `created_at`.
- **Rol del tenant: `owner`, único por ahora.** Es el dueño del negocio cliente:
  gestiona todo de su tenant (docs, prompts, conversaciones). `manager` queda
  **reservado** para un futuro segundo rol por debajo del owner (ej. un empleado del
  cliente con permisos acotados); no existe todavía.
- El **platform admin** (vos, dueño de la plataforma) NO es un rol de `memberships`:
  spanea todos los tenants, no pertenece a uno. Se modela como **flag a nivel usuario**
  (`app_metadata.is_platform_admin` en Supabase Auth), que da god-view sobre todos los
  tenants vía selector.

### `connected_accounts` — conecta el provisioning manual con el sistema
"Conectar el WhatsApp del cliente" = insertar una fila acá.
- `id`, `tenant_id`, `channel` (`whatsapp` | `instagram` | `messenger`),
  `account_key`, `created_at`.
- `account_key` = la cuenta del *negocio* que recibe el mensaje (su número de WhatsApp,
  su page id de Facebook). Resuelve **qué tenant es**.
- **Único por `(channel, account_key)`.**

## Las 6 tablas heredadas — ahora con `tenant_id`

`contacts`, `conversations`, `messages`, `documents`, `chunks`, `prompts`.

### Las dos claves que no hay que confundir

- **`account_key`** (en `connected_accounts`) = quién *recibió* → resuelve el tenant.
- **`contact_key`** (en `contacts` / `conversations`) = quién *mandó* (el lead) →
  resuelve la conversación dentro del tenant.

### Unicidad de conversación

```sql
UNIQUE (tenant_id, channel, contact_key)
```

Sin `tenant_id` en esa clave, el día que el mismo lead le escriba a dos tenants, las
conversaciones colisionan. Es sutil y muerde tarde.

### `chunks` — vector store

- `tenant_id`, `document_id`, `content`, `embedding vector(1536)` (text-embedding-3-small),
  metadata.
- Índice **HNSW** sobre `embedding`.
- Toda búsqueda: `WHERE tenant_id = $actual AND <similaridad>`. Frontera de seguridad,
  no solo correctitud.

## RLS

### Panel
Políticas por `tenant_id` apoyadas en la membership del usuario logueado. Ejemplo
conceptual:

```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON conversations
  USING (
    tenant_id IN (
      SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
    )
    OR coalesce(  -- platform admin: god-view (flag a nivel usuario, no rol de tenant)
      (auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean, false
    )
  );
```

### Ingress `/api/query`
No usa `auth.uid()` (no hay usuario logueado, es server-to-server). Usa una variable de
sesión seteada por request — ver [ADR-0002](decisions/0002-rls-on-ingress.md):

```sql
-- al abrir la transacción del request, después de resolver el tenant:
SELECT set_config('app.tenant_id', $tenant_id, true);  -- true = local a la tx

-- política que cubre el codepath del ingress:
CREATE POLICY ingress_tenant ON chunks
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

Así un olvido de `WHERE tenant_id` en el ingress no es fuga: RLS lo tapa.

## Tests de aislamiento (obligatorios)

Por cada tabla con RLS, un test que intente cruzar tenants con una request hecha a mano
**debe fallar**. Es la prueba de que la frontera funciona, no se asume.
