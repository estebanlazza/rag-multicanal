// Generación de la respuesta con el LLM. OpenAI gpt-4o-mini en prod.
// Si no hay OPENAI_API_KEY: respuesta MOCK (solo dev/test) que cita el contexto, para
// poder probar el endpoint completo sin gastar API.
import OpenAI from "openai";
import { serverEnv } from "@/lib/env";

export type AnswerResult = { answer: string; model: string; tokens: number };

// Cap de tokens por respuesta (parte de los controles de costo de Fase 6).
const MAX_RESPONSE_TOKENS = 500;

export async function generateAnswer(
  systemPrompt: string,
  context: string,
  question: string
): Promise<AnswerResult> {
  const userContent = `Información disponible:\n${context}\n\nMensaje del cliente: ${question}`;

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const snippet = context.slice(0, 200).replace(/\s+/g, " ").trim();
    const answer =
      `[respuesta mock — sin OPENAI_API_KEY] Recibí: "${question}". ` +
      (snippet ? `Según la info disponible: ${snippet}…` : "No tengo info cargada todavía.");
    // Estimación grosera de tokens (~4 chars/token) para que los caps funcionen en dev.
    const tokens = Math.ceil((systemPrompt.length + userContent.length + answer.length) / 4);
    return { answer, model: "mock", tokens };
  }

  const client = new OpenAI({ apiKey: key });
  const res = await client.chat.completions.create({
    model: serverEnv.openaiChatModel(),
    temperature: 0.3,
    max_tokens: MAX_RESPONSE_TOKENS,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });
  return {
    answer: res.choices[0]?.message?.content?.trim() ?? "",
    model: serverEnv.openaiChatModel(),
    tokens: res.usage?.total_tokens ?? 0,
  };
}
