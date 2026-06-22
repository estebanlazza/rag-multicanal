// Ingress RAG. SOLO lo consume n8n (server-to-server, autenticado por HMAC).
// Corre como app_ingress con app.tenant_id seteado por request (ADR-0002): RLS protege.
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { verifySignature } from "@/lib/ingress/hmac";
import { resolveTenant, withTenant } from "@/lib/ingress/db";
import { embed, toVectorLiteral } from "@/lib/rag/embeddings";
import { generateAnswer } from "@/lib/rag/answer";
import { DEFAULT_SYSTEM_PROMPT, buildContext } from "@/lib/rag/prompt";

export const runtime = "nodejs";

const TOP_K = 5;

type Citation = { ref: number; document_id: string; similarity: number; excerpt: string };
type QueryResult = {
  answer: string;
  conversationId: string;
  citations: Citation[];
  capped: string | null;
};

type Body = {
  channel?: string;
  account_key?: string;
  contact_key?: string;
  text?: string;
};

export async function POST(request: NextRequest) {
  // 1. Autenticación HMAC sobre el body crudo.
  const raw = await request.text();
  const valid = verifySignature(
    raw,
    request.headers.get("x-signature"),
    request.headers.get("x-timestamp"),
    serverEnv.ingressHmacSecret()
  );
  if (!valid) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  // 2. Parseo y validación.
  let body: Body;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }
  const channel = body.channel?.trim();
  const accountKey = body.account_key?.trim();
  const contactKey = body.contact_key?.trim();
  const text = body.text?.trim();
  if (!channel || !accountKey || !contactKey || !text) {
    return NextResponse.json(
      { error: "faltan channel, account_key, contact_key o text" },
      { status: 400 }
    );
  }

  // 3. Resolver tenant por cuenta destino (antes de setear app.tenant_id).
  const tenantId = await resolveTenant(channel, accountKey);
  if (!tenantId) {
    return NextResponse.json({ error: "cuenta no registrada" }, { status: 404 });
  }

  try {
    // Todo dentro de la transacción tenant-scoped (RLS activo).
    const result = await withTenant<QueryResult>(tenantId, async (tx) => {
      // Respuesta cuando se corta por cap: contesta sin gastar el LLM y lo deja logueado.
      const capped = async (
        kind: "rate" | "budget",
        conversationId: string
      ): Promise<QueryResult> => {
        const answer =
          kind === "rate"
            ? "Recibimos muchos mensajes tuyos en la última hora. Esperá un momento y volvé a escribir 🙏"
            : "Por hoy llegamos al límite de consultas. Escribinos mañana y te respondemos 🙏";
        await tx`
          insert into messages (tenant_id, conversation_id, role, content, metadata)
          values (${tenantId}, ${conversationId}, 'assistant', ${answer}, ${tx.json({ capped: kind })})`;
        return { answer, conversationId, citations: [], capped: kind };
      };

      // upsert contacto
      const [contact] = await tx`
        insert into contacts (tenant_id, channel, contact_key)
        values (${tenantId}, ${channel}, ${contactKey})
        on conflict (tenant_id, channel, contact_key)
          do update set contact_key = excluded.contact_key
        returning id`;

      // upsert conversación (única por tenant_id, channel, contact_key)
      const [conv] = await tx`
        insert into conversations (tenant_id, contact_id, channel, contact_key)
        values (${tenantId}, ${contact.id}, ${channel}, ${contactKey})
        on conflict (tenant_id, channel, contact_key)
          do update set updated_at = now()
        returning id`;

      // mensaje entrante del lead
      await tx`
        insert into messages (tenant_id, conversation_id, role, content)
        values (${tenantId}, ${conv.id}, 'user', ${text})`;

      // ── Controles de costo (Fase 6): chequear ANTES de gastar el LLM ──────
      const [caps] = await tx`
        select messages_per_hour_cap, daily_token_cap from tenants where id = ${tenantId}`;

      // Rate limit: mensajes del lead en la última hora.
      const [{ recent }] = await tx`
        select count(*)::int as recent from messages
        where conversation_id = ${conv.id} and role = 'user'
          and created_at > now() - interval '1 hour'`;
      if (recent > caps.messages_per_hour_cap) {
        return capped("rate", conv.id as string);
      }

      // Circuit breaker: techo de tokens/día por tenant.
      const [usage] = await tx`
        select total_tokens from token_usage
        where tenant_id = ${tenantId} and usage_date = current_date`;
      if (usage && Number(usage.total_tokens) >= caps.daily_token_cap) {
        return capped("budget", conv.id as string);
      }

      // ── Camino normal ────────────────────────────────────────────────────
      const { vectors, provider } = await embed([text]);
      const queryVec = toVectorLiteral(vectors[0]);

      const chunks = await tx`
        select id, document_id, content, similarity
        from match_chunks(${tenantId}, ${queryVec}::vector, ${TOP_K})`;

      const [promptRow] = await tx`
        select content from prompts where tenant_id = ${tenantId} limit 1`;
      const systemPrompt = (promptRow?.content as string) ?? DEFAULT_SYSTEM_PROMPT;

      const context = buildContext(chunks as unknown as { content: string }[]);
      const { answer, model, tokens } = await generateAnswer(systemPrompt, context, text);

      // Registrar consumo de tokens del día (circuit breaker se alimenta de acá).
      await tx`
        insert into token_usage (tenant_id, usage_date, total_tokens, request_count)
        values (${tenantId}, current_date, ${tokens}, 1)
        on conflict (tenant_id, usage_date) do update
          set total_tokens = token_usage.total_tokens + ${tokens},
              request_count = token_usage.request_count + 1`;

      const citations = chunks.map((c, i) => ({
        ref: i + 1,
        document_id: c.document_id as string,
        similarity: Number((c.similarity as number).toFixed(4)),
        excerpt: (c.content as string).slice(0, 160),
      }));

      await tx`
        insert into messages (tenant_id, conversation_id, role, content, metadata)
        values (${tenantId}, ${conv.id}, 'assistant', ${answer}, ${tx.json({
          model,
          embedding_provider: provider,
          tokens,
          retrieved: chunks.map((c) => ({
            id: c.id,
            document_id: c.document_id,
            similarity: c.similarity,
            content: c.content,
          })),
        })})`;

      return { answer, conversationId: conv.id as string, citations, capped: null as string | null };
    });

    return NextResponse.json({
      answer: result.answer,
      conversation_id: result.conversationId,
      citations: result.citations,
      ...(result.capped ? { capped: result.capped } : {}),
    });
  } catch (e) {
    console.error("[/api/query] error:", e);
    return NextResponse.json({ error: "error interno" }, { status: 500 });
  }
}
