import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RAG Chatbot",
  description: "Bot conversacional multi-tenant con base de conocimiento por negocio",
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
