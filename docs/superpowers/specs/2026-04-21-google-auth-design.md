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

---

## Environment Variables

| Variable | Purpose | New/Changed |
|---|---|---|
| `AUTH_GOOGLE_ID` | Google OAuth client ID | New |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | New |
| `AUTH_SECRET` | Signs session cookies (≥32 chars) | New |
| `ALLOWED_EMAILS` | Comma-separated allowlist e.g. `a@gmail.com,b@gmail.com` | New |
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
  actions.ts                             Server actions hardcoded to userId = 'demo'
```

### Modified files

```
proxy.ts                    Replace HMAC check with Auth.js middleware export
lib/db.ts                   All functions gain userId: string parameter
app/actions.ts              Session guard at top; submitPin removed; logout → signOut()
app/login/page.tsx          PIN form → Google sign-in button + Demo link
app/page.tsx                Add Demo link in header
app/fluid/page.tsx          Add Demo link in header
app/fluid/history/
  history-list.tsx          Show Google profile photo in avatar slot
```

### Deleted files

```
lib/auth.ts                 HMAC token helpers + PIN verify — entirely removed
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
  → proxy.ts skips auth (PUBLIC_PATHS includes /demo)
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
export { auth as proxy } from "@/auth";
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)" ] };
```

### `app/actions.ts` — session guard pattern

```ts
export async function processInput(input: string): Promise<ProcessResult> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  const userId = session.user.email;
  // ... rest of function, passing userId to all DB calls
}
```

### `lib/db.ts` — function signature change (example)

```ts
// Before
export async function getRecent(limit = 10): Promise<Expense[]>

// After
export async function getRecent(userId: string, limit = 10): Promise<Expense[]>
```

### Demo banner (`app/demo/layout.tsx`)

Persistent banner at the very top of every demo page:
> **Demo mode** — data is shared with everyone. [Sign in with Google →]

### Login page

- Google "Sign in with Google" button (styled with Google brand colours)
- Below the card: "Just browsing? [Try the demo →]" link to `/demo`
- Error state for `AccessDenied`: "Your Google account isn't on the access list."

---

## `lib/db.ts` Functions — userId Param Addition

| Function | Change |
|---|---|
| `insertExpense` | Add `userId` to input object, insert into column |
| `deleteExpense` | Add `userId` param, add `AND user_id = $N` to WHERE |
| `fetchExpenses` | Add `userId` param, filter by user |
| `getRecent` | Add `userId` param, filter by user |
| `getDistinctCategories` | Add `userId` param, filter by user |
| `getStats` | Add `userId` param, filter by user |
| `getExpensesByMonth` | Add `userId` param, filter by user |
| `getAnalytics` | Add `userId` param, filter by user |
| `getCurrency` | Add `userId` param, filter by user |
| `setSetting` | Add `userId` param, insert/update by (key, user_id) |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Google account not on allowlist | Redirect to `/login?error=AccessDenied`; show message |
| Session missing in server action | Throw `"Not authenticated"` (middleware should prevent this) |
| `AUTH_SECRET` not set | Auth.js throws at startup |
| `ALLOWED_EMAILS` empty | All Google accounts rejected (fail-safe) |

---

## What Is Not Changed

- All expense parsing, summarisation, and AI logic (`lib/parser.ts`, `lib/summariser.ts`)
- Both UI themes (original `/` and Fluid Ledger `/fluid`)
- The Settings page (currency change) — just the underlying action gains a userId guard
- Vercel deployment config

---

## Setup Steps for Developer

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application)
2. Add authorised redirect URI: `https://<your-vercel-domain>/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local dev)
3. Copy Client ID → `AUTH_GOOGLE_ID`, Client Secret → `AUTH_GOOGLE_SECRET`
4. Generate `AUTH_SECRET`: `openssl rand -base64 32`
5. Set `ALLOWED_EMAILS` to comma-separated list of permitted Gmail addresses
6. Run `db/migrate-add-user-id.sql` against Neon
7. Deploy — remove `APP_PIN` and `SESSION_SECRET` from Vercel env vars
