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
