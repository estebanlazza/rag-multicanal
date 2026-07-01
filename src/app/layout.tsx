import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ragent.beele.tech";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Ragent — Atención al cliente por WhatsApp con IA",
    template: "%s — Ragent",
  },
  description:
    "Ragent responde a tus clientes por WhatsApp con la información real de tu negocio. RAG conversacional: cita sus fuentes, no inventa, atiende 24/7.",
  applicationName: "Ragent",
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
