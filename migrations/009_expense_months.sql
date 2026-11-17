-- A month is derived from the expense date, which the save flow inherits from its scan.
ALTER TABLE receipt_tracker.expenses ADD COLUMN month date
  GENERATED ALWAYS AS (date_trunc('month',expense_date::timestamp)::date) STORED;
CREATE INDEX expenses_month_scan ON receipt_tracker.expenses(month,scan_id);

-- Ensure historical scans also have report periods, including pending scans.
INSERT INTO receipt_tracker.report_months(month,currency,budget,approval_limit,created_by,updated_by)
SELECT DISTINCT ON (date_trunc('month',s.receipt_date))
  date_trunc('month',s.receipt_date)::date,'NGN',NULL,
  COALESCE((SELECT approval_limit FROM receipt_tracker.spending_settings WHERE currency='NGN'),500),s.created_by,s.created_by
FROM receipt_tracker.scans s
ORDER BY date_trunc('month',s.receipt_date),s.created_at,s.id
ON CONFLICT(month) DO NOTHING;
