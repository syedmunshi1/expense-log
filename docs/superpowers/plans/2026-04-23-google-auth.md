# Google OAuth + Demo Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PIN auth with Google OAuth (Auth.js v5), add per-user data isolation, and create a public `/demo` sandbox anyone can share.

**Architecture:** Auth.js v5 wraps the existing Next.js 16 middleware (`proxy.ts`). Every DB function gains a `userId` param (the signed-in Google email). A public `/demo` route uses hardcoded `userId = 'demo'` and reuses the same UI components via action props. Client components that currently hard-import server actions are refactored to accept those actions as props, enabling the demo to inject demo-specific actions.

**Tech Stack:** `next-auth@beta`, Google OAuth provider, Neon Postgres (schema migration), Next.js 16 App Router, TypeScript.

---

## File Map

| File | Action | Notes |
|---|---|---|
| `auth.ts` | **Create** | Auth.js config: Google provider + allowlist callback |
| `app/api/auth/[...nextauth]/route.ts` | **Create** | Required OAuth catch-all route |
| `db/migrate-add-user-id.sql` | **Create** | One-time Neon migration — run BEFORE deploying |
| `lib/db.ts` | **Modify** | All 11 functions gain `userId` param |
| `proxy.ts` | **Modify** | Replace HMAC check with Auth.js middleware |
| `app/actions.ts` | **Modify** | Session guards on all actions; remove `submitPin` |
| `app/fluid/fluid-chat.tsx` | **Modify** | Accept `processInputAction` prop |
| `app/fluid/history/history-list.tsx` | **Modify** | Accept `deleteExpenseAction` prop |
| `app/recent-list.tsx` | **Modify** | Accept `deleteExpenseAction` prop |
| `app/input-console.tsx` | **Modify** | Accept `processInputAction` prop |
| `app/fluid/fluid-nav.tsx` | **Modify** | Accept `basePath` prop (default `/fluid`) |
| `app/page.tsx` | **Modify** | Auth session → userId; pass action props; Demo link |
| `app/fluid/page.tsx` | **Modify** | Auth session → userId; pass action props; Demo link; profile photo |
| `app/fluid/history/page.tsx` | **Modify** | Auth session → userId; pass action prop; profile photo |
| `app/fluid/analytics/page.tsx` | **Modify** | Auth session → userId |
| `app/settings/page.tsx` | **Modify** | Remove PIN section; add Google account card |
| `app/login/page.tsx` | **Modify** | Google sign-in button; Demo link; AccessDenied error |
| `app/demo/actions.ts` | **Create** | All actions hardcoded to `userId = 'demo'` |
| `app/demo/layout.tsx` | **Create** | Demo banner + FluidNav with `basePath="/demo"` |
| `app/demo/page.tsx` | **Create** | Chat page (reuses FluidChat with demo action) |
| `app/demo/history/page.tsx` | **Create** | History (reuses HistoryList with demo action) |
| `app/demo/analytics/page.tsx` | **Create** | Analytics display — full file, demo userId |
| `lib/auth.ts` | **Delete** | HMAC + PIN helpers no longer needed |
| `tests/auth.test.ts` | **Delete** | Tests for the deleted lib/auth.ts |

> **`app/fluid/layout.tsx` is NOT modified.** It calls `<FluidNav />` with no props, which is fine — `basePath` defaults to `"/fluid"`.

---

## Execution Order (keeps every commit green)

Tasks are ordered so `npm run build` passes after each commit:

1. **Task 1** — Install + migration SQL file (no TS changes)
2. **Task 2** — `auth.ts` + API route (new files only)
3. **Task 3** — `proxy.ts` (replaces middleware, no signature impact)
4. **Task 4** — Login page (new UI, no broken imports)
5. **Task 5** — **Atomic batch**: `lib/db.ts` + `app/actions.ts` + all 5 client component refactors + all 5 server page updates — committed together so no broken build window exists
6. **Task 6** — Demo actions + demo pages
7. **Task 7** — Delete `lib/auth.ts` + `tests/auth.test.ts`
8. **Task 8** — Migration → push → Vercel config

---

## Task 1: Install Dependency + Write Migration SQL

**Files:**
- Run: `npm install next-auth@beta`
- Create: `db/migrate-add-user-id.sql`

- [ ] **Step 1: Install next-auth**

```bash
cd "/Users/sasmunshi/Claude Apps/Expense tracker"
npm install next-auth@beta
```

