// Lectura centralizada y validada de variables de entorno.
// Falla temprano y con nombre claro si falta algo, en vez de undefined silencioso.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

// Públicas (browser): solo URL + anon key.
export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
};

// Privadas (server): nunca llegan al browser.
export const serverEnv = {
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  ingressDbUrl: () => required("SUPABASE_DB_URL"),
  ingressHmacSecret: () => required("INGRESS_HMAC_SECRET"),
  openaiApiKey: () => required("OPENAI_API_KEY"),
  openaiChatModel: () => optional("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
  openaiEmbeddingModel: () => optional("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
  markitdownEnabled: () => optional("MARKITDOWN_ENABLED", "false") === "true",
};
