"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  issueSessionToken,
  verifyPin,
} from "@/lib/auth";
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
  // Use server's local date. Format YYYY-MM-DD.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type ProcessResult =
  | { kind: "logged"; expense: Expense; currency: string }
  | { kind: "summary"; message: string; count: number; currency: string; expenses: Expense[] }
  | { kind: "error"; message: string };

/**
 * Main entry point for user input. Classifies, then either logs or summarizes.
 */
export async function processInput(input: string): Promise<ProcessResult> {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return { kind: "error", message: "Please enter something." };
  }

  const [currency, categories] = await Promise.all([
    getCurrency(),
    getDistinctCategories(),
  ]);

  let parsed: ParseResult;
  try {
    parsed = await parseInput(trimmed, {
      today: todayISO(),
      currency,
      existingCategories: categories,
    });
  } catch (err) {
    console.error("parseInput failed:", err);
    return { kind: "error", message: "The parser is unavailable right now." };
  }

  if (parsed.intent === "error") {
    return { kind: "error", message: parsed.message };
  }

  if (parsed.intent === "log") {
    try {
      const expense = await insertExpense({
        amount: parsed.amount,
        description: parsed.description,
        category: parsed.category,
        date: parsed.date,
      });
      revalidatePath("/");
      return { kind: "logged", expense, currency };
    } catch (err) {
      console.error("insertExpense failed:", err);
      return { kind: "error", message: "Couldn't save that expense." };
    }
  }

  // query intent
  try {
    const rows = await fetchExpenses(parsed.filters);
    const summary = await summarize({
      question: trimmed,
      expenses: rows,
      currency,
      today: todayISO(),
    });
    return {
      kind: "summary",
      message: summary,
      count: rows.length,
      currency,
      expenses: rows,
    };
  } catch (err) {
    console.error("query path failed:", err);
    return { kind: "error", message: "Couldn't run that query." };
  }
}

export async function submitPin(formData: FormData): Promise<void> {
  const pin = String(formData.get("pin") ?? "");
  const from = String(formData.get("from") ?? "/");
  if (!verifyPin(pin)) {
    redirect("/login?error=invalid");
  }
  const token = await issueSessionToken();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(from || "/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function updateCurrency(formData: FormData): Promise<void> {
  const code = String(formData.get("currency") ?? "").toUpperCase().trim();
  if (!/^[A-Z]{3}$/.test(code)) {
    redirect("/settings?error=invalid-currency");
  }
  await setSetting("currency", code);
  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function deleteExpense(id: number): Promise<void> {
  await deleteExpenseDb(id);
  revalidatePath("/");
  revalidatePath("/fluid");
  revalidatePath("/fluid/history");
  revalidatePath("/fluid/analytics");
}

export async function getRecentForDisplay(): Promise<{
  expenses: Expense[];
  currency: string;
}> {
  const [expenses, currency] = await Promise.all([getRecent(10), getCurrency()]);
  return { expenses, currency };
}
