CREATE TABLE IF NOT EXISTS public_match_queue_locks (
  queue_key TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  party_id TEXT NOT NULL DEFAULT '',
  party_size INTEGER NOT NULL,
  game_mode TEXT NOT NULL,
  lock_expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_match_queue_locks_party_id ON public_match_queue_locks(party_id);
CREATE INDEX IF NOT EXISTS idx_public_match_queue_locks_actor_id ON public_match_queue_locks(actor_id);
