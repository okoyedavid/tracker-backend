-- Port of Aurex users, roles, user sessions, auth sessions and verification tokens.
-- Isolated schema: does not modify existing application tables in public.
CREATE SCHEMA IF NOT EXISTS receipt_tracker;

CREATE TABLE IF NOT EXISTS receipt_tracker.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL,
  key varchar(60) NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('system','custom')),
  permissions text[] NOT NULL DEFAULT '{}',
  denied_permissions text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (denied_permissions <@ permissions)
);

INSERT INTO receipt_tracker.roles (name,key,type,permissions) VALUES
 ('Supervisor','supervisor','system',ARRAY['receipts:scan','expenses:create','expenses:view','expenses:view_own','expenses:delete','expenses:approve','reports:view','roles:view','roles:manage','roles:assign','users:view','users:manage']),
 ('Worker','worker','system',ARRAY['receipts:scan','expenses:create','expenses:view_own'])
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS receipt_tracker.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL CHECK (length(name) >= 2),
  email text NOT NULL,
  password_hash text,
  google_id text UNIQUE,
  username text,
  avatar text,
  bio varchar(250),
  email_verified_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  role_id uuid NOT NULL REFERENCES receipt_tracker.roles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_ci ON receipt_tracker.users(lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci ON receipt_tracker.users(lower(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS receipt_tracker.user_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES receipt_tracker.users(id) ON DELETE CASCADE,
  current_auth_session_id uuid,
  user_agent text,
  ip_address text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON receipt_tracker.user_sessions(user_id);

CREATE TABLE IF NOT EXISTS receipt_tracker.auth_sessions (
  id uuid PRIMARY KEY,
  user_session_id uuid NOT NULL REFERENCES receipt_tracker.user_sessions(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by_session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_session_idx ON receipt_tracker.auth_sessions(user_session_id);

CREATE TABLE IF NOT EXISTS receipt_tracker.verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES receipt_tracker.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email','reset_password','change_email')),
  token_hash text NOT NULL,
  target_email text,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,purpose)
);
