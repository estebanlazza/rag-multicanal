"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { runEvals } from "@/lib/rag/evals";

async function assertAccess(tenantId: string) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const allowed =
    ctx.isPlatformAdmin || ctx.memberships.some((m) => m.tenant_id === tenantId);
  if (!allowed) redirect("/panel");
}

function backTo(tenantId: string, params: Record<string, string>): never {
  const qs = new URLSearchParams({ tenant: tenantId, ...params }).toString();
  redirect("/panel/evals?" + qs);
}

// "a, b\nc" → ["a","b","c"]
function parseList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function addEvalCase(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) redirect("/panel");
  await assertAccess(tenantId);

  const question = String(formData.get("question") ?? "").trim();
  if (!question) backTo(tenantId, { error: "Escribí la pregunta" });

  const expected = String(formData.get("expected_document_id") ?? "").trim();
  const mustInclude = parseList(String(formData.get("must_include") ?? ""));
  const mustNotInclude = parseList(String(formData.get("must_not_include") ?? ""));
  const shouldDefer = formData.get("should_defer") === "on";

  const supabase = await createClient();
  const { error } = await supabase.from("eval_cases").insert({
    tenant_id: tenantId,
    question,
    expected_document_id: expected || null,
    must_include: mustInclude,
    must_not_include: mustNotInclude,
    should_defer: shouldDefer,
  });
  if (error) backTo(tenantId, { error: "No se pudo guardar: " + error.message });

  revalidatePath("/panel/evals");
  backTo(tenantId, { ok: "1" });
}

export async function deleteEvalCase(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "");
  const id = String(formData.get("id") ?? "");
  await assertAccess(tenantId);

  const supabase = await createClient();
  await supabase.from("eval_cases").delete().eq("id", id);
  revalidatePath("/panel/evals");
  backTo(tenantId, { ok: "1" });
}

export async function runEvalsAction(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "");
  await assertAccess(tenantId);

  const supabase = await createClient();
  const summary = await runEvals(supabase, tenantId);
  revalidatePath("/panel/evals");
  backTo(tenantId, {
    ran: `${summary.passed}/${summary.total}`,
    provider: summary.provider,
  });
}
