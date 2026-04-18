import { getClaude, HAIKU_MODEL } from "./claude";
import type { Expense } from "./db";

export type SummarizeContext = {
  question: string;
  expenses: Expense[];
  currency: string;
  today: string;
};

/**
 * Produce a short prose answer for a query intent, given the filtered rows.
 * The model is told the total and count up front to anchor accuracy.
 */
export async function summarize(ctx: SummarizeContext): Promise<string> {
  const { question, expenses, currency, today } = ctx;

  if (expenses.length === 0) {
    return "No matching expenses found.";
  }

  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(
      e.category,
      (byCategory.get(e.category) ?? 0) + parseFloat(e.amount),
    );
  }
  const categoryBreakdown = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  - ${cat}: ${amt.toFixed(2)}`)
    .join("\n");

  const sample = expenses
    .slice(0, 20)
    .map(
      (e) =>
        `  ${e.date}  ${e.category.padEnd(18)} ${parseFloat(e.amount).toFixed(2)}  ${e.description}`,
    )
    .join("\n");

  const system = `You write short, friendly summaries of a user's personal expenses.
- Currency: ${currency}. Write amounts with the appropriate symbol (₹ for INR, $ for USD, € for EUR, £ for GBP).
- Today: ${today}.
- Be concise: 1-3 sentences. Do not list every expense. Call out the total and anything notable (biggest expense, dominant category, unusual day).
- Do not invent facts. Use ONLY the numbers provided.`;

  const user = `Question: ${question}

Matching expenses (${expenses.length} total):
Total: ${total.toFixed(2)}
By category:
${categoryBreakdown}

Recent sample:
${sample}

Write the summary now.`;

  const claude = getClaude();
  const response = await claude.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 300,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = response.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return text || "Summary unavailable.";
}
