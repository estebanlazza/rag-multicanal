"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { processDocument } from "@/lib/rag/ingest";
import { checkFileSize, checkDocCount, isSupported } from "@/lib/rag/caps";

// Verifica que el usuario puede operar sobre ese tenant (owner del tenant o platform admin).
async function assertTenantAccess(tenantId: string) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const allowed =
    ctx.isPlatformAdmin || ctx.memberships.some((m) => m.tenant_id === tenantId);
  if (!allowed) redirect("/panel");
  return ctx;
}

function backTo(tenantId: string, params: Record<string, string>): never {
  const qs = new URLSearchParams({ tenant: tenantId, ...params }).toString();
  redirect("/panel/documents?" + qs);
}

export async function uploadDocument(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) redirect("/panel");
  await assertTenantAccess(tenantId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    backTo(tenantId, { error: "Elegí un archivo" });
  }

  if (!isSupported(file.name, file.type)) {
    backTo(tenantId, { error: "Tipo no soportado (PDF, .txt o .md)" });
  }
  const sizeErr = checkFileSize(file.size);
  if (sizeErr) backTo(tenantId, { error: sizeErr.message });

  const supabase = await createClient();

  // Cap de cantidad de documentos.
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const { data: tenant } = await supabase
    .from("tenants")
    .select("max_documents")
    .eq("id", tenantId)
    .single();
  const docErr = checkDocCount(count ?? 0, (tenant?.max_documents as number) ?? 50);
  if (docErr) backTo(tenantId, { error: docErr.message });

  // 1. Crear la fila del documento (pending) para tener el id.
  const { data: doc, error: insErr } = await supabase
    .from("documents")
    .insert({ tenant_id: tenantId, title: file.name, status: "pending" })
    .select("id")
    .single();
  if (insErr || !doc) backTo(tenantId, { error: "No se pudo registrar el documento" });

  // 2. Subir el archivo crudo a Storage: {tenant_id}/{document_id}/{filename}
  const path = `${tenantId}/${doc!.id}/${file.name}`;
  const up = await supabase.storage.from("documents").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (up.error) {
    await supabase.from("documents").delete().eq("id", doc!.id);
    backTo(tenantId, { error: "Falló la subida: " + up.error.message });
  }
  await supabase.from("documents").update({ storage_path: path }).eq("id", doc!.id);

  // 3. Procesar (extract → chunk → embed → chunks). Inline: al volver ya está listo/error.
  const result = await processDocument(supabase, doc!.id);

  revalidatePath("/panel/documents");
  backTo(tenantId, result.ok ? { ok: "1" } : { error: result.error ?? "Error procesando" });
}

export async function reprocessDocument(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "");
  const documentId = String(formData.get("document_id") ?? "");
  await assertTenantAccess(tenantId);

  const supabase = await createClient();
  const result = await processDocument(supabase, documentId);
  revalidatePath("/panel/documents");
  backTo(tenantId, result.ok ? { ok: "1" } : { error: result.error ?? "Error procesando" });
}

export async function deleteDocument(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "");
  const documentId = String(formData.get("document_id") ?? "");
  await assertTenantAccess(tenantId);

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();
  if (doc?.storage_path) {
    await supabase.storage.from("documents").remove([doc.storage_path as string]);
  }
  // chunks se borran por FK on delete cascade.
  await supabase.from("documents").delete().eq("id", documentId);
  revalidatePath("/panel/documents");
  backTo(tenantId, { ok: "1" });
}
