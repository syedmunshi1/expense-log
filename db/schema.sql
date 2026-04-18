-- Expense tracker schema

CREATE TABLE IF NOT EXISTS expenses (
  id          SERIAL PRIMARY KEY,
  amount      NUMERIC(12, 2)  NOT NULL,
  description TEXT            NOT NULL,
  category    TEXT            NOT NULL,
  date        DATE            NOT NULL,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Simple key/value settings. Currently used only for CURRENCY override.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
