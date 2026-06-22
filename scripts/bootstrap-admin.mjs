// Bootstrap del platform admin (vos). Crea o actualiza un usuario con el flag
// app_metadata.is_platform_admin = true.
//
// Uso (Node 22+ lee .env.local con --env-file):
//   node --env-file=.env.local scripts/bootstrap-admin.mjs [email] [password]
//   (defaults: admin@local.dev / admin12345)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2] ?? "admin@local.dev";
const password = process.argv[3] ?? "admin12345";

if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ver .env.local)");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Buscar si ya existe (paginado simple).
const { data: list, error: listErr } = await admin.auth.admin.listUsers();
if (listErr) {
  console.error("Error listando usuarios:", listErr.message);
  process.exit(1);
}
const existing = list.users.find((u) => u.email === email);

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    app_metadata: { is_platform_admin: true },
  });
  if (error) {
    console.error("Error actualizando:", error.message);
    process.exit(1);
  }
  console.log(`Platform admin actualizado: ${email}`);
} else {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { is_platform_admin: true },
  });
  if (error) {
    console.error("Error creando:", error.message);
    process.exit(1);
  }
  console.log(`Platform admin creado: ${email}`);
}

console.log(`Login: ${email} / ${password}`);
