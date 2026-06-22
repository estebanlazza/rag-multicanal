"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";

function backTo(tenantId: string, params: Record<string, string>): never {
  const qs = new URLSearchParams({ tenant: tenantId, ...params }).toString();
  redirect("/panel/prompts?" + qs);
}

export async function savePrompt(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) redirect("/panel");

  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const allowed =
    ctx.isPlatformAdmin || ctx.memberships.some((m) => m.tenant_id === tenantId);
  if (!allowed) redirect("/panel");

  const content = String(formData.get("content") ?? "").trim();
  if (content.length < 20) {
    backTo(tenantId, { error: "El prompt es demasiado corto" });
  }

  const supabase = await createClient();
  // upsert por tenant (RLS scopea: app_can_access_tenant(tenant_id)).
  const { error } = await supabase
    .from("prompts")
    .upsert({ tenant_id: tenantId, content }, { onConflict: "tenant_id" });
  if (error) backTo(tenantId, { error: "No se pudo guardar: " + error.message });

  revalidatePath("/panel/prompts");
  backTo(tenantId, { ok: "1" });
}
