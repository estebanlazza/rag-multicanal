// Chunking simple por caracteres con solape, respetando límites de párrafo cuando puede.
// Suficiente para ~20 docs/tenant. No sobre-ingenierizar (ver TODOS.md para escala).

const CHUNK_SIZE = 1000; // caracteres objetivo por chunk
const OVERLAP = 150; // solape entre chunks consecutivos

export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);

    // Si no llegamos al final, intentar cortar en un límite natural (párrafo, oración).
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const para = slice.lastIndexOf("\n\n");
      const sentence = slice.lastIndexOf(". ");
      const breakAt = para > CHUNK_SIZE * 0.5 ? para : sentence > CHUNK_SIZE * 0.5 ? sentence + 1 : -1;
      if (breakAt > 0) end = start + breakAt;
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= clean.length) break;
    start = Math.max(end - OVERLAP, start + 1);
  }

  return chunks;
}
