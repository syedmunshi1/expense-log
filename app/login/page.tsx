import { Lock } from "lucide-react";
import { submitPin } from "../actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const params = await searchParams;
  const from = params.from ?? "/";
  const errored = params.error === "invalid";

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center px-6">
      <div className="card fade-in px-6 py-8 shadow-lg" style={{ boxShadow: "var(--shadow-lg)" }}>
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            aria-hidden
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: "var(--gradient-hero)",
              color: "#fff",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <Lock size={22} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-[color:var(--fg-secondary)]">
            Enter your PIN to unlock your expense log.
          </p>
        </div>
        <form action={submitPin} className="flex flex-col gap-3">
          <input type="hidden" name="from" value={from} />
          <input
            type="password"
            name="pin"
            inputMode="numeric"
            autoComplete="off"
            required
            pattern="[0-9]*"
            placeholder="• • • •"
            autoFocus
            className="input text-center text-2xl tracking-[0.6em]"
          />
          <button type="submit" className="btn btn-primary">
            Unlock
          </button>
          {errored && (
            <p className="text-center text-sm text-[color:var(--danger)]">
              Incorrect PIN. Try again.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
