import Link from "next/link";
import { getCurrency } from "@/lib/db";
import { CURRENCY_SYMBOLS } from "@/lib/currency";
import { logout, updateCurrency } from "../actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const current = await getCurrency();

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">⚙️ Settings</h1>
        <Link
          href="/"
          className="rounded px-2 py-1 text-sm hover:bg-[var(--card)]"
        >
          ← Home
        </Link>
      </header>

      <section className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Currency
        </h2>
        <form action={updateCurrency} className="flex flex-col gap-3">
          <label className="text-sm">
            Current:{" "}
            <span className="font-mono">
              {current} {CURRENCY_SYMBOLS[current] ? `(${CURRENCY_SYMBOLS[current]})` : ""}
            </span>
          </label>
          <select
            name="currency"
            defaultValue={current}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
          >
            {Object.keys(CURRENCY_SYMBOLS).map((code) => (
              <option key={code} value={code}>
                {code} — {CURRENCY_SYMBOLS[code]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="self-start rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Save
          </button>
          {params.saved && (
            <p className="text-sm text-[var(--success)]">Saved.</p>
          )}
          {params.error === "invalid-currency" && (
            <p className="text-sm text-[var(--danger)]">
              Invalid currency code.
            </p>
          )}
        </form>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          PIN
        </h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          PIN is controlled by the <code>APP_PIN</code> environment variable.
          To change it, update the variable in your deployment (e.g., Vercel
          dashboard) and redeploy.
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm"
          >
            Log out
          </button>
        </form>
      </section>
    </main>
  );
}
