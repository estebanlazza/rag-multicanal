// Embeddings. OpenAI text-embedding-3-small (1536 dims) en prod.
// Si no hay OPENAI_API_KEY: embeddings MOCK deterministas, SOLO para dev/test (no gastan
// API y permiten probar el pipeline completo). El provider usado se guarda en metadata.
import OpenAI from "openai";
import { serverEnv } from "@/lib/env";

export const EMBEDDING_DIMS = 1536;

export type EmbedResult = {
  vectors: number[][];
  provider: "openai" | "mock";
};

export async function embed(texts: string[]): Promise<EmbedResult> {
  if (texts.length === 0) return { vectors: [], provider: "mock" };

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn("[embeddings] sin OPENAI_API_KEY → usando embeddings MOCK (solo dev)");
    return { vectors: texts.map(mockEmbedding), provider: "mock" };
  }

  const client = new OpenAI({ apiKey: key });
  const res = await client.embeddings.create({
    model: serverEnv.openaiEmbeddingModel(),
    input: texts,
  });
  return { vectors: res.data.map((d) => d.embedding), provider: "openai" };
}

// Vector pseudo-aleatorio pero determinista por texto (hash → PRNG). Normalizado.
function mockEmbedding(text: string): number[] {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const rand = mulberry32(seed >>> 0);
  const v = Array.from({ length: EMBEDDING_DIMS }, () => rand() * 2 - 1);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// pgvector espera el literal '[1,2,3]'.
export function toVectorLiteral(vec: number[]): string {
  return "[" + vec.join(",") + "]";
}
