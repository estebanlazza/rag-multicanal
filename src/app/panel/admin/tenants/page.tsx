import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createTenantAndInvite } from "./actions";

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.isPlatformAdmin) redirect("/panel");

  const { error, invite } = await searchParams;

  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, status")
    .order("created_at", { ascending: true });

  return (
    <section>
      <h1>Tenants</h1>

      {error && <p style={{ color: "#b00020", fontSize: 14 }}>{error}</p>}
      {invite && (
        <div style={{ background: "#f3fff3", border: "1px solid #bce5bc", padding: 12, borderRadius: 6 }}>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Link de invitación generado.</strong> Mandáselo al owner del tenant:
          </p>
          <code style={{ wordBreak: "break-all", fontSize: 13 }}>{invite}</code>
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>Crear tenant e invitar owner</h2>
      <form
        action={createTenantAndInvite}
        style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Nombre del negocio
          <input name="name" required placeholder="Heladería La Rosa" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Slug
          <input name="slug" required placeholder="la-rosa" pattern="[a-z0-9-]+" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Email del owner
          <input type="email" name="email" required placeholder="dueño@negocio.com" />
        </label>
        <button type="submit">Crear e invitar</button>
      </form>

      <h2 style={{ marginTop: 24 }}>Existentes</h2>
      {(tenants ?? []).length === 0 ? (
        <p>Ninguno todavía.</p>
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
