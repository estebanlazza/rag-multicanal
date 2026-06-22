import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PanelHome() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  // Platform admin: god-view de todos los tenants (RLS los devuelve todos).
  if (ctx.isPlatformAdmin) {
    const supabase = await createClient();
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, name, slug, status")
      .order("created_at", { ascending: true });

    return (
      <section>
        <h1>Tenants</h1>
        <p style={{ color: "#555" }}>Vista de plataforma. Todos los clientes del sistema.</p>
        <p>
          <Link href="/panel/admin/tenants">+ Crear tenant e invitar owner</Link>
        </p>
        {(tenants ?? []).length === 0 ? (
          <p>Todavía no hay tenants. Creá el primero (tu demo / tenant cero).</p>
        ) : (
          <ul>
            {tenants!.map((t) => (
              <li key={t.id}>
                <strong>{t.name}</strong> <code>{t.slug}</code> — {t.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // Owner: su tenant.
  const tenant = ctx.memberships[0];
  return (
    <section>
      <h1>{tenant?.tenant_name ?? "Tu panel"}</h1>
      {tenant ? (
        <p style={{ color: "#555" }}>
          Sos <strong>{tenant.role}</strong> de <code>{tenant.tenant_slug}</code>.
        </p>
      ) : (
        <p>Tu usuario todavía no está asociado a ningún tenant. Avisale al admin.</p>
      )}
      <p style={{ color: "#999", fontSize: 14 }}>
        Documentos, prompts y conversaciones llegan en las próximas fases.
      </p>
    </section>
  );
}
