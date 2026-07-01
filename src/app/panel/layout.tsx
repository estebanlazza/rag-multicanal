import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 20px",
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <Link href="/panel" style={{ fontWeight: 600, textDecoration: "none", color: "inherit" }}>
          Ragent
        </Link>
        <Link href="/panel/conversations" style={{ fontSize: 14 }}>
          Conversaciones
        </Link>
        <Link href="/panel/documents" style={{ fontSize: 14 }}>
          Documentos
        </Link>
        <Link href="/panel/prompts" style={{ fontSize: 14 }}>
          Prompt
        </Link>
        <Link href="/panel/evals" style={{ fontSize: 14 }}>
          Evals
        </Link>
        <Link href="/panel/usage" style={{ fontSize: 14 }}>
          Uso
        </Link>
        {ctx.isPlatformAdmin && (
          <Link href="/panel/admin/tenants" style={{ fontSize: 14 }}>
            Tenants
          </Link>
        )}
        <span style={{ marginLeft: "auto", fontSize: 14, color: "#555" }}>
          {ctx.user.email}
          {ctx.isPlatformAdmin && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 12,
                background: "#eef",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              platform admin
            </span>
          )}
        </span>
        <form action="/auth/signout" method="post">
          <button type="submit" style={{ fontSize: 14 }}>
            Salir
          </button>
        </form>
      </header>
      <main style={{ padding: "20px", maxWidth: 880, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