Expected: `next-auth` added to `package.json` dependencies.

- [ ] **Step 2: Create migration file**

Create `db/migrate-add-user-id.sql`:

```sql
-- Add user ownership to expenses (existing rows get 'legacy')
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy';

-- Add user ownership to settings (currency becomes per-user)
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy';

-- Drop old single-column primary key, replace with composite
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE settings ADD PRIMARY KEY (key, user_id);

-- Performance indexes for per-user queries
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user  ON settings(user_id);
```

- [ ] **Step 3: Commit**

```bash
git add db/migrate-add-user-id.sql package.json package-lock.json
git commit -m "feat: install next-auth@beta and write user-id migration SQL"
```

---

## Task 2: Create auth.ts + API Route

**Files:**
- Create: `auth.ts` (project root)
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create `auth.ts`**

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    signIn({ user }) {
      const allowed = (process.env.ALLOWED_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      // Empty allowlist rejects everyone — fail-safe
      if (allowed.length === 0) return false;
      return allowed.includes(user.email?.toLowerCase() ?? "");
    },
  },
});
```

- [ ] **Step 2: Create `app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 3: Commit**

```bash
git add auth.ts app/api/auth/
git commit -m "feat: add Auth.js v5 config with Google provider and email allowlist"
```

---

## Task 3: Update proxy.ts

**Files:**
- Modify: `proxy.ts`

Replace the HMAC cookie check with Auth.js v5 middleware. `/api/auth/*` must be public so the OAuth callback can set the session cookie before the middleware intercepts it — otherwise there is a redirect loop.

- [ ] **Step 1: Replace `proxy.ts`**

```ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

// /api/auth/* MUST be public — the OAuth callback sets the session cookie
// here, so intercepting it before the cookie is written causes a redirect loop.
const PUBLIC_PATHS = ["/login", "/demo", "/api/auth"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (req.auth) return NextResponse.next();
  const loginUrl = new URL("/login", req.url);
  if (pathname !== "/") loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)" ],
};
```

- [ ] **Step 2: Commit**

```bash
git add proxy.ts
git commit -m "feat: replace HMAC middleware with Auth.js v5 middleware"
```

---

## Task 4: Update Login Page

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Replace `app/login/page.tsx`**

```tsx
import Link from "next/link";
import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const params = await searchParams;
  const from = params.from ?? "/";
  const isAccessDenied = params.error === "AccessDenied";

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center px-6">
      <div
        className="card fade-in px-6 py-8"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            aria-hidden
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
            style={{
              background: "var(--gradient-hero)",
              color: "#fff",
              boxShadow: "var(--shadow-md)",
            }}
          >
            ₹
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Expense Log</h1>
          <p className="mt-1 text-sm text-[color:var(--fg-secondary)]">
            Sign in to access your personal expense log.
          </p>
        </div>

        {isAccessDenied && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-center text-sm text-red-600">
            Your Google account isn&apos;t on the access list.
          </p>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: from });
          }}
        >
          <button
            type="submit"
            className="btn btn-primary flex w-full items-center justify-center gap-2"
          >
            {/* Google G logo */}
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Sign in with Google
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-[color:var(--muted)]">
        Just browsing?{" "}
        <Link
          href="/demo"
          className="font-medium text-[color:var(--accent)] hover:underline"
        >
          Try the demo →
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: replace PIN login with Google sign-in button and demo link"
```

---

## Task 5: Atomic Batch — DB Layer + Actions + Client Components + Server Pages

> **Why one commit?** `lib/db.ts` changes all function signatures. Every caller breaks until updated. This entire task must be committed atomically — do not commit individual steps.

**Files modified in this task:**
`lib/db.ts`, `app/actions.ts`, `app/fluid/fluid-chat.tsx`, `app/fluid/history/history-list.tsx`, `app/recent-list.tsx`, `app/input-console.tsx`, `app/fluid/fluid-nav.tsx`, `app/page.tsx`, `app/fluid/page.tsx`, `app/fluid/history/page.tsx`, `app/fluid/analytics/page.tsx`, `app/settings/page.tsx`

---

### 5a: Replace lib/db.ts

- [ ] **Replace the entire `lib/db.ts`**

```ts
import { neon, Pool, type NeonQueryFunction } from "@neondatabase/serverless";

export type Expense = {
  id: number;
  amount: string;
  description: string;
  category: string;
  date: string;
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
  // so the WHERE clause is always present. The old "conditions.length ? WHERE : ''"
  // guard is intentionally removed since userId makes it unconditional.
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
```

