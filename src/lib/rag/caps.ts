// Caps de ingesta. Los límites por-tenant (max_documents, max_pages) viven en la tabla
// tenants; acá van los topes globales y los helpers de chequeo.
// REGLA: validar ANTES de embeber. Un cap tarde no evita la factura de embeddings.

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB por archivo

export const SUPPORTED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

export const SUPPORTED_EXT = new Set([".pdf", ".txt", ".md", ".markdown"]);

export function isSupported(filename: string, mime: string): boolean {
  if (SUPPORTED_MIME.has(mime)) return true;
  const lower = filename.toLowerCase();
  for (const ext of SUPPORTED_EXT) if (lower.endsWith(ext)) return true;
  return false;
}

export type CapError = { code: string; message: string };

export function checkFileSize(bytes: number): CapError | null {
  if (bytes > MAX_FILE_BYTES) {
    return {
      code: "file_too_big",
      message: `El archivo supera el límite de ${MAX_FILE_BYTES / 1024 / 1024} MB`,
    };
  }
  return null;
}

export function checkDocCount(current: number, max: number): CapError | null {
  if (current >= max) {
    return {
      code: "doc_cap",
      message: `Llegaste al límite de ${max} documentos para este tenant`,
    };
  }
  return null;
}

// Páginas acumuladas del tenant + las del doc nuevo no pueden superar max_pages.
export function checkPageCap(
  existingPages: number,
  newPages: number,
  max: number
): CapError | null {
  if (existingPages + newPages > max) {
    return {
      code: "page_cap",
      message: `Supera el límite de ${max} páginas del tenant (tenés ${existingPages}, este doc suma ${newPages})`,
    };
  }
  return null;
}
