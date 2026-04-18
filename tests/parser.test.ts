import { describe, it, expect } from "vitest";
import { extractJson, normalize } from "../lib/parser";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson("```\n{\"b\":2}\n```")).toEqual({ b: 2 });
  });

  it("extracts an object surrounded by prose", () => {
    expect(extractJson('Here you go: {"c":3}. Thanks!')).toEqual({ c: 3 });
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractJson("no json at all")).toThrow();
  });
});

describe("normalize", () => {
  it("accepts a well-formed log intent", () => {
    const r = normalize({
      intent: "log",
      amount: 340,
      description: "auto rickshaw",
      category: "Transport",
      date: "2026-04-15",
    });
    expect(r).toEqual({
      intent: "log",
      amount: 340,
      description: "auto rickshaw",
      category: "Transport",
      date: "2026-04-15",
    });
  });

  it("coerces string amounts to numbers for log intent", () => {
    const r = normalize({
      intent: "log",
      amount: "250.5",
      description: "lunch",
      category: "Food",
      date: "2026-04-16",
    });
    expect(r.intent).toBe("log");
    if (r.intent === "log") {
      expect(r.amount).toBe(250.5);
    }
  });

  it("returns error when log amount is missing or invalid", () => {
    const r = normalize({
      intent: "log",
      amount: "abc",
      description: "lunch",
      category: "Food",
      date: "2026-04-16",
    });
    expect(r.intent).toBe("error");
  });

  it("returns error when log date is malformed", () => {
    const r = normalize({
      intent: "log",
      amount: 100,
      description: "x",
      category: "Food",
      date: "Apr 16 2026",
    });
    expect(r.intent).toBe("error");
  });

  it("accepts a query intent with full filters", () => {
    const r = normalize({
      intent: "query",
      filters: {
        category: "Food",
        start_date: "2026-04-01",
        end_date: "2026-04-30",
      },
    });
    expect(r).toEqual({
      intent: "query",
      filters: {
        category: "Food",
        start_date: "2026-04-01",
        end_date: "2026-04-30",
      },
    });
  });

  it("accepts a query with no filters (all time)", () => {
    const r = normalize({ intent: "query", filters: {} });
    expect(r).toEqual({ intent: "query", filters: {} });
  });

  it("drops malformed dates on queries", () => {
    const r = normalize({
      intent: "query",
      filters: { start_date: "yesterday" },
    });
    expect(r.intent).toBe("query");
    if (r.intent === "query") {
      expect(r.filters.start_date).toBeUndefined();
    }
  });

  it("propagates explicit error intent", () => {
    const r = normalize({ intent: "error", message: "no amount" });
    expect(r).toEqual({ intent: "error", message: "no amount" });
  });

  it("falls back to a generic error for unknown shapes", () => {
    expect(normalize(null).intent).toBe("error");
    expect(normalize({}).intent).toBe("error");
    expect(normalize({ intent: "xyz" }).intent).toBe("error");
  });
});
