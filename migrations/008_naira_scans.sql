-- The application records all amounts in naira. Preserve receipt values and snapshots.
UPDATE receipt_tracker.scans SET currency='NGN' WHERE currency IS DISTINCT FROM 'NGN';
ALTER TABLE receipt_tracker.scans ALTER COLUMN currency SET DEFAULT 'NGN', ALTER COLUMN currency SET NOT NULL;
ALTER TABLE receipt_tracker.scans ADD CONSTRAINT scans_naira_only CHECK(currency='NGN');
UPDATE receipt_tracker.report_months SET currency='NGN' WHERE currency<>'NGN';
ALTER TABLE receipt_tracker.report_months ADD CONSTRAINT report_months_naira_only CHECK(currency='NGN');
ALTER TABLE receipt_tracker.report_months DROP CONSTRAINT IF EXISTS report_months_month_currency_key;
ALTER TABLE receipt_tracker.report_months ADD CONSTRAINT report_months_month_key UNIQUE(month);
UPDATE receipt_tracker.monthly_budgets SET currency='NGN' WHERE currency<>'NGN';
ALTER TABLE receipt_tracker.monthly_budgets ADD CONSTRAINT monthly_budgets_naira_only CHECK(currency='NGN');
UPDATE receipt_tracker.spending_settings SET currency='NGN' WHERE currency<>'NGN';
ALTER TABLE receipt_tracker.spending_settings ADD CONSTRAINT spending_settings_naira_only CHECK(currency='NGN');
UPDATE receipt_tracker.expenses e SET expense_date=s.receipt_date FROM receipt_tracker.scans s
WHERE e.scan_id=s.id AND e.expense_date<>s.receipt_date;
