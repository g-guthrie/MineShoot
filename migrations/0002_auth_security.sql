ALTER TABLE users ADD COLUMN pin_hash TEXT;
ALTER TABLE users ADD COLUMN pin_salt TEXT;
ALTER TABLE users ADD COLUMN pin_algo TEXT;

CREATE TABLE IF NOT EXISTS login_attempts (
  username_norm TEXT NOT NULL,
  ip_bucket TEXT NOT NULL,
  fail_count INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL DEFAULT 0,
  blocked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (username_norm, ip_bucket)
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_blocked_until ON login_attempts(blocked_until);
