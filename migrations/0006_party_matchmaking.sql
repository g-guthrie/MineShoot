CREATE TABLE IF NOT EXISTS public_match_assignments (
  actor_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  game_mode TEXT NOT NULL,
  assigned_by_actor_id TEXT NOT NULL DEFAULT '',
  assigned_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_match_assignments_room_id ON public_match_assignments(room_id);

CREATE TABLE IF NOT EXISTS private_room_invites (
  invitee_actor_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  inviter_actor_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_private_room_invites_room_id ON private_room_invites(room_id);
CREATE INDEX IF NOT EXISTS idx_private_room_invites_inviter_actor_id ON private_room_invites(inviter_actor_id);

ALTER TABLE private_room_state ADD COLUMN invite_locked INTEGER NOT NULL DEFAULT 1;
