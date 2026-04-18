import { describe, it, expect } from "vitest";
import { formatAmount, symbolFor } from "../lib/currency";

describe("symbolFor", () => {
  it("returns known symbols", () => {
    expect(symbolFor("INR")).toBe("₹");
    expect(symbolFor("USD")).toBe("$");
    expect(symbolFor("inr")).toBe("₹");
  });

  it("falls back to code for unknown currencies", () => {
    expect(symbolFor("XYZ")).toBe("XYZ ");
  });
});

describe("formatAmount", () => {
  it("formats INR with indian grouping", () => {
    expect(formatAmount(123456, "INR")).toBe("₹1,23,456");
  });

  it("formats USD with western grouping", () => {
    expect(formatAmount(1234.5, "USD")).toBe("$1,234.50");
  });

  it("accepts string numeric input (as it comes from Postgres NUMERIC)", () => {
    expect(formatAmount("250", "INR")).toBe("₹250");
  });
});
