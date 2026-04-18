import Link from "next/link";
import { getRecent, getCurrency } from "@/lib/db";
import { formatAmount } from "@/lib/currency";
import { InputConsole } from "./input-console";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [expenses, currency] = await Promise.all([getRecent(10), getCurrency()]);

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">💰 Expense Tracker</h1>
        <Link
          href="/settings"
          className="rounded px-2 py-1 text-sm hover:bg-[var(--card)]"
          aria-label="Settings"
        >
          ⚙️
        </Link>
      </header>

      <InputConsole currency={currency} />

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Recent
        </h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No expenses yet. Type or speak one above.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--card)]">
            {expenses.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm">{e.description}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {e.date} · {e.category}
                  </div>
                </div>
                <div className="font-mono text-sm tabular-nums">
                  {formatAmount(e.amount, currency)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
