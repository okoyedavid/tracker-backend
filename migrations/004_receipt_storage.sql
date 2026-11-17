CREATE TABLE receipt_tracker.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL CHECK (length(trim(name))>0),
  description varchar(500) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES receipt_tracker.users(id)
);
CREATE UNIQUE INDEX categories_name_ci ON receipt_tracker.categories(lower(name));

CREATE TABLE receipt_tracker.scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES receipt_tracker.users(id),
  category_id uuid NOT NULL REFERENCES receipt_tracker.categories(id),
  request_id uuid NOT NULL,
  request_hash text NOT NULL,
  vendor varchar(200) NOT NULL,
  receipt_date date NOT NULL,
  total numeric(14,2) NOT NULL CHECK (total>=0),
  tax numeric(14,2) CHECK (tax>=0),
  discount numeric(14,2) CHECK (discount>=0),
  currency varchar(3),
  response jsonb NOT NULL,
  reviewed_ocr jsonb NOT NULL,
  image_url text NOT NULL,
  image_public_id text NOT NULL UNIQUE,
  reconciled boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(created_by,request_id)
);
CREATE INDEX scans_owner_created ON receipt_tracker.scans(created_by,created_at DESC);
CREATE TABLE receipt_tracker.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES receipt_tracker.scans(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL CHECK (length(trim(title))>0),
  cost numeric(14,2) NOT NULL CHECK (cost>=0),
  expense_date date NOT NULL,
  position integer NOT NULL,
  source_line_indexes integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scan_id,position)
);
CREATE INDEX expenses_scan_idx ON receipt_tracker.expenses(scan_id);

UPDATE receipt_tracker.roles SET permissions=array_append(permissions,'categories:view'),updated_at=now()
WHERE key IN ('supervisor','worker') AND NOT ('categories:view'=ANY(permissions));
UPDATE receipt_tracker.roles SET permissions=array_append(permissions,'categories:create'),updated_at=now()
WHERE key='supervisor' AND NOT ('categories:create'=ANY(permissions));
