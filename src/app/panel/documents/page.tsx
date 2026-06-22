import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uploadDocument, reprocessDocument, deleteDocument } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  pending: "pendiente",
  processing: "procesando",
  ready: "listo",
  error: "error",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; error?: string; ok?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const { tenant: tenantParam, error, ok } = await searchParams;

  // Tenant activo: owner → el suyo; platform admin → el del ?tenant.
  const tenantId = ctx.isPlatformAdmin
    ? tenantParam
    : ctx.memberships[0]?.tenant_id;

  // Platform admin sin tenant elegido: pedir que elija.
  if (ctx.isPlatformAdmin && !tenantId) {
    const supabase = await createClient();
    const { data: tenants } = await supabase.from("tenants").select("id, name, slug");
    return (
      <section>
        <h1>Documentos</h1>
        <p>Elegí un tenant:</p>
        <ul>
          {(tenants ?? []).map((t) => (
            <li key={t.id}>
              <Link href={`/panel/documents?tenant=${t.id}`}>{t.name}</Link> <code>{t.slug}</code>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!tenantId) {
    return (
      <section>
        <h1>Documentos</h1>
        <p>Tu usuario no está asociado a ningún tenant.</p>
      </section>
    );
  }

  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, status, page_count, error, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (
    <section>
      <h1>Documentos</h1>
      {error && <p style={{ color: "#b00020", fontSize: 14 }}>{error}</p>}
      {ok && <p style={{ color: "#0a7d28", fontSize: 14 }}>Hecho.</p>}

      <form
        action={uploadDocument}
        style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0 20px" }}
      >
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input type="file" name="file" accept=".pdf,.txt,.md,.markdown" required />
        <button type="submit">Subir</button>
      </form>
      <p style={{ color: "#999", fontSize: 13, marginTop: -12 }}>
        PDF, .txt o .md · máx 10 MB. Al subir se extrae, chunkea y embebe automáticamente.
      </p>

      {(docs ?? []).length === 0 ? (
        <p>Todavía no hay documentos.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "6px 8px" }}>Documento</th>
              <th style={{ padding: "6px 8px" }}>Estado</th>
              <th style={{ padding: "6px 8px" }}>Páginas</th>
              <th style={{ padding: "6px 8px" }}></th>
            </tr>
          </thead>
          <tbody>
            {docs!.map((d) => (
              <tr key={d.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "6px 8px" }}>{d.title}</td>
                <td style={{ padding: "6px 8px" }}>
                  {STATUS_LABEL[d.status as string] ?? d.status}
                  {d.status === "error" && d.error && (
                    <span style={{ color: "#b00020" }}> — {d.error}</span>
                  )}
                </td>
                <td style={{ padding: "6px 8px" }}>{d.page_count ?? "—"}</td>
                <td style={{ padding: "6px 8px", display: "flex", gap: 6 }}>
                  <form action={reprocessDocument}>
                    <input type="hidden" name="tenant_id" value={tenantId} />
                    <input type="hidden" name="document_id" value={d.id} />
                    <button type="submit" style={{ fontSize: 13 }}>
                      Reprocesar
                    </button>
                  </form>
                  <form action={deleteDocument}>
                    <input type="hidden" name="tenant_id" value={tenantId} />
                    <input type="hidden" name="document_id" value={d.id} />
                    <button type="submit" style={{ fontSize: 13, color: "#b00020" }}>
                      Borrar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
