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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-semibold">🔒 Enter PIN</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        This expense tracker is PIN-protected.
      </p>
      <form action={submitPin} className="flex flex-col gap-3">
        <input type="hidden" name="from" value={from} />
        <input
          type="password"
          name="pin"
          inputMode="numeric"
          autoComplete="off"
          required
          pattern="[0-9]*"
          placeholder="PIN"
          autoFocus
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-lg tracking-widest outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white"
        >
          Unlock
        </button>
        {errored && (
          <p className="text-sm text-[var(--danger)]">Incorrect PIN.</p>
        )}
      </form>
    </main>
  );
}
