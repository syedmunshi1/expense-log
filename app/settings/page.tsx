import Link from "next/link";
import { ArrowLeft, LogOut, KeyRound, Coins, CheckCircle2 } from "lucide-react";
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
    <main className="mx-auto max-w-xl px-4 pb-20 pt-6 sm:pt-10">
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="btn btn-ghost"
          aria-label="Back to home"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <span className="w-[72px]" aria-hidden />
      </header>

      <section className="card fade-in mb-4 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: "rgba(99, 102, 241, 0.12)",
              color: "var(--accent)",
            }}
          >
            <Coins size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Currency</h2>
            <p className="text-xs text-[color:var(--muted)]">
              Currently{" "}
              <span className="font-mono">
                {current} {CURRENCY_SYMBOLS[current] ?? ""}
              </span>
            </p>
          </div>
        </div>
        <form action={updateCurrency} className="flex flex-col gap-3">
          <select
            name="currency"
            defaultValue={current}
            className="input"
          >
            {Object.keys(CURRENCY_SYMBOLS).map((code) => (
              <option key={code} value={code}>
                {code} — {CURRENCY_SYMBOLS[code]}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary self-start">
            Save
          </button>
          {params.saved && (
            <p className="flex items-center gap-1.5 text-sm text-[color:var(--success)]">
              <CheckCircle2 size={14} /> Saved.
            </p>
          )}
          {params.error === "invalid-currency" && (
            <p className="text-sm text-[color:var(--danger)]">
              Invalid currency code.
            </p>
          )}
        </form>
      </section>

      <section className="card fade-in mb-4 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              color: "var(--danger)",
            }}
          >
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">PIN</h2>
            <p className="text-xs text-[color:var(--muted)]">
              Managed via <code className="font-mono">APP_PIN</code> environment variable.
            </p>
          </div>
        </div>
        <p className="text-xs text-[color:var(--fg-secondary)]">
          To rotate your PIN, update the env var in Vercel and redeploy.
        </p>
      </section>

      <section className="card fade-in p-5">
        <form action={logout}>
          <button type="submit" className="btn btn-ghost w-full sm:w-auto">
            <LogOut size={14} />
            Log out
          </button>
        </form>
      </section>
    </main>
  );
}
