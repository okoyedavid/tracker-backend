ALTER TABLE receipt_tracker.scans
  ADD COLUMN review_status text NOT NULL DEFAULT 'approved' CHECK (review_status IN ('approved','pending')),
  ADD COLUMN review_reasons jsonb NOT NULL DEFAULT '[]';
CREATE INDEX scans_pending ON receipt_tracker.scans(created_at) WHERE review_status='pending';
CREATE TABLE receipt_tracker.scan_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL UNIQUE REFERENCES receipt_tracker.scans(id),
  approved_by uuid NOT NULL REFERENCES receipt_tracker.users(id),
  reason varchar(1000) NOT NULL CHECK(length(trim(reason))>=5),
  original_total numeric(14,2) NOT NULL,
  confirmed_total numeric(14,2) NOT NULL CHECK(confirmed_total>0),
  review_reasons jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE receipt_tracker.monthly_budgets (
  month date NOT NULL CHECK (extract(day FROM month)=1),
  currency varchar(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  amount numeric(14,2) NOT NULL CHECK(amount>0),
  created_by uuid NOT NULL REFERENCES receipt_tracker.users(id),
  updated_by uuid NOT NULL REFERENCES receipt_tracker.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(month,currency)
);
CREATE TABLE receipt_tracker.spending_settings (
  currency varchar(3) PRIMARY KEY CHECK(currency ~ '^[A-Z]{3}$'),
  approval_limit numeric(14,2) NOT NULL DEFAULT 500 CHECK(approval_limit>=0),
  updated_by uuid NOT NULL REFERENCES receipt_tracker.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
UPDATE receipt_tracker.roles SET permissions=array_append(permissions,'budgets:manage'),updated_at=now()
WHERE key='supervisor' AND type='system' AND NOT ('budgets:manage'=ANY(permissions));
