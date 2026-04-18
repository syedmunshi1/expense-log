import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

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

export async function insertExpense(input: {
  amount: number;
  description: string;
  category: string;
  date: string;
}): Promise<Expense> {
  const rows = (await sql()`
    INSERT INTO expenses (amount, description, category, date)
    VALUES (${input.amount}, ${input.description}, ${input.category}, ${input.date})
    RETURNING id, amount, description, category, to_char(date, 'YYYY-MM-DD') AS date, created_at
  `) as unknown as Expense[];
  return rows[0];
}

export async function fetchExpenses(
  filters: ExpenseFilters,
): Promise<Expense[]> {
  // Build dynamic WHERE clauses while keeping parameterized queries.
  // @neondatabase/serverless supports tagged template literal interpolation
  // for values but not for structural SQL — so we use the .query(text, params) form.
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.category) {
    params.push(filters.category);
    conditions.push(`LOWER(category) = LOWER($${params.length})`);
  }
  if (filters.start_date) {
    params.push(filters.start_date);
    conditions.push(`date >= $${params.length}`);
  }
  if (filters.end_date) {
    params.push(filters.end_date);
    conditions.push(`date <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const text = `
    SELECT id, amount, description, category,
           to_char(date, 'YYYY-MM-DD') AS date, created_at
    FROM expenses
    ${where}
    ORDER BY date DESC, id DESC
    LIMIT 500
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await (sql() as any).query(text, params)) as
    | Expense[]
    | { rows: Expense[] };
  return Array.isArray(result) ? result : result.rows;
}

export async function getRecent(limit = 10): Promise<Expense[]> {
  const rows = (await sql()`
    SELECT id, amount, description, category,
           to_char(date, 'YYYY-MM-DD') AS date, created_at
    FROM expenses
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as unknown as Expense[];
  return rows;
}

export async function getDistinctCategories(): Promise<string[]> {
  const rows = (await sql()`
    SELECT DISTINCT category FROM expenses ORDER BY category
  `) as unknown as { category: string }[];
  return rows.map((r) => r.category);
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = (await sql()`
    SELECT value FROM settings WHERE key = ${key}
  `) as unknown as { value: string }[];
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sql()`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export async function getCurrency(): Promise<string> {
  const stored = await getSetting("currency");
  return stored ?? process.env.CURRENCY ?? "INR";
}
