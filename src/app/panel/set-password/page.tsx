import { setPassword } from "./actions";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <section style={{ maxWidth: 360 }}>
      <h1>Definí tu contraseña</h1>
      <p style={{ color: "#555", fontSize: 14 }}>
        Bienvenido. Elegí una contraseña para entrar a tu panel.
      </p>
      {error && <p style={{ color: "#b00020", fontSize: 14 }}>{error}</p>}
      <form action={setPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Contraseña nueva
          <input type="password" name="password" required minLength={8} autoComplete="new-password" />
        </label>
        <button type="submit">Guardar y entrar</button>
      </form>
    </section>
  );
}
