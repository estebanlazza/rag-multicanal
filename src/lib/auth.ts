// Contexto de sesión para el panel: usuario, si es platform admin, y sus memberships.
import { createClient } from "@/lib/supabase/server";

export type Membership = {
  tenant_id: string;
  role: string;
  tenant_name: string | null;
  tenant_slug: string | null;
};

export type SessionContext = {
  user: { id: string; email: string | null };
  isPlatformAdmin: boolean;
  memberships: Membership[];
};

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const isPlatformAdmin = Boolean(
    (user.app_metadata as Record<string, unknown> | undefined)?.is_platform_admin
  );

  // RLS scopea: un owner ve solo su membership. (Para el admin no usamos esto en la UI;
  // la lista de tenants se consulta aparte.)
  const { data } = await supabase
    .from("memberships")
    .select("tenant_id, role, tenants(name, slug)");

  const memberships: Membership[] = (data ?? []).map((m) => {
    // El join puede venir como objeto (many-to-one) o array según la inferencia.
    const raw = m.tenants as unknown;
    const tenant = (Array.isArray(raw) ? raw[0] : raw) as
      | { name: string; slug: string }
      | undefined;
    return {
      tenant_id: m.tenant_id as string,
      role: m.role as string,
      tenant_name: tenant?.name ?? null,
      tenant_slug: tenant?.slug ?? null,
    };
  });

  return {
    user: { id: user.id, email: user.email ?? null },
    isPlatformAdmin,
    memberships,
  };
}
