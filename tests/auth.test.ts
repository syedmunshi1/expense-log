import { describe, it, expect, beforeEach } from "vitest";
import {
  issueSessionToken,
  verifySessionToken,
  verifyPin,
  SESSION_MAX_AGE_SECONDS,
} from "../lib/auth";

beforeEach(() => {
  process.env.SESSION_SECRET = "this-is-a-test-secret-at-least-16-chars";
  process.env.APP_PIN = "1234";
});

describe("session token", () => {
  it("issues a token that verifies", async () => {
    const t = await issueSessionToken();
    expect(await verifySessionToken(t)).toBe(true);
  });

  it("rejects empty or malformed tokens", async () => {
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("")).toBe(false);
    expect(await verifySessionToken("nope")).toBe(false);
    expect(await verifySessionToken("123.abc")).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const t = await issueSessionToken();
    process.env.SESSION_SECRET = "a-different-secret-also-long-enough";
    expect(await verifySessionToken(t)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const oldIssuedAt = Date.now() - (SESSION_MAX_AGE_SECONDS + 1) * 1000;
    // Issue a token at the old time by mocking issuedAt directly.
    const t = await issueSessionToken();
    const [, sig] = t.split(".");
    // Build a token that LOOKS valid for an expired issuedAt, but the signature
    // won't match — so verifier rejects on HMAC anyway. To actually test expiry,
    // we need to sign an old timestamp. Use the internal signing via issue.
    // Instead: set Date.now to the past, issue, restore.
    const realNow = Date.now;
    try {
      Date.now = () => oldIssuedAt;
      const expired = await issueSessionToken();
      Date.now = realNow;
      expect(await verifySessionToken(expired)).toBe(false);
    } finally {
      Date.now = realNow;
    }
    // Ensure the unused sig var isn't flagged
    void sig;
  });
});

describe("verifyPin", () => {
  it("accepts the correct PIN", () => {
    expect(verifyPin("1234")).toBe(true);
  });

  it("rejects a wrong PIN", () => {
    expect(verifyPin("0000")).toBe(false);
  });

  it("rejects a PIN of the wrong length", () => {
    expect(verifyPin("12345")).toBe(false);
    expect(verifyPin("123")).toBe(false);
  });

  it("throws if APP_PIN is unset", () => {
    delete process.env.APP_PIN;
    expect(() => verifyPin("1234")).toThrow();
  });
});
