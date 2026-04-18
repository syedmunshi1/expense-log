// Auth helpers using Web Crypto so they work in both the Edge middleware
// runtime and the Node server-action runtime.

export const SESSION_COOKIE = "expense_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is not set or is too short (min 16 chars).");
  }
  return secret;
}

const encoder = new TextEncoder();

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuf(hex: string): ArrayBuffer {
  if (hex.length % 2 !== 0) return new ArrayBuffer(0);
  const buf = new ArrayBuffer(hex.length / 2);
  const out = new Uint8Array(buf);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return buf;
}

async function sign(payload: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bufToHex(sig);
}

/**
 * Produce a session token for the cookie. Format: `<issuedAtMs>.<hmac>`.
 */
export async function issueSessionToken(): Promise<string> {
  const issuedAt = Date.now().toString();
  const sig = await sign(issuedAt);
  return `${issuedAt}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [issuedAt, sig] = parts;
  if (!/^\d+$/.test(issuedAt)) return false;

  const key = await getKey();
  const sigBuf = hexToBuf(sig);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBuf,
    encoder.encode(issuedAt),
  );
  if (!ok) return false;

  const ageMs = Date.now() - parseInt(issuedAt, 10);
  if (ageMs < 0) return false;
  if (ageMs > SESSION_MAX_AGE_SECONDS * 1000) return false;
  return true;
}

/**
 * Constant-time PIN comparison.
 */
export function verifyPin(submitted: string): boolean {
  const expected = process.env.APP_PIN;
  if (!expected) throw new Error("APP_PIN is not set.");
  if (submitted.length !== expected.length) {
    // Still do a dummy loop of constant length to reduce timing signal
    let acc = 1;
    for (let i = 0; i < expected.length; i++) acc |= i;
    return false;
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= submitted.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
