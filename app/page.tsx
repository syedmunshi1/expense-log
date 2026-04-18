import Link from "next/link";
import { Settings, TrendingUp } from "lucide-react";
import { getRecent, getCurrency, getStats } from "@/lib/db";
import { formatAmount } from "@/lib/currency";
import { visualFor } from "@/lib/categories";
import { CategoryIcon } from "./category-icon";
import { InputConsole } from "./input-console";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [expenses, currency, stats] = await Promise.all([
    getRecent(10),
    getCurrency(),
    getStats(),
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
        <Link
          href="/settings"
          aria-label="Settings"
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-2 text-[color:var(--fg-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--fg)]"
        >
          <Settings size={18} />
        </Link>
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

      <InputConsole currency={currency} />

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
          <ul className="space-y-2">
            {expenses.map((e, i) => {
              const v = visualFor(e.category);
              return (
                <li
                  key={e.id}
                  className="card row-enter flex items-center gap-3 px-4 py-3"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: v.bg, color: v.color }}
                  >
                    <CategoryIcon name={v.icon} size={18} color={v.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium capitalize">
                      {e.description}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[color:var(--muted)]">
                      <span>{formatRelativeDate(e.date)}</span>
                      <span aria-hidden>·</span>
                      <span>{e.category}</span>
                    </div>
                  </div>
                  <div className="font-mono text-sm font-medium tabular-nums">
                    {formatAmount(e.amount, currency)}
                  </div>
                </li>
              );
            })}
          </ul>
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

function formatRelativeDate(iso: string): string {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayISO = `${y}-${m}-${d}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yestISO = `${yesterday.getFullYear()}-${String(
    yesterday.getMonth() + 1,
  ).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (iso === todayISO) return "Today";
  if (iso === yestISO) return "Yesterday";
  // else: "Mon, Apr 15"
  const date = new Date(iso + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
