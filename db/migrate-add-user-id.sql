-- Add user ownership to expenses (existing rows get 'legacy')
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy';

-- Add user ownership to settings (currency becomes per-user)
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy';

-- Drop old single-column primary key, replace with composite
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE settings ADD PRIMARY KEY (key, user_id);

-- Performance indexes for per-user queries
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user  ON settings(user_id);
