# 06 — Deployment

## Resumen: Docker es solo para desarrollo local

La app no se despliega con Docker. Vercel corre Next.js nativo (serverless/edge). Docker
en este proyecto sirve para levantar el entorno completo en tu máquina mientras
desarrollás, nada más.

| Pieza | Dónde corre en prod | ¿Docker en prod? |
|---|---|---|
| App Next.js (front + `/api/query`) | Vercel | **No** |
| Postgres + pgvector + Auth + Storage | Supabase (cloud gestionado) | No |
| n8n (canales) | VPS / server propio — **diferido** | Sí (self-hosted) |
| Extracción MarkItDown (si se prende) | Worker / servicio Python aparte | Sí (eventual) |

## App Next.js → Vercel

- Un solo proyecto Next (App Router) = front + API routes, incluido `/api/query`.
- Deploy nativo de Vercel, sin contenedor. Push a la branch → build → deploy.
- Variables de entorno (OpenAI key, Supabase URL/keys, secreto HMAC) van en el dashboard
  de Vercel.

## Datos → Supabase (gestionado)

- Postgres + pgvector + Auth + Storage como servicio. No se autohostea en V1.
- Local: se puede correr Supabase en Docker para desarrollo, pero prod usa el Supabase
  cloud.

## Extracción de documentos y MarkItDown

- **Default: extractor Node** (`unpdf` / `pdf-parse`) que corre dentro de la función de
  Vercel. Cero infra extra.
- **MarkItDown es Python.** No corre dentro de una función de Vercel (Node). Si se
  prende (`env toggle`), necesita vivir como **servicio/worker Python separado** (un
  contenedor en un VPS, o una función serverless Python). Por eso queda **apagado por
  defecto** hasta que exista ese worker.
- Regla práctica: no prendas MarkItDown hasta tener dónde correrlo. No bloquea el deploy
  a Vercel mientras esté off.

## n8n (diferido)

- Cuando se implemente, n8n se autohostea (Docker en un VPS) o se usa n8n Cloud — a
  decidir en el Hito 2.
- El secreto HMAC entre n8n y `/api/query` se configura ahí. Ver [04-security](04-security.md).

## Local (dev)

- Docker Compose levanta lo necesario para desarrollar (app + Supabase local + opcional
  worker de extracción). Apéndice Docker del plan original sigue válido.
- El `git init` + repo remoto (GitHub) conviene tenerlo antes de la Fase 1: el deploy a
  Vercel se engancha al repo.