---

### 5b: Replace app/actions.ts

- [ ] **Replace the entire `app/actions.ts`**

```ts
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
```

---

### 5c: Refactor Client Components

- [ ] **`app/fluid/fluid-chat.tsx` — accept `processInputAction` prop**

Change the import at the top — remove `processInput` from the import, keep only `type ProcessResult`:
```ts
// Remove this line:
// import { processInput, type ProcessResult } from "@/app/actions";
// Replace with:
import type { ProcessResult } from "@/app/actions";
```

Change the component signature:
```ts
// Before:
export function FluidChat({ currency }: { currency: string })

// After:
export function FluidChat({
  currency,
  processInputAction,
}: {
  currency: string;
  processInputAction: (input: string) => Promise<ProcessResult>;
})
```

Inside the `submit` callback, replace `await processInput(v)` with `await processInputAction(v)`.

- [ ] **`app/fluid/history/history-list.tsx` — accept `deleteExpenseAction` prop**

Remove `import { deleteExpense } from "@/app/actions"`.

Change the component signature:
```ts
// Before:
export function HistoryList({ groups, currency }: { groups: MonthGroup[]; currency: string })

// After:
export function HistoryList({
  groups,
  currency,
  deleteExpenseAction,
}: {
  groups: MonthGroup[];
  currency: string;
  deleteExpenseAction: (id: number) => Promise<void>;
})
```

Replace all calls to `deleteExpense(id)` with `deleteExpenseAction(id)` (there are two: in `handleConfirm` and the optimistic remove).

- [ ] **`app/recent-list.tsx` — accept `deleteExpenseAction` prop**

Remove `import { deleteExpense } from "./actions"`.

Change the component signature:
```ts
// Before:
export function RecentList({ expenses: initial, currency }: { expenses: Expense[]; currency: string })

// After:
export function RecentList({
  expenses: initial,
  currency,
  deleteExpenseAction,
}: {
  expenses: Expense[];
  currency: string;
  deleteExpenseAction: (id: number) => Promise<void>;
})
```

Replace the `deleteExpense(id)` call inside `handleConfirm` with `deleteExpenseAction(id)`.

- [ ] **`app/input-console.tsx` — accept `processInputAction` prop**

Remove `processInput` from the import, keep `type ProcessResult`:
```ts
// Remove: import { processInput, type ProcessResult } from "./actions";
// Replace with:
import type { ProcessResult } from "./actions";
```

Change the component signature:
```ts
// Before:
export function InputConsole({ currency }: { currency: string })

// After:
export function InputConsole({
  currency,
  processInputAction,
}: {
  currency: string;
  processInputAction: (input: string) => Promise<ProcessResult>;
})
```

Replace `await processInput(v)` in the `submit` callback with `await processInputAction(v)`.

- [ ] **`app/fluid/fluid-nav.tsx` — accept `basePath` prop**

Change the component to accept a `basePath` prop defaulting to `"/fluid"`:

```ts
export function FluidNav({ basePath = "/fluid" }: { basePath?: string }) {
  const path = usePathname();

  const TABS = [
    { href: basePath, icon: MessageSquare, label: "Chat" },
    { href: `${basePath}/history`, icon: History, label: "History" },
    { href: `${basePath}/analytics`, icon: BarChart2, label: "Analytics" },
  ];
  // ... rest of JSX unchanged; active check (path === href) still works
```

---

### 5d: Update All Server Pages

- [ ] **`app/page.tsx`**

Add imports at the top:
```ts
import { auth } from "@/auth";
import { deleteExpense, processInput } from "./actions";
```

At the start of the `Home` function body, add:
```ts
const session = await auth();
const userId = session?.user?.email ?? "";
```

Update the `Promise.all`:
```ts
const [expenses, currency, stats] = await Promise.all([
  getRecent(userId, 10),
  getCurrency(userId),
  getStats(userId),
]);
```

In the header, add a **Demo** link alongside the existing **Fluid UI** link:
```tsx
<Link
  href="/demo"
  className="rounded-full border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[color:var(--fg-secondary)] transition hover:bg-[color:var(--accent)] hover:text-white"
>
  Demo
</Link>
```

Update `<InputConsole>`:
```tsx
<InputConsole currency={currency} processInputAction={processInput} />
```

