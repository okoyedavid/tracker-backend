CREATE TABLE receipt_tracker.report_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL CHECK(extract(day FROM month)=1),
  currency varchar(11) NOT NULL CHECK(currency ~ '^[A-Z]{3}$' OR currency='UNSPECIFIED'),
  budget numeric(14,2) CHECK(budget>0),
  approval_limit numeric(14,2) NOT NULL DEFAULT 500 CHECK(approval_limit>=0),
  created_by uuid NOT NULL REFERENCES receipt_tracker.users(id),
  updated_by uuid NOT NULL REFERENCES receipt_tracker.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month,currency)
);
INSERT INTO receipt_tracker.report_months(month,currency,budget,approval_limit,created_by,updated_by)
SELECT b.month,b.currency,b.amount,COALESCE(s.approval_limit,500),b.created_by,b.updated_by
FROM receipt_tracker.monthly_budgets b LEFT JOIN receipt_tracker.spending_settings s ON s.currency=b.currency;
INSERT INTO receipt_tracker.report_months(month,currency,approval_limit,created_by,updated_by)
SELECT DISTINCT ON (date_trunc('month',s.receipt_date),COALESCE(s.currency,'UNSPECIFIED'))
  date_trunc('month',s.receipt_date)::date,COALESCE(s.currency,'UNSPECIFIED'),COALESCE(settings.approval_limit,500),s.created_by,s.created_by
FROM receipt_tracker.scans s LEFT JOIN receipt_tracker.spending_settings settings ON settings.currency=s.currency
ORDER BY date_trunc('month',s.receipt_date),COALESCE(s.currency,'UNSPECIFIED'),s.created_at,s.id
ON CONFLICT(month,currency) DO NOTHING;
CREATE INDEX report_months_order ON receipt_tracker.report_months(month DESC,currency);
CREATE INDEX scans_reporting_period ON receipt_tracker.scans(currency,receipt_date) WHERE review_status='approved';
