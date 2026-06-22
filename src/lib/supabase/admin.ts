// Cliente Supabase con service_role. SOLO server-side, SOLO para acciones administrativas
// del platform admin (crear tenants, invitar owners). Bypassea RLS: cada uso debe estar
// gateado por una verificación de permisos (ver getSessionContext().isPlatformAdmin).
// NUNCA importar esto desde código que corra en el browser.
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl(), serverEnv.supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
