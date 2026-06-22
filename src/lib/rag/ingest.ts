// Pipeline de ingesta de UN documento: download → extract → cap de páginas → chunk →
// embed → upsert chunks (estampando tenant_id). Corre con el cliente RLS-scoped del
// usuario (no service_role): RLS sigue siendo la frontera.
import type { SupabaseClient } from "@supabase/supabase-js";
import { extract } from "./extract";
import { chunkText } from "./chunk";
import { embed, toVectorLiteral } from "./embeddings";
import { checkPageCap } from "./caps";

type DocRow = {
  id: string;
  tenant_id: string;
  title: string | null;
  storage_path: string | null;
};

export async function processDocument(
  supabase: SupabaseClient,
  documentId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, tenant_id, title, storage_path")
    .eq("id", documentId)
    .single<DocRow>();

  if (docErr || !doc) return fail(supabase, documentId, "Documento no encontrado");
  if (!doc.storage_path) return fail(supabase, documentId, "Sin archivo asociado");

  await supabase.from("documents").update({ status: "processing", error: null }).eq("id", documentId);

  try {
    // 1. Descargar el archivo crudo de Storage.
    const dl = await supabase.storage.from("documents").download(doc.storage_path);
    if (dl.error || !dl.data) throw new Error("No se pudo descargar el archivo");
    const bytes = new Uint8Array(await dl.data.arrayBuffer());

    // 2. Extraer texto.
    const filename = doc.storage_path.split("/").pop() ?? doc.title ?? "doc";
    const { text, pageCount } = await extract(bytes, filename, "");
    if (!text) throw new Error("No se extrajo texto del documento");

    // 3. Cap de páginas (ANTES de embeber). Suma páginas de otros docs ready del tenant.
    const { data: others } = await supabase
      .from("documents")
      .select("page_count")
      .eq("tenant_id", doc.tenant_id)
      .eq("status", "ready")
      .neq("id", documentId);
    const existingPages = (others ?? []).reduce(
      (s, d) => s + ((d.page_count as number | null) ?? 0),
      0
    );
    const { data: tenant } = await supabase
      .from("tenants")
      .select("max_pages")
      .eq("id", doc.tenant_id)
      .single();
    const maxPages = (tenant?.max_pages as number | undefined) ?? 2000;
    const capErr = checkPageCap(existingPages, pageCount, maxPages);
    if (capErr) throw new Error(capErr.message);

    // 4. Chunk.
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("El documento no produjo chunks");

    // 5. Embed (mock si no hay OPENAI_API_KEY).
    const { vectors, provider } = await embed(chunks);

    // 6. Reemplazar chunks del doc (idempotente para reproceso), estampando tenant_id.
    await supabase.from("chunks").delete().eq("document_id", documentId);
    const rows = chunks.map((content, i) => ({
      tenant_id: doc.tenant_id,
      document_id: documentId,
      chunk_index: i,
      content,
      embedding: toVectorLiteral(vectors[i]),
      metadata: { embedding_provider: provider },
    }));
    const { error: insErr } = await supabase.from("chunks").insert(rows);
    if (insErr) throw new Error("Insertando chunks: " + insErr.message);

    // 7. Listo.
    await supabase
      .from("documents")
      .update({ status: "ready", page_count: pageCount, error: null })
      .eq("id", documentId);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido en ingesta";
    return fail(supabase, documentId, msg);
  }
}

async function fail(
  supabase: SupabaseClient,
  documentId: string,
  message: string
): Promise<{ ok: false; error: string }> {
  await supabase.from("documents").update({ status: "error", error: message }).eq("id", documentId);
  return { ok: false, error: message };
}
