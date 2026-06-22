// Landing pública. ESTÁTICA: no hace una sola llamada viva a la API. El QR a WhatsApp
// se genera en build. CTA grande + QR resuelven la fricción de wa.me en desktop
// (el visitante escanea y cae en WhatsApp mobile sin login).
import Link from "next/link";
import QRCode from "qrcode";

const WA_NUMBER = process.env.NEXT_PUBLIC_DEMO_WHATSAPP || "5491100000000";
const WA_TEXT = process.env.NEXT_PUBLIC_DEMO_WHATSAPP_TEXT || "Hola! Quiero probar el bot.";
const WA_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_TEXT)}`;

const FEATURES = [
  { t: "Subí tus documentos", d: "PDFs, textos, lo que tengas. El bot responde con la info de tu negocio, sin inventar." },
  { t: "Atiende por WhatsApp", d: "Tus clientes le escriben a tu número y reciben respuestas al instante, 24/7." },
  { t: "Vos tenés el control", d: "Panel propio: editás el tono del bot, ves las conversaciones y medís la calidad." },
];

export default async function Landing() {
  const qr = await QRCode.toDataURL(WA_URL, { margin: 1, width: 220 });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#1a1a1a" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        <strong style={{ fontSize: 18 }}>RAG Chatbot</strong>
        <Link href="/login" style={{ fontSize: 14, color: "#1a1a1a" }}>
          Ingresar
        </Link>
      </header>

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px" }}>
        {/* Hero */}
        <section
          style={{
            display: "flex",
            gap: 40,
            flexWrap: "wrap",
            alignItems: "center",
            padding: "48px 0",
          }}
        >
          <div style={{ flex: "1 1 360px" }}>
            <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: "0 0 16px" }}>
              Un bot de WhatsApp que atiende a tus clientes con la info de tu negocio.
            </h1>
            <p style={{ fontSize: 18, color: "#555", margin: "0 0 28px" }}>
              Subís tus documentos, conectás tu WhatsApp y listo. Responde solo, con tu
              tono, sin que tengas que estar pendiente.
            </p>
            <a
              href={WA_URL}
              style={{
                display: "inline-block",
                background: "#25D366",
                color: "#fff",
                fontWeight: 600,
                fontSize: 18,
                padding: "14px 28px",
                borderRadius: 10,
                textDecoration: "none",
              }}
            >
              Probar el bot por WhatsApp →
            </a>
          </div>

          <div style={{ flex: "0 0 auto", textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR para chatear por WhatsApp" width={220} height={220}
              style={{ border: "1px solid #eee", borderRadius: 12 }} />
            <p style={{ fontSize: 13, color: "#888", margin: "8px 0 0" }}>
              Escaneá y chateá desde tu teléfono
            </p>
          </div>
        </section>

        {/* Features */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 24,
            padding: "24px 0 56px",
          }}
        >
          {FEATURES.map((f) => (
            <div key={f.t}>
              <h3 style={{ fontSize: 18, margin: "0 0 8px" }}>{f.t}</h3>
              <p style={{ fontSize: 15, color: "#555", margin: 0 }}>{f.d}</p>
            </div>
          ))}
        </section>
      </main>

      <footer
        style={{
          borderTop: "1px solid #eee",
          padding: "24px",
          textAlign: "center",
          fontSize: 13,
          color: "#888",
        }}
      >
        <Link href="/privacidad" style={{ color: "#888" }}>
          Política de privacidad
        </Link>
        <span> · Tus datos se tratan según la Ley 25.326 (Argentina).</span>
      </footer>
    </div>
  );
}