Update `<RecentList>`:
```tsx
<RecentList expenses={expenses} currency={currency} deleteExpenseAction={deleteExpense} />
```

- [ ] **`app/fluid/page.tsx`**

Add imports:
```ts
import { auth } from "@/auth";
import { processInput } from "@/app/actions";
```

At the start of `FluidHome`:
```ts
const session = await auth();
const userId = session?.user?.email ?? "";
const [currency, stats] = await Promise.all([getCurrency(userId), getStats(userId)]);
```

Replace the `👤` avatar div with a conditional profile photo:
```tsx
{session?.user?.image ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={session.user.image}
    alt={session.user.name ?? "Profile"}
    style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
  />
) : (
  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#eaefef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
    👤
  </div>
)}
```

Add **DEMO** link in the header next to the existing "SWITCH UI" link:
```tsx
<Link
  href="/demo"
  style={{ fontSize: "11px", fontWeight: 600, color: "#596061", background: "#eaefef", padding: "4px 10px", borderRadius: "999px", textDecoration: "none" }}
>
  DEMO
</Link>
```

Update `<FluidChat>`:
```tsx
<FluidChat currency={currency} processInputAction={processInput} />
```

- [ ] **`app/fluid/history/page.tsx`**

Add imports:
```ts
import { auth } from "@/auth";
import { deleteExpense } from "@/app/actions";
```

At the start of `HistoryPage`:
```ts
const session = await auth();
const userId = session?.user?.email ?? "";
const [groups, currency] = await Promise.all([getExpensesByMonth(userId), getCurrency(userId)]);
```

Replace `👤` avatar with conditional profile photo (same pattern as `fluid/page.tsx` above).

Update `<HistoryList>`:
```tsx
<HistoryList groups={groups} currency={currency} deleteExpenseAction={deleteExpense} />
```

- [ ] **`app/fluid/analytics/page.tsx`**

Add import:
```ts
import { auth } from "@/auth";
```

At the start of `AnalyticsPage`:
```ts
const session = await auth();
const userId = session?.user?.email ?? "";
const [analytics, currency] = await Promise.all([getAnalytics(userId), getCurrency(userId)]);
```

No other changes — all rendering JSX stays the same.

- [ ] **`app/settings/page.tsx`**

Add import:
```ts
import { auth } from "@/auth";
```

Update imports — remove `KeyRound` from lucide imports (no longer used after PIN section is deleted).

At the start of `SettingsPage`:
```ts
const session = await auth();
const userId = session?.user?.email ?? "";
const current = await getCurrency(userId);
```

**Delete the entire PIN `<section>` block** (the card with `KeyRound` icon, "PIN" heading, and text about `APP_PIN`).

**Add an Account card** between the Currency section and the Logout section:
```tsx
<section className="card fade-in mb-4 p-5">
  <div className="flex items-center gap-3">
    {session?.user?.image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={session.user.image}
        alt="Profile"
        className="h-10 w-10 rounded-full object-cover"
      />
    ) : (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--bg-elevated)] text-lg">
        👤
      </div>
    )}
    <div>
      <div className="text-sm font-semibold">{session?.user?.name ?? "Signed in"}</div>
      <div className="text-xs text-[color:var(--muted)]">{session?.user?.email}</div>
    </div>
  </div>
</section>
```

- [ ] **Verify the build passes**

```bash
cd "/Users/sasmunshi/Claude Apps/Expense tracker" && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`. Fix any TypeScript errors before committing.

- [ ] **Commit everything in this task atomically**

```bash
git add lib/db.ts app/actions.ts \
        app/fluid/fluid-chat.tsx app/fluid/history/history-list.tsx \
        app/recent-list.tsx app/input-console.tsx app/fluid/fluid-nav.tsx \
        app/page.tsx app/fluid/page.tsx app/fluid/history/page.tsx \
        app/fluid/analytics/page.tsx app/settings/page.tsx
git commit -m "feat: add userId to all DB functions, session guards on actions, refactor component props"
```

---

## Task 6: Create Demo Routes

**Files:**
- Create: `app/demo/actions.ts`
- Create: `app/demo/layout.tsx`
- Create: `app/demo/page.tsx`
- Create: `app/demo/history/page.tsx`
- Create: `app/demo/analytics/page.tsx`

- [ ] **Step 1: Create `app/demo/actions.ts`**

