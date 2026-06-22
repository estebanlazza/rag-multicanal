// Generación de la respuesta con el LLM. OpenAI gpt-4o-mini en prod.
// Si no hay OPENAI_API_KEY: respuesta MOCK (solo dev/test) que cita el contexto, para
// poder probar el endpoint completo sin gastar API.
import OpenAI from "openai";
import { serverEnv } from "@/lib/env";

export type AnswerResult = { answer: string; model: string };

export async function generateAnswer(
  systemPrompt: string,
  context: string,
  question: string
): Promise<AnswerResult> {
  const userContent = `Información disponible:\n${context}\n\nMensaje del cliente: ${question}`;

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const snippet = context.slice(0, 200).replace(/\s+/g, " ").trim();
    return {
      answer:
        `[respuesta mock — sin OPENAI_API_KEY] Recibí: "${question}". ` +
        (snippet ? `Según la info disponible: ${snippet}…` : "No tengo info cargada todavía."),
      model: "mock",
    };
  }

  const client = new OpenAI({ apiKey: key });
  const res = await client.chat.completions.create({
    model: serverEnv.openaiChatModel(),
    temperature: 0.3,
    max_tokens: 500,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });
  return {
    answer: res.choices[0]?.message?.content?.trim() ?? "",
    model: serverEnv.openaiChatModel(),
  };
}
