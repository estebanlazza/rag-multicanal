# Documentación — RAG conversacional multi-tenant

Índice de la documentación del proyecto. Guía de trabajo para Claude en
[`../CLAUDE.md`](../CLAUDE.md).

| Doc | Qué cubre |
|---|---|
| [01 — Overview](01-overview.md) | Qué es el producto, tenancy, superficies, stack |
| [02 — Arquitectura](02-architecture.md) | Diagramas, flujo de consulta e ingesta, resolución de tenant |
| [03 — Modelo de datos](03-data-model.md) | Las 9 tablas, claves, RLS, tests de aislamiento |
| [04 — Seguridad](04-security.md) | Invariantes, controles de costo, modelo de amenazas, privacidad |
| [05 — Roadmap](05-roadmap.md) | Fases reordenadas, hito actual, scope vs diferido |
| [06 — Deployment](06-deployment.md) | Vercel + Supabase, Docker solo local, MarkItDown |

## Decisiones de arquitectura (ADRs)

| ADR | Decisión |
|---|---|
| [0001](decisions/0001-multi-tenant-pool-rls.md) | Multi-tenant pool compartido + RLS (no DB por cliente) |
| [0002](decisions/0002-rls-on-ingress.md) | RLS también en el ingress (no solo filtrado en código) |

## Trabajo diferido

Ver [`../TODOS.md`](../TODOS.md).
