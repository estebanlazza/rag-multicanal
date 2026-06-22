import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function fmt(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export default async function ConversationsPage({
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
        <h1>Conversaciones</h1>
        <p>Elegí un tenant:</p>
        <ul>
          {(tenants ?? []).map((t) => (
            <li key={t.id}>
              <Link href={`/panel/conversations?tenant=${t.id}`}>{t.name}</Link> <code>{t.slug}</code>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!tenantId) {
    return (
      <section>
        <h1>Conversaciones</h1>
        <p>Tu usuario no está asociado a ningún tenant.</p>
      </section>
    );
  }

  const supabase = await createClient();
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, channel, contact_key, status, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <section>
      <h1>Conversaciones</h1>
      {(convs ?? []).length === 0 ? (
        <p>Todavía no hay conversaciones.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "6px 8px" }}>Contacto</th>
              <th style={{ padding: "6px 8px" }}>Canal</th>
              <th style={{ padding: "6px 8px" }}>Estado</th>
              <th style={{ padding: "6px 8px" }}>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {convs!.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "6px 8px" }}>
                  <Link href={`/panel/conversations/${c.id}?tenant=${tenantId}`}>
                    {c.contact_key}
                  </Link>
                </td>
                <td style={{ padding: "6px 8px" }}>{c.channel}</td>
                <td style={{ padding: "6px 8px" }}>{c.status}</td>
                <td style={{ padding: "6px 8px" }}>{fmt(c.updated_at as string)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
