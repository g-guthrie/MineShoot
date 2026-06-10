-- Durable (D1-backed) login failure tracking. The in-memory limiter in
-- rate-limit.js is per-isolate and resets whenever a new isolate spins up;
-- this table provides a cross-isolate lockout for the login route.
CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_window ON login_attempts(window_started_at);
