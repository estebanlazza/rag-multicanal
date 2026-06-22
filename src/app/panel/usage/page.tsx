import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function bar(used: number, cap: number): string {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  return `${pct}%`;
}

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const { tenant: tenantParam } = await searchParams;
  const tenantId = ctx.isPlatformAdmin ? tenantParam : ctx.memberships[0]?.tenant_id;

  if (ctx.isPlatformAdmin && !tenantId) {
    const supabase = await createClient();
    const { data: tenants } = await supabase.from("tenants").select("id, name, slug");
    return (
      <section>
        <h1>Uso y límites</h1>
        <p>Elegí un tenant:</p>
        <ul>
          {(tenants ?? []).map((t) => (
            <li key={t.id}>
              <Link href={`/panel/usage?tenant=${t.id}`}>{t.name}</Link> <code>{t.slug}</code>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (!tenantId) {
    return (
      <section>
        <h1>Uso y límites</h1>
        <p>Tu usuario no está asociado a ningún tenant.</p>
      </section>
    );
  }

  const supabase = await createClient();
  const [{ data: tenant }, { data: usage }, { count: docCount }] = await Promise.all([
    supabase
      .from("tenants")
      .select("max_documents, max_pages, messages_per_hour_cap, daily_token_cap")
      .eq("id", tenantId)
      .single(),
    supabase
      .from("token_usage")
      .select("total_tokens, request_count")
      .eq("tenant_id", tenantId)
      .eq("usage_date", new Date().toISOString().slice(0, 10))
      .maybeSingle(),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  const tokensToday = Number(usage?.total_tokens ?? 0);
  const dailyCap = (tenant?.daily_token_cap as number) ?? 0;

  return (
    <section>
      <h1>Uso y límites</h1>
      <p style={{ color: "#555", fontSize: 14 }}>
        Los límites son por tenant: el consumo de uno no afecta a los demás.
      </p>

      <h2 style={{ fontSize: 16, marginTop: 16 }}>Hoy</h2>
      <p style={{ fontSize: 14 }}>
        Tokens consumidos: <strong>{tokensToday.toLocaleString("es-AR")}</strong> /{" "}
        {dailyCap.toLocaleString("es-AR")} ({bar(tokensToday, dailyCap)})
        <br />
        Consultas respondidas: <strong>{usage?.request_count ?? 0}</strong>
      </p>
      <div style={{ height: 8, background: "#eee", borderRadius: 4, maxWidth: 360, overflow: "hidden" }}>
        <div style={{ height: "100%", width: bar(tokensToday, dailyCap), background: "#4a90d9" }} />
      </div>

      <h2 style={{ fontSize: 16, marginTop: 20 }}>Límites del tenant</h2>
      <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          <tr><td style={{ padding: "4px 12px 4px 0" }}>Documentos</td><td><strong>{docCount ?? 0}</strong> / {tenant?.max_documents}</td></tr>
          <tr><td style={{ padding: "4px 12px 4px 0" }}>Páginas máx.</td><td>{tenant?.max_pages}</td></tr>
          <tr><td style={{ padding: "4px 12px 4px 0" }}>Mensajes por hora (por contacto)</td><td>{tenant?.messages_per_hour_cap}</td></tr>
          <tr><td style={{ padding: "4px 12px 4px 0" }}>Tokens por día</td><td>{dailyCap.toLocaleString("es-AR")}</td></tr>
        </tbody>
      </table>
    </section>
  );
}
