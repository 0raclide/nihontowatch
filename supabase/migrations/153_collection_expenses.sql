-- Expense ledger for collection items
-- Tracks per-item expenses (polish, shipping, shinsa, etc.)

CREATE TABLE IF NOT EXISTS collection_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES collection_items(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES auth.users(id),
  expense_date  DATE,
  category      TEXT NOT NULL,
  description   TEXT,
  amount        NUMERIC NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'JPY',
  vendor        TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for fast per-item lookup
CREATE INDEX IF NOT EXISTS idx_collection_expenses_item_id ON collection_expenses(item_id);
CREATE INDEX IF NOT EXISTS idx_collection_expenses_owner_id ON collection_expenses(owner_id);

-- RLS: owner CRUD + service role bypass (same pattern as collection_items)
ALTER TABLE collection_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own expenses"
  ON collection_expenses FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own expenses"
  ON collection_expenses FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own expenses"
  ON collection_expenses FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own expenses"
  ON collection_expenses FOR DELETE
  USING (auth.uid() = owner_id);

CREATE POLICY "Service role full access to expenses"
  ON collection_expenses FOR ALL
  USING (auth.role() = 'service_role');
