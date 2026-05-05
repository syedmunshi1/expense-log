import { neon, Pool, type NeonQueryFunction } from "@neondatabase/serverless";

export type Expense = {
  id: number;
  amount: string; // NUMERIC comes back as string from pg
  description: string;
  category: string;
  date: string; // ISO date (YYYY-MM-DD)
  created_at: string;
};

export type ExpenseFilters = {
  category?: string;
  keyword?: string;
  start_date?: string;
  end_date?: string;
};

let cachedSql: NeonQueryFunction<false, false> | null = null;

export function sql(): NeonQueryFunction<false, false> {
  if (!cachedSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set.");
    cachedSql = neon(url);
  }
  return cachedSql;
}

// getSetting — unexported. Only called via getCurrency(userId) so callers
// cannot accidentally query settings without a user filter.
async function getSetting(key: string, userId: string): Promise<string | null> {
  const rows = (await sql()`
    SELECT value FROM settings WHERE key = ${key} AND user_id = ${userId}
  `) as unknown as { value: string }[];
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string, userId: string): Promise<void> {
  // ON CONFLICT now targets the composite PK (key, user_id) added in the migration.
  // The old single-column ON CONFLICT (key) would fail after migration.
  await sql()`
    INSERT INTO settings (key, value, user_id) VALUES (${key}, ${value}, ${userId})
    ON CONFLICT (key, user_id) DO UPDATE SET value = EXCLUDED.value
  `;
}

export async function getCurrency(userId: string): Promise<string> {
  const stored = await getSetting("currency", userId);
  return stored ?? process.env.CURRENCY ?? "INR";
}

export async function deleteExpense(id: number, userId: string): Promise<void> {
  // WHERE includes user_id — cross-user deletes silently no-op rather than error
  await sql()`DELETE FROM expenses WHERE id = ${id} AND user_id = ${userId}`;
}

export async function insertExpense(input: {
  amount: number;
  description: string;
  category: string;
  date: string;
  userId: string;
}): Promise<Expense> {
  const rows = (await sql()`
    INSERT INTO expenses (amount, description, category, date, user_id)
    VALUES (${input.amount}, ${input.description}, ${input.category}, ${input.date}, ${input.userId})
    RETURNING id, amount, description, category, to_char(date, 'YYYY-MM-DD') AS date, created_at
  `) as unknown as Expense[];
  return rows[0];
}

