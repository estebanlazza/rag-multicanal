// Cliente Supabase para el server (Server Components, Route Handlers del panel).
// Lee/escribe la sesión del usuario en cookies. Corre como `authenticated`: RLS scopea.
// NO es el camino del ingress (ver src/lib/supabase/ingress.ts y ADR-0002).
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl(), publicEnv.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll desde un Server Component: lo maneja el middleware. Ignorable.
        }
      },
    },
  });
}
