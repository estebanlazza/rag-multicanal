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
          RAG Chatbot
        </Link>
        <Link href="/panel/documents" style={{ fontSize: 14 }}>
          Documentos
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
