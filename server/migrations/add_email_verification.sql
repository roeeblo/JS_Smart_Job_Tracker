ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verify_token text,
  ADD COLUMN IF NOT EXISTS verify_expires timestamptz;

CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users(verify_token);
