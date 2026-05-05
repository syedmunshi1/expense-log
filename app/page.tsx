import Link from "next/link";
import { Settings, TrendingUp } from "lucide-react";
import { getRecent, getCurrency, getStats } from "@/lib/db";
import { formatAmount } from "@/lib/currency";
import { visualFor } from "@/lib/categories";
import { CategoryIcon } from "./category-icon";
import { InputConsole } from "./input-console";
import { RecentList } from "./recent-list";
import { auth } from "@/auth";
import { deleteExpense, processInput } from "./actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const userId = session?.user?.email ?? "";
  const [expenses, currency, stats] = await Promise.all([
    getRecent(userId, 10),
    getCurrency(userId),
    getStats(userId),
  ]);

  const max7 = Math.max(1, ...stats.last7Days.map((d) => d.amount));

  return (
    <main className="mx-auto max-w-xl px-4 pb-24 pt-6 sm:pt-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg"
              style={{
                background: "var(--gradient-hero)",
                color: "#fff",
                boxShadow: "var(--shadow-md)",
              }}
            >
              ₹
            </span>
            <h1 className="text-xl font-semibold tracking-tight">
              Expense Log
            </h1>
          </div>
          <p className="mt-1 text-sm text-[color:var(--fg-secondary)]">
            Speak or type. I&apos;ll do the math.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/fluid"
            className="rounded-full border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--accent)] hover:text-white"
          >
            Fluid UI
          </Link>
          <Link
            href="/demo"
            className="rounded-full border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[color:var(--fg-secondary)] transition hover:bg-[color:var(--accent)] hover:text-white"
          >
            Demo
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-2 text-[color:var(--fg-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--fg)]"
          >
            <Settings size={18} />
          </Link>
        </div>
      </header>

      {/* Stats row */}
      <section className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Today" value={formatAmount(stats.today, currency)} />
        <StatCard label="This week" value={formatAmount(stats.week, currency)} />
        <StatCard label="This month" value={formatAmount(stats.month, currency)} />
      </section>

      {/* Sparkline + top category */}
      <section className="mb-6 card-gradient fade-in p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="stat-label flex items-center gap-1.5">
              <TrendingUp size={12} /> Last 7 days
            </div>
            <div className="stat-value mt-0.5">
              {formatAmount(
                stats.last7Days.reduce((s, d) => s + d.amount, 0),
                currency,
              )}
            </div>
          </div>
          {stats.topCategory && (
            <TopCategoryBadge
              name={stats.topCategory.name}
              amount={stats.topCategory.amount}
              currency={currency}
            />
          )}
        </div>
        <div className="spark">
          {stats.last7Days.map((d) => (
            <div
              key={d.date}
              className="spark-bar"
              style={{ height: `${(d.amount / max7) * 100}%` }}
              title={`${d.date}: ${formatAmount(d.amount, currency)}`}
            />
          ))}
        </div>
      </section>

      <InputConsole currency={currency} processInputAction={processInput} />

      <section className="mt-8">
        <h2 className="stat-label mb-3">Recent</h2>
        {expenses.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
            <div
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                background: "var(--gradient-card)",
              }}
            >
              <TrendingUp size={20} color="var(--accent)" />
            </div>
            <p className="text-sm text-[color:var(--fg-secondary)]">
              No expenses yet.
            </p>
            <p className="text-xs text-[color:var(--muted)]">
              Try{" "}
              <code className="rounded bg-[color:var(--border)] px-1.5 py-0.5 text-xs">
                lunch 250
              </code>{" "}
              to get started.
            </p>
          </div>
        ) : (
          <RecentList expenses={expenses} currency={currency} deleteExpenseAction={deleteExpense} />
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card fade-in px-3 py-3 sm:px-4 sm:py-4">
      <div className="stat-label">{label}</div>
      <div className="stat-value mt-1 text-base sm:text-xl">{value}</div>
    </div>
  );
}

function TopCategoryBadge({
  name,
  amount,
  currency,
}: {
  name: string;
  amount: number;
  currency: string;
}) {
  const v = visualFor(name);
  return (
    <div
      className="pill"
      style={{ background: v.bg, color: v.color }}
      title={`Top category this month: ${formatAmount(amount, currency)}`}
    >
      <CategoryIcon name={v.icon} size={12} color={v.color} />
      <span className="font-medium">{name}</span>
    </div>
  );
}
