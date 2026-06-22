// Conexión Postgres del ingress, como rol `app_ingress` (RLS-enforced, NO service_role).
// ADR-0002: cada request abre una transacción y setea app.tenant_id; RLS hace el resto.
// Un olvido de filtro no es fuga: el peor caso es "no devuelve nada".
import postgres from "postgres";
import { serverEnv } from "@/lib/env";

// Singleton por proceso (serverless reusa entre invocaciones tibias).
let _sql: ReturnType<typeof postgres> | null = null;

function sql() {
  if (!_sql) {
    _sql = postgres(serverEnv.ingressDbUrl(), {
      max: 5,
      idle_timeout: 20,
      prepare: false, // compat con poolers
    });
  }
  return _sql;
}

// Resuelve el tenant por (channel, account_key). Usa la función SECURITY DEFINER, así no
// necesita app.tenant_id seteado todavía (chicken-and-egg). null = cuenta desconocida.
export async function resolveTenant(
  channel: string,
  accountKey: string
): Promise<string | null> {
  const rows = await sql()`select resolve_tenant(${channel}, ${accountKey}) as tid`;
  return (rows[0]?.tid as string | null) ?? null;
}

// Corre `fn` dentro de una transacción con app.tenant_id seteado (RLS activo).
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  return sql().begin(async (tx) => {
    await tx`select set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  }) as Promise<T>;
}
