"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/rag/prompt";

function back(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect("/panel/admin/tenants?" + qs);
}

// Provisioning manual: crea el tenant, crea/invita al owner y devuelve un LINK de
// invitación (sin depender de email — se lo mandás vos al cliente). El owner abre el
// link, setea su contraseña y cae en su panel ya funcionando.
export async function createTenantAndInvite(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx?.isPlatformAdmin) {
    back({ error: "Solo el platform admin puede crear tenants" });
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!name || !slug || !email) {
    back({ error: "Completá nombre, slug y email del owner" });
  }

  const admin = createAdminClient();

  // 1. Crear el tenant.
  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .insert({ name, slug })
    .select("id")
    .single();
  if (tErr || !tenant) {
    back({ error: "No se pudo crear el tenant: " + (tErr?.message ?? "desconocido") });
  }

  // Sembrar el prompt de ejemplo: el tenant arranca con algo razonable y editable.
  await admin
    .from("prompts")
    .upsert({ tenant_id: tenant!.id, content: DEFAULT_SYSTEM_PROMPT }, { onConflict: "tenant_id" });

  // 2. Invitar al owner (crea el usuario y devuelve hashed_token).
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const redirectTo = `${origin}/panel/set-password`;

  let hashedToken: string | undefined;
  let userId: string | undefined;
  let otpType = "invite";

  const invite = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });

  if (invite.error) {
    // Probablemente el usuario ya existe → usar recovery para re-invitarlo.
    const recovery = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (recovery.error || !recovery.data.user) {
      back({ error: "No se pudo invitar al owner: " + recovery.error?.message });
    }
    hashedToken = recovery.data.properties?.hashed_token;
    userId = recovery.data.user!.id;
    otpType = "recovery";
  } else {
    hashedToken = invite.data.properties?.hashed_token;
    userId = invite.data.user?.id;
  }

  if (!hashedToken || !userId) {
    back({ error: "No se pudo generar el link de invitación" });
  }

  // 3. Asociar al owner con el tenant.
  const { error: mErr } = await admin
    .from("memberships")
    .upsert(
      { user_id: userId, tenant_id: tenant!.id, role: "owner" },
      { onConflict: "user_id,tenant_id" }
    );
  if (mErr) {
    back({ error: "Tenant creado pero falló la membership: " + mErr.message });
  }

  // 4. Devolver el link para que el admin se lo pase al cliente.
  const inviteUrl = `${origin}/auth/confirm?token_hash=${hashedToken}&type=${otpType}&next=/panel/set-password`;
  back({ invite: inviteUrl });
}
