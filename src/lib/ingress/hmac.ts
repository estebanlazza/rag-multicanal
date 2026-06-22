// HMAC compartido n8n ↔ /api/query. El ingress no es superficie pública.
// n8n firma: x-signature = hex(hmac-sha256(secret, `${timestamp}.${rawBody}`))
// y manda x-timestamp (epoch en segundos). Ventana de 5 min contra replays.
import { createHmac, timingSafeEqual } from "crypto";

const MAX_SKEW_SECONDS = 300;

export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !timestampHeader) return false;

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest("hex");
  const got = signatureHeader.replace(/^sha256=/, "");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(got, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Útil para n8n / tests: arma la firma de un body.
export function signBody(rawBody: string, timestamp: number, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}
