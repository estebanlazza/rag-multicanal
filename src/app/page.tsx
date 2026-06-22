// Placeholder del esqueleto (Fase 1). El panel real llega en Fase 2+.
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>RAG Chatbot</h1>
      <p>Esqueleto multi-tenant — Fase 1 (fundaciones).</p>
      <p>
        Healthcheck: <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