> Note: `todayISO()` is intentionally duplicated here — keeping demo actions self-contained prevents any accidental import of auth-requiring code from `app/actions.ts`.

```ts
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
```

- [ ] **Step 2: Create `app/demo/layout.tsx`**

```tsx
import Link from "next/link";
import { FluidNav } from "@/app/fluid/fluid-nav";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={jakarta.variable} style={{ minHeight: "100dvh", background: "#f8fafa" }}>
      {/* Sticky demo banner */}
      <div
        style={{
          background: "#006a6a",
          color: "#e0fffe",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "13px",
          fontWeight: 600,
          position: "sticky",
          top: 0,
          zIndex: 60,
        }}
      >
        <span>⚡ Demo — data is shared with everyone</span>
        <Link
          href="/login"
          style={{ color: "#e0fffe", textDecoration: "underline", whiteSpace: "nowrap" }}
        >
          Sign in →
        </Link>
      </div>

      <div style={{ paddingBottom: "72px" }}>{children}</div>

      {/* Nav tabs point to /demo/* routes */}
      <FluidNav basePath="/demo" />
    </div>
  );
}
```

- [ ] **Step 3: Create `app/demo/page.tsx`**

```tsx
import { getCurrency, getStats } from "@/lib/db";
import { formatAmount } from "@/lib/currency";
import { FluidChat } from "@/app/fluid/fluid-chat";
import { processInput } from "./actions";

const DEMO_USER = "demo";
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const [currency, stats] = await Promise.all([
    getCurrency(DEMO_USER),
    getStats(DEMO_USER),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 108px)" }}>
      <div style={{ padding: "12px 20px 4px", background: "#f8fafa" }}>
        <span
          style={{
            fontFamily: "var(--font-jakarta), sans-serif",
            fontWeight: 700,
            fontSize: "17px",
            color: "#2d3435",
          }}
        >
          The Fluid Ledger
        </span>
      </div>

      <div style={{ padding: "4px 20px 16px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "#596061", textTransform: "uppercase", marginBottom: "4px" }}>
          Demo Month Spend
        </p>
        <p style={{ fontFamily: "var(--font-jakarta), sans-serif", fontSize: "36px", fontWeight: 800, color: "#2d3435", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          {formatAmount(stats.month, currency)}
        </p>
      </div>

      <FluidChat currency={currency} processInputAction={processInput} />
    </div>
  );
}
```

- [ ] **Step 4: Create `app/demo/history/page.tsx`**

```tsx
import { getExpensesByMonth, getCurrency } from "@/lib/db";
import { HistoryList } from "@/app/fluid/history/history-list";
import { deleteExpense } from "@/app/demo/actions";

const DEMO_USER = "demo";
export const dynamic = "force-dynamic";

export default async function DemoHistoryPage() {
  const [groups, currency] = await Promise.all([
    getExpensesByMonth(DEMO_USER),
    getCurrency(DEMO_USER),
  ]);

  return (
    <div>
      <div style={{ padding: "16px 20px 0" }}>
        <h1
          style={{
            fontFamily: "var(--font-jakarta), sans-serif",
            fontSize: "36px",
            fontWeight: 800,
            color: "#2d3435",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          History
        </h1>
        <p style={{ fontSize: "14px", color: "#596061", marginTop: "4px" }}>
          Shared demo expenses — visible to all visitors.
        </p>
      </div>
      <HistoryList groups={groups} currency={currency} deleteExpenseAction={deleteExpense} />
    </div>
  );
}
```

- [ ] **Step 5: Create `app/demo/analytics/page.tsx`**

Copy the **complete** contents of `app/fluid/analytics/page.tsx` verbatim — including the local `StatCard` function at the bottom. Then make exactly these three changes and no others:

1. Change the function name from `AnalyticsPage` to `DemoAnalyticsPage`
2. Add `const DEMO_USER = "demo";` before the function
3. Replace the data-fetching line inside the function:

```ts
// Remove:
const session = await auth();
const userId = session?.user?.email ?? "";
const [analytics, currency] = await Promise.all([getAnalytics(userId), getCurrency(userId)]);

// Replace with:
const [analytics, currency] = await Promise.all([getAnalytics(DEMO_USER), getCurrency(DEMO_USER)]);
```

Also remove the `import { auth } from "@/auth"` line since the demo analytics page does not need it.

All rendering JSX (`StatCard` usage, charts, category breakdown) remains identical.

