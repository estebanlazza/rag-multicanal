// Cliente Supabase para el browser (componentes client del panel).
// Usa la anon key; la sesión del usuario la maneja @supabase/ssr vía cookies.
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl(), publicEnv.supabaseAnonKey());
}
