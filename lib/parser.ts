import { getClaude, HAIKU_MODEL } from "./claude";

export type LogIntent = {
  intent: "log";
  amount: number;
  description: string;
  category: string;
  date: string; // YYYY-MM-DD
};

export type QueryIntent = {
  intent: "query";
  filters: {
    category?: string;
    start_date?: string;
    end_date?: string;
  };
};

export type ErrorIntent = {
  intent: "error";
  message: string;
};

export type ParseResult = LogIntent | QueryIntent | ErrorIntent;

export type ParseContext = {
  today: string; // YYYY-MM-DD (server's "today")
  currency: string; // e.g. "INR"
  existingCategories: string[];
};

const SYSTEM_PROMPT = (ctx: ParseContext) => `You classify and parse
natural-language input for a personal expense tracker.

TODAY: ${ctx.today}
CURRENCY: ${ctx.currency} (all amounts are in this currency unless the user says otherwise — if they do, still store the number as-is)
EXISTING CATEGORIES (reuse these whenever the expense fits; invent a new one only if nothing fits, and keep the total number of distinct categories small — soft cap 12):
${ctx.existingCategories.length ? ctx.existingCategories.map((c) => `- ${c}`).join("\n") : "(none yet)"}

The user's message is either:
1. A **log** instruction — they are telling you about an expense to record.
   Examples: "spent 340 on auto rickshaw yesterday", "lunch 250", "groceries 1200 at dmart", "coffee 80 on tuesday".
2. A **query** — they are asking for a summary.
   Examples: "how much did I spend on food this week?", "show me last month", "what have I spent on travel?", "total for today".
3. Ambiguous / missing info — respond with an error asking for clarification.

Respond ONLY with a single JSON object — no prose, no markdown fences.

For a log, output:
{
  "intent": "log",
  "amount": <number, no currency symbol>,
  "description": "<short phrase describing the expense, lowercase, no amount>",
  "category": "<category name — REUSE from the list above whenever plausible>",
  "date": "YYYY-MM-DD"
}

For a query, output:
{
  "intent": "query",
  "filters": {
    "category": "<optional; only if the user mentioned a category — use exact casing from the list above if there's a match>",
    "start_date": "YYYY-MM-DD (optional)",
    "end_date": "YYYY-MM-DD (optional)"
  }
}

For ambiguous input (no amount in a log, unclear question), output:
{
  "intent": "error",
  "message": "<one short sentence asking for the missing piece>"
}

Date resolution rules (relative to TODAY):
- "today" → TODAY
- "yesterday" → TODAY minus 1 day
- "last <weekday>" → the most recent past occurrence of that weekday
- "this week" → start_date = most recent Monday (or today if it's Monday), end_date = TODAY
- "last week" → start_date = Monday of previous week, end_date = Sunday of previous week
- "this month" → start_date = 1st of current month, end_date = TODAY
- "last month" → full previous calendar month
- No date mentioned on a log → use TODAY
- No date mentioned on a query → omit both start_date and end_date (means "all time")
`;

export function extractJson(text: string): unknown {
  // Claude usually returns pure JSON with our prompt, but strip fences just in case.
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  const firstBrace = t.indexOf("{");
  const lastBrace = t.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON object found in model response.");
  }
  return JSON.parse(t.slice(firstBrace, lastBrace + 1));
}

export function normalize(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object") {
    return { intent: "error", message: "I couldn't understand that. Try again?" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as any;

  if (r.intent === "log") {
    const amount = typeof r.amount === "number" ? r.amount : parseFloat(r.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        intent: "error",
        message: "I couldn't find a valid amount. Could you rephrase?",
      };
    }
    const description = typeof r.description === "string" ? r.description.trim() : "";
    const category = typeof r.category === "string" ? r.category.trim() : "";
    const date = typeof r.date === "string" ? r.date.trim() : "";
    if (!description || !category || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        intent: "error",
        message: "I couldn't fully understand that expense. Could you rephrase?",
      };
    }
    return { intent: "log", amount, description, category, date };
  }

  if (r.intent === "query") {
    const f = r.filters ?? {};
    return {
      intent: "query",
      filters: {
        category: typeof f.category === "string" && f.category ? f.category : undefined,
        start_date:
          typeof f.start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.start_date)
            ? f.start_date
            : undefined,
        end_date:
          typeof f.end_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.end_date)
            ? f.end_date
            : undefined,
      },
    };
  }

  if (r.intent === "error") {
    return {
      intent: "error",
      message: typeof r.message === "string" ? r.message : "Could you rephrase?",
    };
  }

  return { intent: "error", message: "I couldn't understand that. Try again?" };
}

/**
 * Classify + parse a user's natural-language input.
 * Exported for mocking in tests; the default export calls Claude directly.
 */
export async function parseInput(
  input: string,
  ctx: ParseContext,
): Promise<ParseResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { intent: "error", message: "Please enter something." };
  }

  const claude = getClaude();
  const response = await claude.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT(ctx),
    messages: [{ role: "user", content: trimmed }],
  });

  const text = response.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    return normalize(extractJson(text));
  } catch {
    return {
      intent: "error",
      message: "I had trouble parsing that. Could you rephrase?",
    };
  }
}
