import Link from "next/link";

export const metadata = {
  title: "Política de privacidad — RAG Chatbot",
};

export default function Privacidad() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        color: "#1a1a1a",
        maxWidth: 720,
        margin: "0 auto",
        padding: "32px 24px",
        lineHeight: 1.6,
      }}
    >
      <p>
        <Link href="/" style={{ color: "#1a1a1a", fontSize: 14 }}>
          ← Volver
        </Link>
      </p>
      <h1>Política de privacidad</h1>
      <p style={{ color: "#555" }}>
        Tratamos tus datos personales conforme a la Ley 25.326 de Protección de Datos
        Personales de la República Argentina.
      </p>

      <h2 style={{ fontSize: 18 }}>Qué datos recopilamos</h2>
      <p>
        Cuando conversás con el bot por WhatsApp (u otro canal), guardamos el contenido de
        los mensajes y el identificador del canal (por ejemplo, tu número) para poder
        responderte y mantener el historial de la conversación.
      </p>

      <h2 style={{ fontSize: 18 }}>Para qué los usamos</h2>
      <p>
        Únicamente para responder tus consultas y mejorar la atención del negocio con el
        que estás hablando. No vendemos ni cedemos tus datos a terceros ajenos a ese fin.
      </p>

      <h2 style={{ fontSize: 18 }}>Tus derechos</h2>
      <p>
        Podés solicitar el acceso, la rectificación o la supresión de tus datos en
        cualquier momento, escribiéndole al negocio que opera el bot. El titular de los
        datos tiene la facultad de ejercer el derecho de acceso en forma gratuita a
        intervalos no inferiores a seis meses, salvo interés legítimo (art. 14, inc. 3,
        Ley 25.326).
      </p>

      <p style={{ color: "#888", fontSize: 13, marginTop: 32 }}>
        La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, órgano de control de la Ley 25.326,
        tiene la atribución de atender denuncias y reclamos por incumplimiento de las
        normas sobre protección de datos personales.
      </p>
    </main>
  );
}
