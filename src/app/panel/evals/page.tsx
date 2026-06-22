import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addEvalCase, deleteEvalCase, runEvalsAction } from "./actions";

function badge(v: boolean | null): string {
  if (v === null) return "—";
  return v ? "✓" : "✗";
}

export default async function EvalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; error?: string; ok?: string; ran?: string; provider?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const sp = await searchParams;

  const tenantId = ctx.isPlatformAdmin ? sp.tenant : ctx.memberships[0]?.tenant_id;

  if (ctx.isPlatformAdmin && !tenantId) {
    const supabase = await createClient();
    const { data: tenants } = await supabase.from("tenants").select("id, name, slug");
    return (
      <section>
        <h1>Evals</h1>
        <p>Elegí un tenant:</p>
        <ul>
          {(tenants ?? []).map((t) => (
            <li key={t.id}>
              <Link href={`/panel/evals?tenant=${t.id}`}>{t.name}</Link> <code>{t.slug}</code>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (!tenantId) {
    return (
      <section>
        <h1>Evals</h1>
        <p>Tu usuario no está asociado a ningún tenant.</p>
      </section>
    );
  }

  const supabase = await createClient();
  const [{ data: cases }, { data: results }, { data: docs }] = await Promise.all([
    supabase
      .from("eval_cases")
      .select("id, question, expected_document_id, must_include, must_not_include, should_defer")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
    supabase
      .from("eval_results")
      .select("eval_case_id, retrieval_ok, answer_ok, defer_ok, top_similarity, ran_at")
      .eq("tenant_id", tenantId),
    supabase.from("documents").select("id, title").eq("tenant_id", tenantId),
  ]);

  const resultByCase = new Map(
    (results ?? []).map((r) => [r.eval_case_id as string, r])
  );
  const docTitle = new Map((docs ?? []).map((d) => [d.id as string, d.title as string]));

  return (
    <section>
      <h1>Evals</h1>
      <p style={{ color: "#555", fontSize: 14 }}>
        Casos de prueba por tenant. Corrélos al cambiar el prompt o reingestar para cazar
        regresiones de calidad.
      </p>

      {sp.error && <p style={{ color: "#b00020", fontSize: 14 }}>{sp.error}</p>}
      {sp.ok && <p style={{ color: "#0a7d28", fontSize: 14 }}>Guardado.</p>}
      {sp.ran && (
        <div style={{ background: "#eef6ff", border: "1px solid #bcd6f0", padding: 10, borderRadius: 6 }}>
          Última corrida: <strong>{sp.ran}</strong> casos OK.
          {sp.provider === "mock" && (
            <span style={{ color: "#8a6d00" }}>
              {" "}
              ⚠ embeddings MOCK (sin OPENAI_API_KEY): los resultados NO son significativos.
            </span>
          )}
        </div>
      )}

      <form action={runEvalsAction} style={{ margin: "12px 0 20px" }}>
        <input type="hidden" name="tenant_id" value={tenantId} />
        <button type="submit">▶ Correr evals</button>
      </form>

      {(cases ?? []).length === 0 ? (
        <p>Todavía no hay casos. Agregá el primero abajo.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "6px 8px" }}>Pregunta</th>
              <th style={{ padding: "6px 8px" }}>Doc esperado</th>
              <th style={{ padding: "6px 8px" }} title="retrieval / answer / defer">R / A / D</th>
              <th style={{ padding: "6px 8px" }}>Sim.</th>
              <th style={{ padding: "6px 8px" }}></th>
            </tr>
          </thead>
          <tbody>
            {cases!.map((c) => {
              const r = resultByCase.get(c.id as string);
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "6px 8px" }}>
                    {c.question}
                    {c.should_defer && (
                      <span style={{ color: "#888", fontSize: 12 }}> (debería deferir)</span>
                    )}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    {c.expected_document_id
                      ? docTitle.get(c.expected_document_id as string) ?? "—"
                      : "—"}
                  </td>
                  <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>
                    {r ? `${badge(r.retrieval_ok)} ${badge(r.answer_ok)} ${badge(r.defer_ok)}` : "— — —"}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    {r?.top_similarity != null ? Number(r.top_similarity).toFixed(3) : "—"}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <form action={deleteEvalCase}>
                      <input type="hidden" name="tenant_id" value={tenantId} />
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" style={{ fontSize: 13, color: "#b00020" }}>
                        Borrar
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 24, fontSize: 16 }}>Agregar caso</h2>
      <form action={addEvalCase} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 520 }}>
        <input type="hidden" name="tenant_id" value={tenantId} />
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Pregunta
          <input name="question" required placeholder="¿Qué horario tienen?" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Documento esperado (opcional)
          <select name="expected_document_id" defaultValue="">
            <option value="">— ninguno —</option>
            {(docs ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          La respuesta DEBE incluir (separá con coma)
          <input name="must_include" placeholder="lunes a sábado, 9 a 18" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          La respuesta NO debe incluir (separá con coma)
          <input name="must_not_include" placeholder="domingo" />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="should_defer" />
          Debería deferir (la info no está en los docs; no inventar)
        </label>
        <div>
          <button type="submit">Agregar caso</button>
        </div>
      </form>
    </section>
  );
}
