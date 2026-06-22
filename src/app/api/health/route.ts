// Healthcheck. Confirma que la app levanta y, si hay credenciales, que la DB responde.
// No expone detalle sensible; solo up/down.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  let db: "up" | "down" | "unconfigured" = "unconfigured";

  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const supabase = await createClient();
      // head + count: no trae filas, solo prueba conectividad. RLS aplica (devuelve 0
      // sin sesión, pero la query responde → la DB está up).
      const { error } = await supabase
        .from("tenants")
        .select("id", { count: "exact", head: true });
      db = error ? "down" : "up";
    }
  } catch {
    db = "down";
  }

  const ok = db !== "down";
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", db },
    { status: ok ? 200 : 503 }
  );
}
