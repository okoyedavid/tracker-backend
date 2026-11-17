ALTER TABLE receipt_tracker.users
  ADD COLUMN IF NOT EXISTS delivery_email text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES receipt_tracker.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN receipt_tracker.users.delivery_email IS
  'Actual recipient for provisioned account credentials and password reset; login email remains unchanged.';
