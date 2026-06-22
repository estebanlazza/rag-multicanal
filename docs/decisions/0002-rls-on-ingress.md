# ADR-0002 — RLS también en el ingress (no solo filtrado en código)

- **Estado:** Aceptada
- **Fecha:** 2026-06-22

## Contexto

El endpoint `/api/query` lo consume n8n server-to-server (no hay usuario logueado). El
patrón por defecto sería conectarse como **service-role**, que **bypassea RLS**, y
confiar en que cada query estampe y filtre `tenant_id` a mano ("disciplina de filtrado
en código").

El problema: esa disciplina es correcta el 99% de las veces y catastrófica el 1%. Una
sola query en el ingress que se olvide del `WHERE tenant_id = $actual` hace que el bot
del cliente A responda con la base de conocimiento del cliente B. Y no avisa nadie.

El panel ya está protegido por RLS apoyado en `auth.uid()`. Pero el ingress no tiene
usuario, así que esas políticas no aplican y quedaría sin red.

## Decisión

El ingress **no** confía solo en el filtrado en código. Por cada request, después de
resolver el tenant desde `connected_accounts`, abre una transacción y setea una variable
de sesión local:

```sql
SELECT set_config('app.tenant_id', $tenant_id, true);  -- true = local a la transacción
```

Las políticas RLS de las tablas tocadas por el ingress leen esa variable:

```sql
CREATE POLICY ingress_tenant ON chunks
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

Mismo schema que ya se iba a construir. Las políticas se escriben una sola vez y cubren
los dos codepaths (panel vía `auth.uid()`, ingress vía `current_setting`).

## Consecuencias

- El peor caso de un olvido de filtro en el ingress pasa de **fuga de datos entre
  clientes** a **"no devuelve nada"**. Defensa en profundidad sobre la superficie más
  peligrosa.
- Hay que asegurar que cada request del ingress corra dentro de una transacción y setee
  `app.tenant_id` antes de tocar datos. Si no se setea, `current_setting(..., true)`
  devuelve `NULL` y las políticas no matchean nada → falla cerrado (correcto).
- Costo: mínimo. Un `set_config` por request + las políticas que ya se iban a escribir.
- Reemplaza el "Punto crítico #2" del plan original (ingress sin RLS) por un ingress con
  RLS como backstop.

## Alternativa descartada

**Service-role + solo filtrado en código.** Más simple de arrancar, pero deja la
superficie más cara del sistema dependiendo de que ningún humano se olvide nunca de una
cláusula `WHERE`. No vale el ahorro.
