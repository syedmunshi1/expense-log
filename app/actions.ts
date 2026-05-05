"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signOut, auth } from "@/auth";
import {
  deleteExpense as deleteExpenseDb,
  fetchExpenses,
  getCurrency,
  getDistinctCategories,
  getRecent,
  insertExpense,
  setSetting,
  type Expense,
} from "@/lib/db";
import { parseInput, type ParseResult } from "@/lib/parser";
import { summarize } from "@/lib/summarizer";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function requireUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return session.user.email;
}

export type ProcessResult =
  | { kind: "logged"; expense: Expense; currency: string }
  | { kind: "summary"; message: string; count: number; currency: string; expenses: Expense[] }
  | { kind: "error"; message: string };

export async function processInput(input: string): Promise<ProcessResult> {
  const userId = await requireUser();
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { kind: "error", message: "Please enter something." };

  const [currency, categories] = await Promise.all([
    getCurrency(userId),
    getDistinctCategories(userId),
  ]);

  let parsed: ParseResult;
  try {
    parsed = await parseInput(trimmed, { today: todayISO(), currency, existingCategories: categories });
  } catch (err) {
    console.error("parseInput failed:", err);
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
        userId,
      });
      revalidatePath("/");
      return { kind: "logged", expense, currency };
    } catch (err) {
      console.error("insertExpense failed:", err);
      return { kind: "error", message: "Couldn't save that expense." };
    }
  }

  try {
    const rows = await fetchExpenses(userId, parsed.filters);
    const summary = await summarize({ question: trimmed, expenses: rows, currency, today: todayISO() });
    return { kind: "summary", message: summary, count: rows.length, currency, expenses: rows };
  } catch (err) {
    console.error("query path failed:", err);
    return { kind: "error", message: "Couldn't run that query." };
  }
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function updateCurrency(formData: FormData): Promise<void> {
  const userId = await requireUser();
  const code = String(formData.get("currency") ?? "").toUpperCase().trim();
  if (!/^[A-Z]{3}$/.test(code)) redirect("/settings?error=invalid-currency");
  await setSetting("currency", code, userId);
  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function deleteExpense(id: number): Promise<void> {
  const userId = await requireUser();
  await deleteExpenseDb(id, userId);
  revalidatePath("/");
  revalidatePath("/fluid");
  revalidatePath("/fluid/history");
  revalidatePath("/fluid/analytics");
}

export async function getRecentForDisplay(): Promise<{ expenses: Expense[]; currency: string }> {
  const userId = await requireUser();
  const [expenses, currency] = await Promise.all([getRecent(userId, 10), getCurrency(userId)]);
  return { expenses, currency };
}
