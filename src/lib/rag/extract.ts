// Extracción de texto. Extractor Node por defecto (PDF/txt/md). MarkItDown (Python) es
// opt-in y necesita un worker aparte (ver docs/06-deployment.md); acá sólo el camino Node.
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

export type Extracted = { text: string; pageCount: number };

export async function extract(
  bytes: Uint8Array,
  filename: string,
  mime: string
): Promise<Extracted> {
  const lower = filename.toLowerCase();
  const isPdf = mime === "application/pdf" || lower.endsWith(".pdf");

  if (isPdf) {
    const pdf = await getDocumentProxy(bytes);
    const { text, totalPages } = await extractPdfText(pdf, { mergePages: true });
    return { text: (text ?? "").trim(), pageCount: totalPages ?? 1 };
  }

  // texto / markdown
  const text = new TextDecoder("utf-8").decode(bytes).trim();
  // Páginas estimadas para el cap (no hay paginación real en texto plano).
  const pageCount = Math.max(1, Math.ceil(text.length / 3000));
  return { text, pageCount };
}
