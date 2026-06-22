# CLAUDE.md — RAG conversacional multi-tenant

Guía de trabajo para este proyecto. Leelo antes de tocar código. Si una decisión
acá contradice lo que estás por hacer, pará y preguntá.

## Qué es

Plataforma **multi-tenant** de bots RAG conversacionales. Cada cliente (tenant)
sube sus documentos, edita sus prompts y ve sus conversaciones desde un panel
scopeado a su propio tenant. El lead final nunca entra al panel: conversa con el
bot por WhatsApp/IG/Messenger desde su teléfono. La landing pública es estática y
manda al bot vía CTA + QR. Provisioning manual por invitación (sin signup abierto).

Documentación completa en [`docs/`](docs/). Empezá por [docs/01-overview.md](docs/01-overview.md).

## Stack

- **Front + back:** Next.js (App Router) en Vercel, un solo proyecto.
- **Datos + auth + storage:** Supabase (Postgres + pgvector + Auth + Storage).
- **Orquestación de canales:** n8n (webhooks WhatsApp/IG/Messenger). **Diferido**, se
  implementa después del primer hito.
- **LLM:** OpenAI — GPT-4o-mini (chat) + text-embedding-3-small (embeddings). Una
  sola cuenta OpenAI por ahora.
- **Extracción de docs:** extractor Node por defecto (`unpdf`/`pdf-parse`). MarkItDown
  (Python) es **opt-in vía env toggle**, apagado por default — necesita un worker Python
  aparte, no corre en una función de Vercel.
- **Local:** Docker (solo dev). **Deploy:** Next en Vercel (sin Docker) + Supabase
  gestionado. Ver [docs/06-deployment.md](docs/06-deployment.md).

## Invariantes de seguridad — NO NEGOCIABLES

Estas reglas son load-bearing. Romper una = fuga de datos entre clientes. Cada PR
que toque queries o schema se revisa contra esto.

1. **`tenant_id` en todas las tablas de negocio.** Las 6 tablas heredadas
   (`contacts`, `conversations`, `messages`, `documents`, `chunks`, `prompts`)
   llevan `tenant_id`. Nunca insertes una fila sin estamparlo.

2. **RLS prendido en el panel Y en el ingress.** Decisión [ADR-0002](docs/decisions/0002-rls-on-ingress.md):
   el ingress `/api/query` NO corre como service-role a pelo. Al abrir la
   transacción se setea `SELECT set_config('app.tenant_id', $1, true)` y las
   políticas RLS leen `current_setting('app.tenant_id')`. Así un olvido de filtro
   no es fuga: el peor caso es "no devuelve nada".

3. **Vector search siempre filtrado por tenant.** Toda búsqueda en `chunks` es
   `WHERE tenant_id = $actual AND <similaridad>`. Olvidarlo una vez = el bot del
   cliente A responde con la base del cliente B.

4. **`account_key` vs `contact_key` — no confundir.**
   - `account_key` (en `connected_accounts`) = quién *recibió* el mensaje (el número
     del negocio) → resuelve **qué tenant es**.
   - `contact_key` (en `contacts`/`conversations`) = quién *mandó* (el lead) →
     resuelve **la conversación dentro del tenant**.
   - Conversación única: `UNIQUE (tenant_id, channel, contact_key)`. Sin `tenant_id`
     en esa clave, dos tenants con el mismo lead colisionan.

5. **HMAC / secreto compartido entre n8n y `/api/query`.** El ingress no es
   superficie pública. (Aplica cuando se implemente n8n.)

6. **Caps de costo por tenant** (Fase 6). El cap de ingesta se valida **antes** de
   embeber, no después. Contá páginas/tokens y rechazá antes de gastar.

## Convenciones de código

- TypeScript estricto. Explícito sobre clever.
- DRY: si copiás lógica de tenant-scoping, extraela a un helper. El filtrado de
  `tenant_id` debería pasar por una sola capa (repos/queries), no repetirse a mano
  en cada handler.
- Cada codepath nuevo necesita logs. Sin observabilidad no se mergea.
- Nada de `catch (e) {}` mudo. Cada error tiene nombre y un destino visible.
- Tests: preferí de más que de menos. Las políticas RLS se testean con requests
  hechas a mano que intentan cruzar tenants (deben fallar).

## Estado actual

- **Hito 1: Fundaciones + panel sin canal.** Canales/n8n diferidos.
  - ✅ **Fase 1 — Fundaciones (completa).** Schema multi-tenant (9 tablas), pgvector +
    HNSW, RLS (panel + ingress + god-view) con tests de aislamiento pasando, scaffold
    Next.js + clientes Supabase + healthcheck. Supabase local en puertos 5532x (para
    coexistir con otros proyectos). Correr: `npm run db:test`.
  - ✅ **Fase 2 — Auth e invitaciones (completa).** Supabase Auth + middleware
    protegiendo `/panel`, login email/password, flujo de invitación sin email (el admin
    genera un link con `hashed_token` y se lo pasa al cliente), set-password, panel con
    god-view (platform admin) y vista de owner scopeada por RLS. Bootstrap del admin:
    `npm run db:bootstrap` (admin@local.dev / admin12345). Validado end-to-end.
  - ✅ **Fase 3 — Ingesta de documentos (completa).** Bucket Storage `documents` con
    RLS por tenant (prefijo de path), panel `/panel/documents` (upload + estado), pipeline
    extract (PDF/txt/md vía Node) → chunk → embed → `chunks` estampando `tenant_id`, cap de
    ingesta (docs/páginas/tamaño) validado antes de embeber. Embeddings OpenAI; mock
    determinista si no hay `OPENAI_API_KEY` (solo dev). Validado unit + integración RLS.
  - ⬜ **Fase 4 — RAG core `/api/query` + citas (E2)** (siguiente).
  - ⬜ Fase 4.5 evals · panel features.
- Roadmap completo y reordenado en [docs/05-roadmap.md](docs/05-roadmap.md).
- Trabajo diferido explícito en [TODOS.md](TODOS.md).

## Skill routing (gstack)

Cuando el pedido del usuario matchee una skill, invocala con la tool Skill.

- Estrategia/scope → `/plan-ceo-review`
- Arquitectura → `/plan-eng-review`
- Diseño / review de plan de diseño → `/plan-design-review` o `/design-consultation`
- Bugs/errores → `/investigate`
- QA de comportamiento web → `/qa` o `/qa-only`
- Review de diff → `/code-review` o `/review`
- Pulido visual → `/design-review`
- Ship/deploy/PR → `/ship` o `/land-and-deploy`
- Spec ejecutable desde una intención vaga → `/spec`
