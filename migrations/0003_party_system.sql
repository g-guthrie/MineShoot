CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  leader_id TEXT NOT NULL,
  join_locked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS party_members (
  member_id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  joined_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_party_members_party_id ON party_members(party_id);
CREATE INDEX IF NOT EXISTS idx_parties_leader_id ON parties(leader_id);
