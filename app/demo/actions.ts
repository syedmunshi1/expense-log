"use server";

import {
  deleteExpense as deleteExpenseDb,
  fetchExpenses,
  getCurrency,
  getDistinctCategories,
  getRecent,
  insertExpense,
  type Expense,
} from "@/lib/db";
import { parseInput } from "@/lib/parser";
import { summarize } from "@/lib/summarizer";
import type { ProcessResult } from "@/app/actions";

const DEMO_USER = "demo";

// todayISO is intentionally duplicated here — keeping demo actions self-contained
// prevents any accidental import chain that pulls in auth() from app/actions.ts.
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function processInput(input: string): Promise<ProcessResult> {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { kind: "error", message: "Please enter something." };

  const [currency, categories] = await Promise.all([
    getCurrency(DEMO_USER),
    getDistinctCategories(DEMO_USER),
  ]);

  let parsed;
  try {
    parsed = await parseInput(trimmed, { today: todayISO(), currency, existingCategories: categories });
  } catch {
    return { kind: "error", message: "The parser is unavailable right now." };
  }

  if (parsed.intent === "error") return { kind: "error", message: parsed.message };

  if (parsed.intent === "log") {
    try {
      const expense = await insertExpense({
        amount: parsed.amount,
        description: parsed.description,
        category: parsed.category,
        date: parsed.date,
        userId: DEMO_USER,
      });
      return { kind: "logged", expense, currency };
    } catch {
      return { kind: "error", message: "Couldn't save that expense." };
    }
  }

  try {
    const rows = await fetchExpenses(DEMO_USER, parsed.filters);
    const summary = await summarize({ question: trimmed, expenses: rows, currency, today: todayISO() });
    return { kind: "summary", message: summary, count: rows.length, currency, expenses: rows };
  } catch {
    return { kind: "error", message: "Couldn't run that query." };
  }
}

export async function deleteExpense(id: number): Promise<void> {
  // Only deletes if the expense belongs to the demo user
  await deleteExpenseDb(id, DEMO_USER);
}

export async function getRecentForDisplay(): Promise<{ expenses: Expense[]; currency: string }> {
  const [expenses, currency] = await Promise.all([
    getRecent(DEMO_USER, 10),
    getCurrency(DEMO_USER),
  ]);
  return { expenses, currency };
}
