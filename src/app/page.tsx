// Landing pública de Ragent. ESTÁTICA (sin llamadas vivas a la API): el QR a WhatsApp
// se genera en build. Orientada a SEO (metadata + Open Graph + JSON-LD) y a vender el
// producto tanto a dueños/CEOs (ROI, control, escala) como a equipos (menos repetitivo).
import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ragent.beele.tech";
const WA_NUMBER = process.env.NEXT_PUBLIC_DEMO_WHATSAPP || "5491100000000";
const WA_TEXT = process.env.NEXT_PUBLIC_DEMO_WHATSAPP_TEXT || "Hola! Quiero probar Ragent.";
const WA_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_TEXT)}`;

const TITLE = "Atención al cliente por WhatsApp con IA";
const DESCRIPTION =
  "Ragent responde a tus clientes por WhatsApp con la información real de tu negocio. " +
  "RAG conversacional: cita sus fuentes, no inventa y atiende 24/7. Tu equipo se libera de lo repetitivo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "chatbot WhatsApp",
    "atención al cliente con IA",
    "bot de WhatsApp para empresas",
    "asistente virtual WhatsApp",
    "RAG conversacional",
    "responder clientes automático",
    "chatbot IA Argentina",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: `Ragent — ${TITLE}`,
    description: DESCRIPTION,
    url: "/",
    siteName: "Ragent",
    type: "website",
    locale: "es_AR",
  },
  twitter: { card: "summary_large_image", title: `Ragent — ${TITLE}`, description: DESCRIPTION },
};

const STEPS = [
  {
    n: "1",
    t: "Subí tus documentos",
    d: "Catálogos, listas de precios, preguntas frecuentes, manuales. En PDF o texto.",
  },
  {
    n: "2",
    t: "Ragent arma la base de conocimiento",
    d: "Los procesa con IA e indexa (embeddings + RAG). Listo en minutos, sin código.",
  },
  {
    n: "3",
    t: "Atiende por WhatsApp",
    d: "Tus clientes escriben y reciben respuestas al instante, con la fuente citada.",
  },
];

const FEATURES = [
  { t: "Responde 24/7 en segundos", d: "Ningún lead se queda sin respuesta por horario ni por saturación." },
  { t: "Con tu info, no genérica", d: "Habla de tus productos, precios y políticas reales, no de generalidades." },
  { t: "Cita sus fuentes", d: "Cada respuesta muestra de qué documento salió. Confianza y trazabilidad." },
  { t: "Vos tenés el control", d: "Editás el tono, ves cada conversación y medís la calidad desde un panel." },
  { t: "Costos bajo control", d: "Topes de consumo por cliente y por día. Sin sorpresas en la factura." },
  { t: "Aislado por negocio", d: "Tus datos, separados y protegidos (multi-tenant con seguridad a nivel de fila)." },
];

const FAQS = [
  {
    q: "¿Ragent reemplaza a mi equipo de atención?",
    a: "No. Contesta lo repetitivo (horarios, precios, disponibilidad) y deriva lo complejo a una persona. Tu equipo trabaja menos saturado y se enfoca en lo que suma.",
  },
  {
    q: "¿Cómo hace para no inventar respuestas?",
    a: "Usa RAG (generación aumentada por recuperación): antes de responder busca en tus documentos y contesta solo con eso, citando la fuente. Si la información no está, lo dice en vez de inventar.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Cada negocio tiene un espacio completamente aislado (arquitectura multi-tenant con Row Level Security). Nadie accede a la información de otro. Tratamiento conforme a la Ley 25.326.",
  },
  {
    q: "¿Por qué canales atiende?",
    a: "Hoy WhatsApp. Instagram y Messenger están en camino, sobre la misma base.",
  },
  {
    q: "¿Necesito conocimientos técnicos?",
    a: "No. Subís tus documentos y ajustás el tono del bot desde un panel simple. Nosotros conectamos tu WhatsApp.",
  },
  {
    q: "¿En qué idioma responde?",
    a: "En el de tus clientes. Viene configurado en español rioplatense y lo adaptás al tono de tu marca.",
  },
];

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Ragent",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: DESCRIPTION,
        url: SITE_URL,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}

export default async function Landing() {
  const qr = await QRCode.toDataURL(WA_URL, { margin: 1, width: 220 });
  const maxW = 1040;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#16181d" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          maxWidth: maxW,
          margin: "0 auto",
        }}
      >
        <strong style={{ fontSize: 20, letterSpacing: -0.5 }}>Ragent</strong>
        <nav style={{ display: "flex", gap: 20, alignItems: "center", fontSize: 14 }}>
          <a href="#como-funciona" style={{ color: "#16181d" }}>Cómo funciona</a>
          <a href="#preguntas" style={{ color: "#16181d" }}>Preguntas</a>
          <Link href="/login" style={{ color: "#16181d" }}>Ingresar</Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section style={{ maxWidth: maxW, margin: "0 auto", padding: "40px 24px 56px" }}>
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: "1 1 380px" }}>
              <h1 style={{ fontSize: 42, lineHeight: 1.08, margin: "0 0 18px", letterSpacing: -1 }}>
                Atención al cliente por WhatsApp, con IA que responde con la información
                real de tu negocio.
              </h1>
              <p style={{ fontSize: 19, color: "#4a4f57", margin: "0 0 28px", lineHeight: 1.5 }}>
                Ragent lee tus documentos y contesta a tus clientes al instante, 24/7. Cita
                de dónde saca cada respuesta y no inventa. Tu equipo se libera de lo repetitivo.
              </p>
              <a
                href={WA_URL}
                style={{
                  display: "inline-block",
                  background: "#25D366",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 18,
                  padding: "15px 30px",
                  borderRadius: 10,
                  textDecoration: "none",
                }}
              >
                Probar el bot por WhatsApp →
              </a>
              <p style={{ fontSize: 13, color: "#8a9098", margin: "14px 0 0" }}>
                Respuestas con fuentes · Datos aislados por negocio · Listo en minutos
              </p>
            </div>

            <div style={{ flex: "0 0 auto", textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="Código QR para chatear con Ragent por WhatsApp"
                width={220}
                height={220}
                style={{ border: "1px solid #eaeaea", borderRadius: 14 }}
              />
              <p style={{ fontSize: 13, color: "#8a9098", margin: "8px 0 0" }}>
                Escaneá y probalo desde tu teléfono
              </p>
            </div>
          </div>
        </section>

        {/* Doble público: dueño + equipo */}
        <section style={{ background: "#f7f8fa" }}>
          <div
            style={{
              maxWidth: maxW,
              margin: "0 auto",
              padding: "48px 24px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 32,
            }}
          >
            <div>
              <h2 style={{ fontSize: 22, margin: "0 0 12px" }}>Para vos, que dirigís el negocio</h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#4a4f57", fontSize: 15, lineHeight: 1.7 }}>
                <li>No perdés ventas por no contestar a tiempo.</li>
                <li>Atención 24/7 sin sumar personal.</li>
                <li>Ves cada conversación y medís la calidad de las respuestas.</li>
                <li>Escalás la atención sin que escale el caos.</li>
              </ul>
            </div>
            <div>
              <h2 style={{ fontSize: 22, margin: "0 0 12px" }}>Para tu equipo</h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#4a4f57", fontSize: 15, lineHeight: 1.7 }}>
                <li>Menos preguntas repetidas de siempre.</li>
                <li>El bot resuelve lo obvio; ustedes, lo que necesita una persona.</li>
                <li>Más foco en los casos que realmente importan.</li>
                <li>No los reemplaza: les saca la parte tediosa.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" style={{ maxWidth: maxW, margin: "0 auto", padding: "56px 24px" }}>
          <h2 style={{ fontSize: 26, margin: "0 0 28px" }}>Cómo funciona</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 28,
            }}
          >
            {STEPS.map((s) => (
              <div key={s.n}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "#16181d",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  {s.n}
                </div>
                <h3 style={{ fontSize: 18, margin: "0 0 6px" }}>{s.t}</h3>
                <p style={{ fontSize: 15, color: "#4a4f57", margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Por qué no inventa (credibilidad técnica) */}
        <section style={{ background: "#16181d", color: "#fff" }}>
          <div style={{ maxWidth: maxW, margin: "0 auto", padding: "48px 24px" }}>
            <h2 style={{ fontSize: 26, margin: "0 0 12px" }}>Responde con tus fuentes, no con humo</h2>
            <p style={{ fontSize: 17, color: "#c7ccd4", margin: 0, maxWidth: 720, lineHeight: 1.6 }}>
              Ragent usa <strong>RAG</strong> (retrieval-augmented generation): antes de
              contestar, busca en tu base de conocimiento y responde <strong>solo</strong> con
              lo que encuentra ahí, mostrando la cita. Si la información no está, lo dice en
              lugar de inventar. Menos alucinaciones, más confianza — el problema número uno
              de los chatbots con IA, resuelto de raíz.
            </p>
          </div>
        </section>

        {/* Features */}
        <section style={{ maxWidth: maxW, margin: "0 auto", padding: "56px 24px" }}>
          <h2 style={{ fontSize: 26, margin: "0 0 28px" }}>Todo lo que necesitás, sin complicaciones</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 28,
            }}
          >
            {FEATURES.map((f) => (
              <div key={f.t}>
                <h3 style={{ fontSize: 17, margin: "0 0 6px" }}>{f.t}</h3>
                <p style={{ fontSize: 15, color: "#4a4f57", margin: 0 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="preguntas" style={{ background: "#f7f8fa" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px" }}>
            <h2 style={{ fontSize: 26, margin: "0 0 24px" }}>Preguntas frecuentes</h2>
            {FAQS.map((f) => (
              <div key={f.q} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 17, margin: "0 0 6px" }}>{f.q}</h3>
                <p style={{ fontSize: 15, color: "#4a4f57", margin: 0, lineHeight: 1.6 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section style={{ maxWidth: maxW, margin: "0 auto", padding: "64px 24px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, margin: "0 0 14px" }}>Probá Ragent con tu propio negocio</h2>
          <p style={{ fontSize: 17, color: "#4a4f57", margin: "0 0 28px" }}>
            Escribinos por WhatsApp y en minutos ves al bot atendiendo con tu información.
          </p>
          <a
            href={WA_URL}
            style={{
              display: "inline-block",
              background: "#25D366",
              color: "#fff",
              fontWeight: 600,
              fontSize: 18,
              padding: "15px 32px",
              borderRadius: 10,
              textDecoration: "none",
            }}
          >
            Empezá ahora →
          </a>
        </section>
      </main>

      <footer
        style={{
          borderTop: "1px solid #eee",
          padding: "28px 24px",
          textAlign: "center",
          fontSize: 13,
          color: "#8a9098",
        }}
      >
        <strong style={{ color: "#4a4f57" }}>Ragent</strong> ·{" "}
        <Link href="/privacidad" style={{ color: "#8a9098" }}>
          Política de privacidad
        </Link>{" "}
        · Tus datos se tratan según la Ley 25.326 (Argentina).
      </footer>
    </div>
  );
}
