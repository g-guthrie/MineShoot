CREATE TABLE IF NOT EXISTS friendships (
  user_id TEXT NOT NULL,
  friend_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_friend_user_id ON friendships(friend_user_id);

CREATE TABLE IF NOT EXISTS party_invites (
  inviter_user_id TEXT NOT NULL,
  invitee_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (inviter_user_id, invitee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_party_invites_invitee_user_id ON party_invites(invitee_user_id);
