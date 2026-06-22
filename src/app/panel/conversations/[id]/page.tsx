import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Retrieved = { document_id: string; similarity: number; content: string };

function fmt(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export default async function ConversationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const { id } = await params;
  const { tenant } = await searchParams;
  const backHref = tenant ? `/panel/conversations?tenant=${tenant}` : "/panel/conversations";

  const supabase = await createClient();

  // RLS scopea: si la conversación no es accesible, no devuelve mensajes.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, channel, contact_key")
    .eq("id", id)
    .maybeSingle();

  if (!conv) {
    return (
      <section>
        <p>
          <Link href={backHref}>← Conversaciones</Link>
        </p>
        <p>Conversación no encontrada.</p>
      </section>
    );
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, metadata, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  // Títulos de los documentos citados, para mostrar algo legible.
  const docIds = new Set<string>();
  for (const m of messages ?? []) {
    const retrieved = (m.metadata as { retrieved?: Retrieved[] } | null)?.retrieved ?? [];
    retrieved.forEach((r) => docIds.add(r.document_id));
  }
  const titleById = new Map<string, string>();
  if (docIds.size > 0) {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, title")
      .in("id", [...docIds]);
    (docs ?? []).forEach((d) => titleById.set(d.id as string, (d.title as string) ?? "documento"));
  }

  return (
    <section>
      <p>
        <Link href={backHref}>← Conversaciones</Link>
      </p>
      <h1 style={{ fontSize: 18 }}>
        {conv.contact_key} <span style={{ color: "#888", fontWeight: 400 }}>· {conv.channel}</span>
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {(messages ?? []).map((m) => {
          const isUser = m.role === "user";
          const retrieved = (m.metadata as { retrieved?: Retrieved[] } | null)?.retrieved ?? [];
          return (
            <div
              key={m.id}
              style={{
                alignSelf: isUser ? "flex-start" : "flex-end",
                maxWidth: "75%",
                background: isUser ? "#f1f1f1" : "#e7f0ff",
                borderRadius: 10,
                padding: "8px 12px",
              }}
            >
              <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>
                {isUser ? "Lead" : "Bot"} · {fmt(m.created_at as string)}
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{m.content}</div>

              {!isUser && retrieved.length > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ fontSize: 12, color: "#555", cursor: "pointer" }}>
                    {retrieved.length} fuente(s)
                  </summary>
                  <ul style={{ fontSize: 12, color: "#444", margin: "6px 0 0", paddingLeft: 16 }}>
                    {retrieved.map((r, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        <strong>{titleById.get(r.document_id) ?? "documento"}</strong>{" "}
                        <span style={{ color: "#888" }}>({r.similarity.toFixed(3)})</span>
                        <br />
                        <span>{r.content.slice(0, 140)}…</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
