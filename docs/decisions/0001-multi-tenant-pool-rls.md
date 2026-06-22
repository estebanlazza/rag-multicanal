# ADR-0001 — Multi-tenant pool compartido + RLS

- **Estado:** Aceptada
- **Fecha:** 2026-06-22

## Contexto

El producto sirve a varios clientes (tenants), cada uno con sus documentos,
conversaciones y prompts. Hay que decidir cómo aislar los datos entre tenants.

Opciones:
- **DB por cliente:** aislamiento físico fuerte, pero provisioning pesado, migraciones
  multiplicadas, costos y operación que no escalan a muchos clientes chicos.
- **Pool compartido + `tenant_id` + RLS:** un solo Postgres, aislamiento lógico por
  Row Level Security.

## Decisión

Pool compartido: un solo Postgres con `tenant_id` en todas las tablas de negocio + RLS.
El schema multi-tenant se construye **desde el día cero**, no se retrofitea.

## Consecuencias

- Las 9 tablas viven en una sola DB; las 6 heredadas suman `tenant_id`.
- RLS es load-bearing: es la frontera de aislamiento real del panel (ver
  [ADR-0002](0002-rls-on-ingress.md) para el ingress).
- Migraciones y operación únicas, escala a muchos tenants chicos.
- `memberships` y `connected_accounts` anticipan multi-agencia y multi-canal sin migrar.
- Trade-off aceptado: el aislamiento es lógico, no físico. Se compensa testeando las
  políticas RLS con intentos de cruce de tenant que deben fallar.

## Por qué no se difirió la tenancy

Meter `tenant_id` después, con datos vivos, obliga a backfills riesgosos y a reescribir
queries. Además el dogfood ("tenant cero") necesita el modelo multi-tenant igual. El
costo de hacerlo bien desde el día cero es bajo; el de retrofitearlo es alto.
