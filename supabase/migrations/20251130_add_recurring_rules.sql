/*
  # Add Recurring Transactions Support

  ## Overview
  Adds recurring transaction automation capabilities to support automatic transaction creation
  for subscriptions, loan EMIs, and other repetitive payments.

  ## Tables Created
  - `recurring_rules`: Define patterns for automatic recurring transactions

  ## Features
  - Support for multiple frequencies (daily, weekly, biweekly, monthly, quarterly, yearly)
  - Optional auto-creation of transactions on scheduled dates
  - Track next occurrence for efficient scheduling
  - Date range support for limited-duration recurring payments

  ## Security
  - Row Level Security (RLS) enabled
  - Users can only access their own recurring rules
*/

CREATE TABLE IF NOT EXISTS recurring_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  merchant text NOT NULL,
  amount numeric(15, 2) NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  start_date date NOT NULL,
  end_date date,
  next_occurrence date NOT NULL,
  is_active boolean DEFAULT true,
  auto_create boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring rules"
  ON recurring_rules FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own recurring rules"
  ON recurring_rules FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_recurring_rules_user_active ON recurring_rules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_next_occurrence ON recurring_rules(next_occurrence);