- [ ] **Step 6: Commit**

```bash
git add app/demo/
git commit -m "feat: add /demo route with chat, history, and analytics"
```

---

## Task 7: Delete Obsolete Files + Update Tests

**Files:**
- Delete: `lib/auth.ts`
- Delete: `tests/auth.test.ts`

- [ ] **Step 1: Delete lib/auth.ts**

```bash
rm "/Users/sasmunshi/Claude Apps/Expense tracker/lib/auth.ts"
```

- [ ] **Step 2: Delete auth tests**

`tests/auth.test.ts` tests the now-deleted HMAC and PIN functions. It cannot pass without `lib/auth.ts`.

```bash
rm "/Users/sasmunshi/Claude Apps/Expense tracker/tests/auth.test.ts"
```

- [ ] **Step 3: Confirm remaining tests pass**

```bash
cd "/Users/sasmunshi/Claude Apps/Expense tracker" && npm test 2>&1
```

Expected: parser and currency tests pass. Fix any failures before continuing.

- [ ] **Step 4: Final build check**

```bash
npm run build 2>&1 | tail -25
```

Expected route list includes `/demo`, `/demo/analytics`, `/demo/history`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete lib/auth.ts and auth tests (replaced by Auth.js v5)"
```

---

## Task 8: Migration → Deploy → Vercel Config

> **Critical: run the migration BEFORE pushing.** The new `lib/db.ts` requires the `user_id` column. Vercel auto-deploys on push — deploying before migration means every DB call fails in production.

- [ ] **Step 1: Run migration against Neon**

Open [console.neon.tech](https://console.neon.tech) → your project → **SQL Editor**. Paste and run the contents of `db/migrate-add-user-id.sql`. Confirm all four statements succeed.

- [ ] **Step 2: Push to GitHub**

```bash
cd "/Users/sasmunshi/Claude Apps/Expense tracker" && git push origin main
```

- [ ] **Step 3: Set Vercel environment variables**

In Vercel dashboard → project → **Settings** → **Environment Variables**:

| Key | Value | How to get it |
|---|---|---|
| `AUTH_GOOGLE_ID` | Google OAuth client ID | Step 4 below |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Step 4 below |
| `AUTH_SECRET` | Random secret ≥32 chars | `openssl rand -base64 32` |
| `ALLOWED_EMAILS` | `you@gmail.com, other@gmail.com` | Your email(s), spaces OK |

**Remove** `APP_PIN` and `SESSION_SECRET`.

- [ ] **Step 4: Configure Google Cloud Console**

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. **Create OAuth 2.0 Client ID** → Application type: **Web application**. No extra APIs needed — profile name and photo come from the OAuth token directly.
3. **Authorised redirect URIs** — add both:
   - `https://<your-vercel-domain>/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
4. Copy **Client ID** → `AUTH_GOOGLE_ID`, **Client Secret** → `AUTH_GOOGLE_SECRET`

- [ ] **Step 5: Trigger redeploy and verify**

After Vercel redeploys:
1. Visit the app — should redirect to `/login`
2. "Sign in with Google" → Google consent screen → lands on `/` after sign-in
3. Log an expense — confirm it only shows for your account
4. Open private window, sign in with a second allowlisted email → separate empty log
5. Visit `/demo` without signing in — should work, no redirect
6. Log an expense in demo → visible to anyone who visits `/demo`
7. Click "Sign in →" in the demo banner → taken to `/login`

---

## Notes for Implementer

- **Migration must precede deployment** — the new code requires `user_id` to exist. Old data gets `user_id = 'legacy'` and is invisible to authenticated users; this is intentional.

- **Google profile photos use `<img>` not `next/image`** — this avoids having to add `lh3.googleusercontent.com` to `next.config.js`. If you later switch to `next/image`, add this to `next.config.js`:
  ```js
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  }
  ```

- **`todayISO()` is duplicated in `app/demo/actions.ts`** — intentional. Keeping demo actions self-contained prevents any accidental import chain that pulls in `auth()`.

- **Demo data is permanent** — all demo users share `user_id = 'demo'`. To clear it: `DELETE FROM expenses WHERE user_id = 'demo'` in the Neon SQL editor.

- **Auth.js v5 is in beta** — if you hit unexpected issues, check [authjs.dev](https://authjs.dev) for v5-specific docs. The API is stable but the npm tag is `@beta`.
