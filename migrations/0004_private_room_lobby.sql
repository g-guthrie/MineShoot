CREATE TABLE IF NOT EXISTS private_room_state (
  room_id TEXT PRIMARY KEY,
  room_mode TEXT NOT NULL DEFAULT 'ffa',
  room_phase TEXT NOT NULL DEFAULT 'lobby',
  host_actor_id TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS private_room_members (
  actor_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  team_id TEXT NOT NULL DEFAULT 'alpha',
  joined_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_private_room_members_room_id ON private_room_members(room_id);

CREATE TABLE IF NOT EXISTS party_presence (
  actor_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  last_menu_seen_at INTEGER NOT NULL,
  activity_state TEXT NOT NULL DEFAULT 'menu',
  last_seen_at INTEGER NOT NULL DEFAULT 0
);
