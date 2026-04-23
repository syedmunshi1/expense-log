# Google OAuth + Demo Mode — Design Spec

**Date:** 2026-04-21
**Status:** Approved

---

## Overview

Replace the existing PIN-based authentication with Google OAuth (Auth.js v5) to support multiple users, each with their own private expense log. Add a public `/demo` route so the app can be shared without requiring a Google account.

---

## Goals

- Any allowlisted Google account can sign in and gets a private, isolated expense log
- Non-allowlisted Google accounts are rejected at the OAuth callback
- Old PIN-era data remains in the DB (labelled `user_id = 'legacy'`) but is invisible to authenticated users
- A public `/demo` route provides a full, shared sandbox with no login required
- A "Demo" link appears in both main UIs and on the login page

---

## Non-Goals

- Shared/team expense pools
- Admin dashboard to manage users
- Periodic demo data reset
- Migrating legacy PIN-era data to any user account

---

## Auth Library

**Auth.js v5 (`next-auth@beta`)** with the Google provider.

- JWT sessions — no database table required for sessions
- Session cookie signed with `AUTH_SECRET`
- Google provider reads `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`
- `signIn` callback enforces the email allowlist
- No Google People API required — profile name and photo come from the OAuth token directly

---

## Environment Variables

| Variable | Purpose | New/Changed |
|---|---|---|
| `AUTH_GOOGLE_ID` | Google OAuth client ID | New |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | New |
| `AUTH_SECRET` | Signs session cookies (≥32 chars) | New |
| `ALLOWED_EMAILS` | Comma-separated allowlist — spaces around commas are tolerated e.g. `a@gmail.com, b@gmail.com` | New |
| `APP_PIN` | PIN auth — **removed** | Deleted |
| `SESSION_SECRET` | HMAC cookie secret — **removed** | Deleted |
| `DATABASE_URL` | Neon connection string | Unchanged |
| `ANTHROPIC_API_KEY` | Claude API key | Unchanged |
| `CURRENCY` | Default currency fallback | Unchanged |

---

## Database Schema Changes

Run `db/migrate-add-user-id.sql` once against Neon before deploying.

```sql
-- Add user ownership to expenses
ALTER TABLE expenses
  ADD COLUMN user_id TEXT NOT NULL DEFAULT 'legacy';

-- Add user ownership to settings (currency becomes per-user)
ALTER TABLE settings
  ADD COLUMN user_id TEXT NOT NULL DEFAULT 'legacy';

-- Composite primary key for settings
ALTER TABLE settings DROP CONSTRAINT settings_pkey;
ALTER TABLE settings ADD PRIMARY KEY (key, user_id);

-- Performance indexes
CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_settings_user  ON settings(user_id);
```

All existing rows receive `user_id = 'legacy'` and remain invisible to Google-authenticated users (who query by email) and to demo users (who query by `'demo'`).

---

## File Layout

### New files

```
auth.ts                                  Auth.js config (Google provider, allowlist)
app/api/auth/[...nextauth]/route.ts      OAuth callback handler (required by Auth.js)
db/migrate-add-user-id.sql               One-time schema migration
app/demo/
  layout.tsx                             Demo shell: banner + nav, no auth check
  page.tsx                               Chat UI (userId = 'demo')
  history/page.tsx                       History (userId = 'demo')
  analytics/page.tsx                     Analytics (userId = 'demo')
  actions.ts                             All server actions hardcoded to userId = 'demo',
                                         including deleteExpense
```

### Modified files

```
proxy.ts                         Replace HMAC check with Auth.js middleware export;
                                 add /api/auth to PUBLIC_PATHS to prevent redirect loop
lib/db.ts                        All query/mutation functions gain userId: string param;
                                 getSetting made internal-only (only called via getCurrency)
app/actions.ts                   Session guard on ALL actions:
                                   processInput, deleteExpense, getRecentForDisplay,
                                   updateCurrency, logout → signOut()
                                 submitPin removed entirely
app/login/page.tsx               PIN form → Google sign-in button + "Try demo" link;
                                 AccessDenied error state added
app/settings/page.tsx            Remove PIN section; add signed-in account card
                                 (shows Google profile email/photo)
app/page.tsx                     Add Demo link in header
app/fluid/page.tsx               Add Demo link in header
app/fluid/history/
  history-list.tsx               Show Google profile photo in avatar slot
app/recent-list.tsx              deleteExpense import updated (now requires auth)
```

### Deleted files

```
lib/auth.ts                      HMAC token helpers + PIN verify — entirely removed
```

---

## Auth Flow

```
User visits any protected route
  → proxy.ts (Auth.js middleware) checks session cookie
  → No valid session → redirect to /login
  → User clicks "Sign in with Google"
  → Auth.js redirects to Google OAuth consent screen
  → Google redirects back to /api/auth/callback/google
  → Auth.js signIn callback checks email against ALLOWED_EMAILS
      → Not on list → redirect to /login?error=AccessDenied
      → On list → session cookie issued → redirect to /
```

---

## Demo Flow