export async function fetchExpenses(
  userId: string,
  filters: ExpenseFilters,
): Promise<Expense[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // userId is always pushed first — conditions is never empty after this point,
  // so the WHERE clause is always present.
  params.push(userId);
  conditions.push(`user_id = $${params.length}`);

  if (filters.category) {
    params.push(filters.category);
    conditions.push(`LOWER(category) = LOWER($${params.length})`);
  }
  if (filters.keyword) {
    params.push(`%${filters.keyword}%`);
    const idx = params.length;
    conditions.push(`(description ILIKE $${idx} OR category ILIKE $${idx})`);
  }
  if (filters.start_date) {
    params.push(filters.start_date);
    conditions.push(`date >= $${params.length}`);
  }
  if (filters.end_date) {
    params.push(filters.end_date);
    conditions.push(`date <= $${params.length}`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const text = `
    SELECT id, amount, description, category,
           to_char(date, 'YYYY-MM-DD') AS date, created_at
    FROM expenses
    ${where}
    ORDER BY date DESC, id DESC
    LIMIT 500
  `;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const pool = new Pool({ connectionString: url });
  try {
    const result = await pool.query<Expense>(text, params);
    return result.rows;
  } finally {
    await pool.end();
  }
}

export async function getRecent(userId: string, limit = 10): Promise<Expense[]> {
  const rows = (await sql()`
    SELECT id, amount, description, category,
           to_char(date, 'YYYY-MM-DD') AS date, created_at
    FROM expenses
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as unknown as Expense[];
  return rows;
}

export async function getDistinctCategories(userId: string): Promise<string[]> {
  const rows = (await sql()`
    SELECT DISTINCT category FROM expenses WHERE user_id = ${userId} ORDER BY category
  `) as unknown as { category: string }[];
  return rows.map((r) => r.category);
}

export type Stats = {
  today: number;
  week: number;
  month: number;
  topCategory: { name: string; amount: number } | null;
  last7Days: { date: string; amount: number }[];
};

export async function getStats(userId: string): Promise<Stats> {
  const rows = (await sql()`
    SELECT to_char(date, 'YYYY-MM-DD') AS date, category, amount
    FROM expenses
    WHERE date >= CURRENT_DATE - INTERVAL '60 days'
      AND user_id = ${userId}
  `) as unknown as { date: string; category: string; amount: string }[];

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayISO = `${y}-${m}-${d}`;

  const monday = new Date(today);
  const dow = monday.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  monday.setDate(monday.getDate() + diff);
  const weekStart = monday.toISOString().slice(0, 10);
  const monthStart = `${y}-${m}-01`;

  let todayTotal = 0, weekTotal = 0, monthTotal = 0;
  const catTotals = new Map<string, number>();
  const dayTotals = new Map<string, number>();

  for (const r of rows) {
    const amt = parseFloat(r.amount);
    if (r.date === todayISO) todayTotal += amt;
    if (r.date >= weekStart) weekTotal += amt;
    if (r.date >= monthStart) {
      monthTotal += amt;
      catTotals.set(r.category, (catTotals.get(r.category) ?? 0) + amt);
    }
    dayTotals.set(r.date, (dayTotals.get(r.date) ?? 0) + amt);
  }

  let topCategory: { name: string; amount: number } | null = null;
  for (const [name, amount] of catTotals) {
    if (!topCategory || amount > topCategory.amount) topCategory = { name, amount };
  }

  const last7Days: { date: string; amount: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const iso = date.toISOString().slice(0, 10);
    last7Days.push({ date: iso, amount: dayTotals.get(iso) ?? 0 });
  }

  return { today: todayTotal, week: weekTotal, month: monthTotal, topCategory, last7Days };
}

// ─── Fluid Ledger helpers ──────────────────────────────────────────────────

export type MonthGroup = {
  label: string;
  expenses: Expense[];
};

export async function getExpensesByMonth(userId: string): Promise<MonthGroup[]> {
  const rows = (await sql()`
    SELECT id, amount, description, category,
           to_char(date, 'YYYY-MM-DD') AS date, created_at
    FROM expenses
    WHERE user_id = ${userId}
    ORDER BY date DESC, id DESC
    LIMIT 300
  `) as unknown as Expense[];

  const groups = new Map<string, Expense[]>();
  for (const e of rows) {
    const [yr, mo] = e.date.split("-");
    const label = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString("en-US", {
      month: "long", year: "numeric",
    });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(e);
  }
  return [...groups.entries()].map(([label, expenses]) => ({ label, expenses }));
}

export type Analytics = {
  monthTotal: number;
  prevMonthTotal: number;
  topCategory: { name: string; amount: number } | null;
  dailyAverage: number;
  weeklyTotals: { label: string; amount: number }[];
  categoryBreakdown: { name: string; amount: number; pct: number }[];
};

export async function getAnalytics(userId: string): Promise<Analytics> {
  const rows = (await sql()`
    SELECT to_char(date, 'YYYY-MM-DD') AS date, category, amount
    FROM expenses
    WHERE date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
      AND user_id = ${userId}
  `) as unknown as { date: string; category: string; amount: string }[];

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStart = new Date(y, m, 1).toISOString().slice(0, 10);
  const prevMonthStart = new Date(y, m - 1, 1).toISOString().slice(0, 10);

  let monthTotal = 0, prevMonthTotal = 0;
  const catMap = new Map<string, number>();
  const weekMap = new Map<number, number>();

  for (const r of rows) {
    const amt = parseFloat(r.amount);
    if (r.date >= monthStart) {
      monthTotal += amt;
      catMap.set(r.category, (catMap.get(r.category) ?? 0) + amt);
      const dayOfMonth = parseInt(r.date.split("-")[2], 10);
      const wk = Math.min(Math.ceil(dayOfMonth / 7), 4);
      weekMap.set(wk, (weekMap.get(wk) ?? 0) + amt);
    } else if (r.date >= prevMonthStart) {
      prevMonthTotal += amt;
    }
  }

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysPassed = Math.min(now.getDate(), daysInMonth);
  const dailyAverage = daysPassed > 0 ? monthTotal / daysPassed : 0;

  let topCategory: { name: string; amount: number } | null = null;
  const catBreakdown: { name: string; amount: number; pct: number }[] = [];
  for (const [name, amount] of catMap) {
    if (!topCategory || amount > topCategory.amount) topCategory = { name, amount };
  }
  for (const [name, amount] of [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    catBreakdown.push({ name, amount, pct: monthTotal > 0 ? Math.round((amount / monthTotal) * 100) : 0 });
  }

  const weeklyTotals = [1, 2, 3, 4].map((w) => ({ label: `W${w}`, amount: weekMap.get(w) ?? 0 }));

  return { monthTotal, prevMonthTotal, topCategory, dailyAverage, weeklyTotals, categoryBreakdown: catBreakdown };
}
