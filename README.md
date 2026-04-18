# Expense Tracker

A personal expense tracker with natural-language input, voice capture, automatic categorization, and natural-language summary queries. Built with Next.js, Neon Postgres, and Claude Haiku. Deployable to Vercel.

## Features

- **Smart input** — one input box for both logging and querying. Type or speak.
- **Natural-language logging** — e.g. `lunch 250`, `spent 340 on auto rickshaw yesterday`, `groceries 1200 at dmart on monday`. The app extracts the amount, description, category, and date.
- **Automatic categorization** — Claude Haiku assigns a category, reusing existing ones aggressively to avoid drift (soft-capped at ~12).
- **Natural-language summaries** — ask questions like `how much did I spend on food this week?` or `total for april`. Get a short prose answer.
- **Voice input** — browser-native (Web Speech API), no audio leaves the device.
- **PIN-gated** — single PIN in an env var; HMAC-signed session cookie, middleware-enforced.
- **Configurable currency** — defaults to INR (`₹`); switch to USD/EUR/GBP/etc. in `/settings`.

## Stack

- Next.js 16 (App Router, Server Actions)
- Neon Postgres (serverless)
- Anthropic Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- Web Speech API
- Tailwind CSS
- Vitest

## Local Setup

1. **Install deps:**
   ```sh
   npm install
   ```
2. **Create a Neon database** at [console.neon.tech](https://console.neon.tech) and copy the connection string.
3. **Create `.env.local`** from the example:
   ```sh
   cp .env.local.example .env.local
   ```
   Fill in:
   - `DATABASE_URL` — Neon connection string
   - `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
   - `APP_PIN` — 4–6 digit PIN
   - `SESSION_SECRET` — any random string (≥ 16 chars)
   - `CURRENCY` — optional, defaults to `INR`
4. **Initialize the schema:**
   ```sh
   npm run db:init
   ```
5. **Run the dev server:**
   ```sh
   npm run dev
   ```
   Open [localhost:3000](http://localhost:3000), enter your PIN, and start logging.

## Tests

```sh
npm test
```

Covers the pure logic in `lib/auth.ts`, `lib/parser.ts` (JSON extraction + normalization), and `lib/currency.ts`. The LLM-calling paths are not mocked end-to-end — they're exercised manually.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it on Vercel.
3. Add the same env vars (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `APP_PIN`, `SESSION_SECRET`, optional `CURRENCY`) in the Vercel project settings.
4. Deploy.
5. Run schema init once against the production DB:
   ```sh
   DATABASE_URL="<prod-url>" npx tsx scripts/db-init.ts
   ```
   (Or connect via Neon's SQL editor and run `db/schema.sql`.)

## Project Layout

```
app/
  page.tsx             # main UI (server component)
  input-console.tsx    # client component: typed + voice input
  actions.ts           # server actions
  login/page.tsx
  settings/page.tsx
  layout.tsx
  globals.css
lib/
  auth.ts              # HMAC session tokens + PIN check (Web Crypto)
  claude.ts            # Anthropic SDK wrapper
  currency.ts          # symbol + formatting helpers
  db.ts                # Neon client + query helpers
  parser.ts            # intent classification + expense extraction
  summarizer.ts        # query rows + question → prose
proxy.ts               # auth gate (Next 16 proxy; was "middleware" in Next 15)
db/schema.sql
scripts/db-init.ts
tests/
```

## Example Usage

- `lunch 250` → logged as Food & Dining, today's date.
- `coffee 80 yesterday` → logged to yesterday's date.
- `spent 340 on auto rickshaw yesterday` → Transport, yesterday.
- `how much did I spend today?` → prose summary.
- `food spending this week` → filtered prose summary.
- `last month` → summary of all expenses for previous calendar month.

## Notes

- The `description` column stores the raw user phrase, so you can re-categorize later if you change categorization rules.
- Categories are freeform strings. On every parse we pass the current distinct category list to Haiku with a prompt to reuse them; occasional drift is possible but the soft cap of ~12 keeps it manageable.
- Voice input uses the browser's built-in speech recognition — works well on Chrome/Safari (desktop & mobile). Firefox falls back to typed input.
- The PIN lives in an env var; rotate it by updating the var and redeploying.