```
User visits /demo (or clicks Demo link)
  → proxy.ts skips auth (/demo and /api/auth are in PUBLIC_PATHS)
  → Demo layout renders banner: "Demo mode — data is shared"
  → All server actions use userId = 'demo'
  → User can log/query/delete expenses — changes visible to all demo visitors
  → "Sign in with Google →" link in banner takes user to /login
```

---

## Component Design

### `auth.ts` (root)

```ts
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    signIn({ user }) {
      const allowed = (process.env.ALLOWED_EMAILS ?? "")
        .split(",")
        .map(e => e.trim().toLowerCase());
      return allowed.includes(user.email?.toLowerCase() ?? "");
    },
  },
});
```

### `proxy.ts`

```ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

// /api/auth/* must be public so OAuth callback isn't intercepted before the
// session cookie is set (would cause a redirect loop).
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

### `app/actions.ts` — session guard pattern (applied to ALL actions)

Actions requiring auth: `processInput`, `deleteExpense`, `getRecentForDisplay`, `updateCurrency`, `logout`.

```ts
export async function processInput(input: string): Promise<ProcessResult> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  const userId = session.user.email;
  // ... rest of function, passing userId to all DB calls
}
```

### `app/demo/actions.ts` — hardcoded userId

Mirrors every action in `app/actions.ts` but with `const userId = 'demo'` hardcoded. No session check. Includes: `processInput`, `deleteExpense`, `getRecentForDisplay`. Does not include `updateCurrency` or `logout` (demo users have no settings and no session to clear).

### `lib/db.ts` — userId threading

`getSetting` is made private (unexported). It is only called internally by `getCurrency(userId)`, which passes the userId through. This prevents callers from accidentally querying settings without a user filter now that the primary key is composite.

### Demo banner (`app/demo/layout.tsx`)

Persistent banner at the very top of every demo page:
> **Demo mode** — data is shared with everyone. [Sign in with Google →]

### Login page

- Google "Sign in with Google" button (styled with Google brand colours)
- Below the card: "Just browsing? [Try the demo →]" link to `/demo`
- Error state for `AccessDenied`: "Your Google account isn't on the access list."

### Settings page

- Remove the PIN section (references `APP_PIN` which no longer exists)
- Add a read-only "Account" card showing the signed-in Google email and profile photo

---

## `lib/db.ts` Functions — userId Param Addition

| Function | Change |
|---|---|
| `insertExpense` | Add `userId` to input object, insert into column |
| `deleteExpense` | Add `userId` param, add `AND user_id = $N` to WHERE (prevents cross-user deletes) |
| `fetchExpenses` | Add `userId` param, filter by user |
| `getRecent` | Add `userId` param, filter by user |
| `getDistinctCategories` | Add `userId` param, filter by user |
| `getStats` | Add `userId` param, filter by user — queries `expenses` directly, will aggregate across all users without this fix |
| `getExpensesByMonth` | Add `userId` param, filter by user |
| `getAnalytics` | Add `userId` param, filter by user — queries `expenses` directly, will leak cross-user data on `/fluid/analytics` without this fix |
| `getCurrency` | Add `userId` param, pass through to `getSetting` |
| `setSetting` | Add `userId` param, insert/update by (key, user_id); **update `ON CONFLICT (key)` → `ON CONFLICT (key, user_id)`** to match new composite primary key — old clause causes a Postgres error after migration |
| `getSetting` | Add `userId` param; make unexported (internal use only) |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Google account not on allowlist | Redirect to `/login?error=AccessDenied`; show "not on access list" message |
| Session missing in server action | Throw `"Not authenticated"` (middleware prevents this in practice) |
| `AUTH_SECRET` not set | Auth.js throws at startup |
| `ALLOWED_EMAILS` empty | All Google accounts rejected (fail-safe) |
| Cross-user delete attempt | `deleteExpense` WHERE includes `user_id` — wrong-user rows simply aren't found |

---

## What Is Not Changed

- All expense parsing, summarisation, and AI logic (`lib/parser.ts`, `lib/summarizer.ts`)
- Both UI themes (original `/` and Fluid Ledger `/fluid`)
- Vercel deployment config

---

## Setup Steps for Developer

1. Install the new dependency: `npm install next-auth@beta`
2. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application). **No additional Google APIs need to be enabled** — profile name and photo are returned directly in the OAuth token.
3. Add authorised redirect URIs:
   - `https://<your-vercel-domain>/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (local dev)
4. Copy Client ID → `AUTH_GOOGLE_ID`, Client Secret → `AUTH_GOOGLE_SECRET`
5. Generate `AUTH_SECRET` with `openssl rand -base64 32` — the output is already ≥32 characters; do not shorten it manually
6. Set `ALLOWED_EMAILS` to comma-separated list of permitted Gmail addresses (spaces around commas are fine)
7. Set `CURRENCY` env var (e.g. `INR`) — the demo chat uses `getCurrency('demo')` which falls back to this env var if no per-demo currency row exists in settings
8. Run `db/migrate-add-user-id.sql` against Neon
9. Deploy — remove `APP_PIN` and `SESSION_SECRET` from Vercel env vars
