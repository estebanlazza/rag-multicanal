import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 360, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Ingresar</h1>
      {error && (
        <p style={{ color: "#b00020", fontSize: 14 }}>{error}</p>
      )}
      <form action={login} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Email
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Contraseña
          <input type="password" name="password" required autoComplete="current-password" />
        </label>
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}
