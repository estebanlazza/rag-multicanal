// Runner de evals. Corre cada caso por el pipeline real (mismo match_chunks que
// /api/query) y guarda el resultado de la última corrida en eval_results.
// Tres chequeos por caso (los que apliquen): retrieval hit@k, aserciones de la
// respuesta (include/exclude), y "debería deferir" (no alucinar).
import type { SupabaseClient } from "@supabase/supabase-js";
import { embed } from "./embeddings";
import { generateAnswer } from "./answer";
import { DEFAULT_SYSTEM_PROMPT, buildContext } from "./prompt";

const TOP_K = 5;

// Heurística simple de "el bot dijo que no sabe" (en vez de inventar).
const DEFER_PATTERNS = [
  /no tengo/i,
  /no cuento/i,
  /no dispongo/i,
  /no s[eé]\b/i,
  /no .{0,25}informaci[oó]n/i,
  /consult/i,
];

type EvalCase = {
  id: string;
  question: string;
  expected_document_id: string | null;
  must_include: string[];
  must_not_include: string[];
  should_defer: boolean;
};

export type EvalSummary = {
  total: number;
  passed: number;
  provider: string;
};

export async function runEvals(
  supabase: SupabaseClient,
  tenantId: string
): Promise<EvalSummary> {
  const { data: cases } = await supabase
    .from("eval_cases")
    .select("id, question, expected_document_id, must_include, must_not_include, should_defer")
    .eq("tenant_id", tenantId);

  const { data: promptRow } = await supabase
    .from("prompts")
    .select("content")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const systemPrompt = (promptRow?.content as string) ?? DEFAULT_SYSTEM_PROMPT;

  let passed = 0;
  let provider = "n/a";

  for (const c of (cases ?? []) as EvalCase[]) {
    const embedded = await embed([c.question]);
    provider = embedded.provider;

    const { data: chunks } = await supabase.rpc("match_chunks", {
      p_tenant: tenantId,
      query_embedding: embedded.vectors[0],
      match_count: TOP_K,
    });
    const rows = (chunks ?? []) as {
      document_id: string;
      content: string;
      similarity: number;
    }[];
    const topSim = rows.length ? Math.max(...rows.map((r) => r.similarity)) : null;

    // 1. retrieval hit@k (solo si el caso declara documento esperado)
    let retrievalOk: boolean | null = null;
    if (c.expected_document_id) {
      retrievalOk = rows.some((r) => r.document_id === c.expected_document_id);
    }

    // respuesta del LLM con el contexto recuperado
    const { answer, model } = await generateAnswer(
      systemPrompt,
      buildContext(rows),
      c.question
    );
    const lower = answer.toLowerCase();

    // 2. aserciones include/exclude (solo si hay alguna)
    let answerOk: boolean | null = null;
    const inc = c.must_include ?? [];
    const exc = c.must_not_include ?? [];
    if (inc.length || exc.length) {
      answerOk =
        inc.every((s) => lower.includes(s.toLowerCase())) &&
        exc.every((s) => !lower.includes(s.toLowerCase()));
    }

    // 3. debería deferir (no inventar)
    let deferOk: boolean | null = null;
    if (c.should_defer) deferOk = DEFER_PATTERNS.some((r) => r.test(answer));

    const checks = [retrievalOk, answerOk, deferOk].filter(
      (v): v is boolean => v !== null
    );
    const casePass = checks.length > 0 && checks.every(Boolean);
    if (casePass) passed++;

    await supabase.from("eval_results").upsert(
      {
        tenant_id: tenantId,
        eval_case_id: c.id,
        ran_at: new Date().toISOString(),
        retrieval_ok: retrievalOk,
        answer_ok: answerOk,
        defer_ok: deferOk,
        top_similarity: topSim,
        answer,
        model,
        provider: embedded.provider,
      },
      { onConflict: "eval_case_id" }
    );
  }

  return { total: (cases ?? []).length, passed, provider };
}
