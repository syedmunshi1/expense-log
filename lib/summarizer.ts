import { getClaude, HAIKU_MODEL } from "./claude";
import type { Expense } from "./db";

export type SummarizeContext = {
  question: string;
  expenses: Expense[];
  currency: string;
  today: string;
};

/**
 * Produce a conversational answer for a query, given the filtered rows.
 * The model is told the total and count up front to anchor accuracy.
 */
export async function summarize(ctx: SummarizeContext): Promise<string> {
  const { question, expenses, currency, today } = ctx;
  const symbolHint = symbolHintFor(currency);

  if (expenses.length === 0) {
    // Ask Claude to give a friendly "nothing found" reply tailored to the question.
    return await emptyReply(question, currency, today);
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

  const system = `You are a friendly personal-finance assistant answering questions about the user's own spending.
- Currency: ${currency}. Write amounts with the appropriate symbol (${symbolHint}).
- Today: ${today}.
- Be conversational and warm, like a helpful friend — NOT like a report.
- Keep it short: 1–2 sentences is ideal. Do not list every expense.
- Lead with the direct answer (the total), then add ONE interesting observation if relevant (biggest single expense, or the dominant day/category).
- Do NOT start with "Based on..." or "According to...". Just answer naturally.
- Do NOT invent facts. Use ONLY the numbers provided.
- Do NOT mention "matching expenses" or "rows" — the user doesn't think in those terms.`;

  const user = `User asked: "${question}"

Data for the answer (${expenses.length} expenses):
Total: ${total.toFixed(2)}
By category:
${categoryBreakdown}

Sample:
${sample}

Answer the user now, conversationally.`;

  const claude = getClaude();
  const response = await claude.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 250,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = response.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return text || `You spent ${symbolHint}${total.toFixed(2)} across ${expenses.length} expenses.`;
}

async function emptyReply(
  question: string,
  currency: string,
  today: string,
): Promise<string> {
  const system = `You are a friendly personal-finance assistant.
The user asked about their spending, but there were NO matching expenses.
- Currency: ${currency}. Today: ${today}.
- Respond in 1 short conversational sentence.
- Be warm and helpful, not apologetic or robotic.
- If the question mentioned a specific thing (like "auto" or "coffee"), acknowledge it.
- Examples of good tone: "Looks like you haven't logged any auto rides this week yet." or "Nothing on groceries today — maybe tomorrow!"
- Never use phrases like "no matching expenses" or "no records found".`;

  try {
    const claude = getClaude();
    const response = await claude.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 100,
      system,
      messages: [{ role: "user", content: `User asked: "${question}"` }],
    });
    const text = response.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || "I don't see anything for that yet.";
  } catch {
    return "I don't see anything for that yet.";
  }
}

function symbolHintFor(code: string): string {
  const map: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
  };
  return map[code.toUpperCase()] ?? code;
}
