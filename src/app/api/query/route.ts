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
    // 4. Embed de la consulta (mock si no hay OPENAI_API_KEY).
    const { vectors, provider } = await embed([text]);
    const queryVec = toVectorLiteral(vectors[0]);

    // 5. Todo lo demás dentro de la transacción tenant-scoped (RLS activo).
    const result = await withTenant(tenantId, async (tx) => {
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

      // retrieval: prefiltro WHERE tenant_id (frontera) + HNSW por similaridad coseno
      const chunks = await tx`
        select id, document_id, content,
               1 - (embedding <=> ${queryVec}::vector) as similarity
        from chunks
        where tenant_id = ${tenantId} and embedding is not null
        order by embedding <=> ${queryVec}::vector
        limit ${TOP_K}`;

      // prompt del tenant (o default)
      const [promptRow] = await tx`
        select content from prompts where tenant_id = ${tenantId} limit 1`;
      const systemPrompt = (promptRow?.content as string) ?? DEFAULT_SYSTEM_PROMPT;

      // generar respuesta
      const context = buildContext(chunks as unknown as { content: string }[]);
      const { answer, model } = await generateAnswer(systemPrompt, context, text);

      // citas (E2) + snapshot de chunks para logging
      const citations = chunks.map((c, i) => ({
        ref: i + 1,
        document_id: c.document_id as string,
        similarity: Number((c.similarity as number).toFixed(4)),
        excerpt: (c.content as string).slice(0, 160),
      }));

      // mensaje del asistente con snapshot completo en metadata
      await tx`
        insert into messages (tenant_id, conversation_id, role, content, metadata)
        values (${tenantId}, ${conv.id}, 'assistant', ${answer}, ${tx.json({
          model,
          embedding_provider: provider,
          retrieved: chunks.map((c) => ({
            id: c.id,
            document_id: c.document_id,
            similarity: c.similarity,
            content: c.content,
          })),
        })})`;

      return { answer, conversationId: conv.id as string, citations };
    });

    return NextResponse.json({
      answer: result.answer,
      conversation_id: result.conversationId,
      citations: result.citations,
    });
  } catch (e) {
    console.error("[/api/query] error:", e);
    return NextResponse.json({ error: "error interno" }, { status: 500 });
  }
}
