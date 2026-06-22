import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/rag/prompt";
import { savePrompt } from "./actions";

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; error?: string; ok?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const { tenant: tenantParam, error, ok } = await searchParams;

  const tenantId = ctx.isPlatformAdmin ? tenantParam : ctx.memberships[0]?.tenant_id;

  if (ctx.isPlatformAdmin && !tenantId) {
    const supabase = await createClient();
    const { data: tenants } = await supabase.from("tenants").select("id, name, slug");
    return (
      <section>
        <h1>Prompt</h1>
        <p>Elegí un tenant:</p>
        <ul>
          {(tenants ?? []).map((t) => (
            <li key={t.id}>
              <Link href={`/panel/prompts?tenant=${t.id}`}>{t.name}</Link> <code>{t.slug}</code>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!tenantId) {
    return (
      <section>
        <h1>Prompt</h1>
        <p>Tu usuario no está asociado a ningún tenant.</p>
      </section>
    );
  }

  const supabase = await createClient();
  const { data: prompt } = await supabase
    .from("prompts")
    .select("content, updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const value = (prompt?.content as string) ?? DEFAULT_SYSTEM_PROMPT;
  const usingDefault = !prompt;

  return (
    <section>
      <h1>Prompt del bot</h1>
      <p style={{ color: "#555", fontSize: 14 }}>
        Define el tono y el comportamiento de tu bot. Es lo que el asistente recibe como
        instrucción de sistema en cada conversación.
      </p>
      {usingDefault && (
        <p style={{ color: "#8a6d00", fontSize: 14 }}>
          Estás viendo el <strong>ejemplo por defecto</strong>. Guardá para empezar a usar el tuyo.
        </p>
      )}
      {error && <p style={{ color: "#b00020", fontSize: 14 }}>{error}</p>}
      {ok && <p style={{ color: "#0a7d28", fontSize: 14 }}>Prompt guardado.</p>}

      <form action={savePrompt} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input type="hidden" name="tenant_id" value={tenantId} />
        <textarea
          name="content"
          defaultValue={value}
          rows={16}
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            padding: 10,
            width: "100%",
            boxSizing: "border-box",
          }}
        />
        <div>
          <button type="submit">Guardar prompt</button>
        </div>
      </form>
    </section>
  );
}
