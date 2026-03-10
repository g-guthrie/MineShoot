import { getSessionFromRequest } from './auth.js';
import { json, normalizeOpaqueId } from './transport.js';
import { handleJoinParty } from './party.js';

const PRESENCE_STALE_WINDOW_SEC = 15;

let ensureSocialTablesPromise = null;

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

async function ensureSocialTables(env) {
  if (!env || !env.DB) return;
  if (!ensureSocialTablesPromise) {
    ensureSocialTablesPromise = env.DB.batch([
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS friendships (
           user_id TEXT NOT NULL,
           friend_user_id TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (user_id, friend_user_id)
         )`
      ),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_friendships_friend_user_id ON friendships(friend_user_id)'
      ),
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS party_invites (
           inviter_user_id TEXT NOT NULL,
           invitee_user_id TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (inviter_user_id, invitee_user_id)
         )`
      ),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_party_invites_invitee_user_id ON party_invites(invitee_user_id)'
      )
    ]).catch((err) => {
      ensureSocialTablesPromise = null;
      throw err;
    });
  }
  await ensureSocialTablesPromise;
}

async function loadFriendIds(env, userId) {
  await ensureSocialTables(env);
  const result = await env.DB.prepare(
    `SELECT friend_user_id
     FROM friendships
     WHERE user_id = ?1
     ORDER BY friend_user_id ASC`
  ).bind(userId).all();
  if (!result || !Array.isArray(result.results)) return [];
  return result.results.map((row) => String(row.friend_user_id || '')).filter(Boolean);
}

async function loadInviteIds(env, userId, direction) {
  await ensureSocialTables(env);
  if (direction === 'incoming') {
    const result = await env.DB.prepare(
      `SELECT inviter_user_id
       FROM party_invites
       WHERE invitee_user_id = ?1
       ORDER BY created_at DESC, inviter_user_id ASC`
    ).bind(userId).all();
    if (!result || !Array.isArray(result.results)) return [];
    return result.results.map((row) => String(row.inviter_user_id || '')).filter(Boolean);
  }
  const result = await env.DB.prepare(
    `SELECT invitee_user_id
     FROM party_invites
     WHERE inviter_user_id = ?1
     ORDER BY created_at DESC, invitee_user_id ASC`
  ).bind(userId).all();
  if (!result || !Array.isArray(result.results)) return [];
  return result.results.map((row) => String(row.invitee_user_id || '')).filter(Boolean);
}

async function loadPartyMetaByMember(env, memberId) {
  return env.DB.prepare(
    `SELECT p.id, p.leader_id, p.join_locked, p.created_at, p.updated_at
     FROM party_members pm
     JOIN parties p ON p.id = pm.party_id
     WHERE pm.member_id = ?1`
  ).bind(memberId).first();
}

async function loadFriendProfile(env, userId) {
  return env.DB.prepare(
    `SELECT u.id, u.username, p.display_name,
            pp.activity_state, pp.last_seen_at,
            pm.party_id, parties.leader_id, parties.join_locked
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN party_presence pp ON pp.actor_id = u.id
     LEFT JOIN party_members pm ON pm.member_id = u.id
     LEFT JOIN parties parties ON parties.id = pm.party_id
     WHERE u.id = ?1`
  ).bind(userId).first();
}

async function loadSelfSummary(env, userId) {
  return env.DB.prepare(
    `SELECT u.id, u.username, p.display_name
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = ?1`
  ).bind(userId).first();
}

function isOnlineRow(row) {
  if (!row) return false;
  return Number(row.last_seen_at || 0) >= (nowSec() - PRESENCE_STALE_WINDOW_SEC);
}

function activityLabel(row) {
  const next = String(row && row.activity_state || 'offline').trim().toLowerCase();
  if (next === 'menu') return 'menu';
  if (next === 'private_room_lobby') return 'private_room_lobby';
  if (next === 'in_match') return 'in_match';
  return 'offline';
}

async function buildFriendsPayload(env, session) {
  await ensureSocialTables(env);
  const ownUserId = String(session.userId || '');
  const ownProfile = await loadSelfSummary(env, ownUserId);
  const ownParty = await loadPartyMetaByMember(env, ownUserId);
  const friendIds = await loadFriendIds(env, ownUserId);
  const reverseFriendIds = await env.DB.prepare(
    `SELECT user_id
     FROM friendships
     WHERE friend_user_id = ?1
     ORDER BY user_id ASC`
  ).bind(ownUserId).all().catch(() => ({ results: [] }));
  const reverseSet = new Set(
    reverseFriendIds && Array.isArray(reverseFriendIds.results)
      ? reverseFriendIds.results.map((row) => String(row.user_id || '')).filter(Boolean)
      : []
  );
  const incomingInviteSet = new Set(await loadInviteIds(env, ownUserId, 'incoming'));
  const outgoingInviteSet = new Set(await loadInviteIds(env, ownUserId, 'outgoing'));
  const ownPartyId = String(ownParty && ownParty.id || '');

  const friends = [];
  for (let i = 0; i < friendIds.length; i++) {
    const friendId = friendIds[i];
    const row = await loadFriendProfile(env, friendId);
    if (!row || !row.id) continue;
    const mutual = reverseSet.has(friendId);
    const online = isOnlineRow(row);
    const partyId = String(row.party_id || '');
    const locked = !!Number(row.join_locked || 0);
    const sameParty = !!ownPartyId && ownPartyId === partyId;
    const incomingInvite = incomingInviteSet.has(friendId);
    const outgoingInvite = outgoingInviteSet.has(friendId);
    friends.push({
      userId: String(row.id || ''),
      username: String(row.username || row.id || ''),
      displayName: String(row.display_name || row.username || row.id || 'PLAYER'),
      isMutual: mutual,
      online,
      activityState: online ? activityLabel(row) : 'offline',
      partyId,
      partyLeaderId: String(row.leader_id || ''),
      joinLocked: locked,
      sameParty,
      incomingInvite,
      outgoingInvite,
      canInvite: String(row.id || '') !== ownUserId,
      canJoin: mutual && online && !!partyId && !sameParty && !locked
    });
  }

  friends.sort((a, b) => {
    const aScore = (a.incomingInvite ? 8 : 0) + (a.canJoin ? 4 : 0) + (a.online ? 2 : 0) + (a.isMutual ? 1 : 0);
    const bScore = (b.incomingInvite ? 8 : 0) + (b.canJoin ? 4 : 0) + (b.online ? 2 : 0) + (b.isMutual ? 1 : 0);
    if (bScore !== aScore) return bScore - aScore;
    return String(a.displayName || '').localeCompare(String(b.displayName || ''));
  });

  return {
    self: {
      userId: ownUserId,
      username: String(ownProfile && ownProfile.username || session.username || ownUserId || ''),
      displayName: String(ownProfile && ownProfile.display_name || session.displayName || session.username || ownUserId || ''),
      friendCount: friends.length,
      incomingInviteCount: friends.filter((friend) => friend.incomingInvite).length
    },
    friends
  };
}

async function ensureTargetUser(env, targetUserId) {
  const targetId = normalizeOpaqueId(targetUserId);
  return env.DB.prepare(
    `SELECT u.id, u.username
     FROM users u
     WHERE u.id = ?1`
  ).bind(targetId).first();
}

async function addFriend(env, session, targetUserId) {
  const ownUserId = normalizeOpaqueId(session.userId || '');
  const targetId = normalizeOpaqueId(targetUserId);
  if (!targetId || targetId === ownUserId) {
    return { status: 400, body: { ok: false, error: 'Pick another signed-in player.' } };
  }
  const target = await ensureTargetUser(env, targetId);
  if (!target || !target.id) {
    return { status: 404, body: { ok: false, error: 'Only signed-in players can be added as friends.' } };
  }
  await ensureSocialTables(env);
  await env.DB.prepare(
    `INSERT INTO friendships (user_id, friend_user_id, created_at)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(user_id, friend_user_id) DO NOTHING`
  ).bind(ownUserId, targetId, nowSec()).run();
  return {
    status: 200,
    body: {
      ok: true,
      friends: await buildFriendsPayload(env, session)
    }
  };
}

async function inviteFriend(env, session, targetUserId) {
  const ownUserId = normalizeOpaqueId(session.userId || '');
  const targetId = normalizeOpaqueId(targetUserId);
  const ownFriends = new Set((await loadFriendIds(env, ownUserId)).map((id) => normalizeOpaqueId(id)));
  if (!ownFriends.has(targetId)) {
    return { status: 403, body: { ok: false, error: 'Add this player as a friend before sending invites.' } };
  }
  await ensureSocialTables(env);
  await env.DB.prepare(
    `INSERT INTO party_invites (inviter_user_id, invitee_user_id, created_at)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(inviter_user_id, invitee_user_id) DO UPDATE SET
       created_at = excluded.created_at`
  ).bind(ownUserId, targetId, nowSec()).run();
  return {
    status: 200,
    body: {
      ok: true,
      friends: await buildFriendsPayload(env, session)
    }
  };
}

async function joinFriendParty(env, session, targetUserId, allowLocked) {
  const ownUserId = normalizeOpaqueId(session.userId || '');
  const targetId = normalizeOpaqueId(targetUserId);
  const ownFriends = new Set((await loadFriendIds(env, ownUserId)).map((id) => normalizeOpaqueId(id)));
  const reverseIds = new Set(await env.DB.prepare(
    `SELECT user_id
     FROM friendships
     WHERE friend_user_id = ?1`
  ).bind(ownUserId).all().then((result) => (
    result && Array.isArray(result.results)
      ? result.results.map((row) => normalizeOpaqueId(row.user_id || '')).filter(Boolean)
      : []
  )).catch(() => []));
  const incomingInviteSet = new Set((await loadInviteIds(env, ownUserId, 'incoming')).map((id) => normalizeOpaqueId(id)));
  if (!ownFriends.has(targetId)) {
    return { status: 403, body: { ok: false, error: 'Add this player as a friend first.' } };
  }
  if (!allowLocked && !reverseIds.has(targetId)) {
    return { status: 403, body: { ok: false, error: 'Direct join requires mutual friendship.' } };
  }
  if (allowLocked && !incomingInviteSet.has(targetId)) {
    return { status: 404, body: { ok: false, error: 'Invite not found.' } };
  }
  const target = await loadFriendProfile(env, targetId);
  if (!target || !target.id) {
    return { status: 404, body: { ok: false, error: 'Friend not found.' } };
  }
  if (!allowLocked && !isOnlineRow(target)) {
    return { status: 409, body: { ok: false, error: 'That friend is offline.' } };
  }
  const actor = {
    id: ownUserId,
    displayName: String(session.displayName || session.username || ownUserId || 'PLAYER'),
    username: String(session.username || ownUserId || 'PLAYER'),
    isAccount: true
  };
  const joined = await handleJoinParty(env, actor, targetId, { allowLocked: !!allowLocked });
  if (joined.status >= 400) {
    return joined;
  }
  if (allowLocked) {
    await env.DB.prepare(
      'DELETE FROM party_invites WHERE inviter_user_id = ?1 AND invitee_user_id = ?2'
    ).bind(targetId, ownUserId).run();
  }
  return {
    status: 200,
    body: {
      ok: true,
      state: joined.body && joined.body.state ? joined.body.state : null,
      friends: await buildFriendsPayload(env, session)
    }
  };
}

async function dismissInvite(env, session, targetUserId) {
  const inviterUserId = normalizeOpaqueId(targetUserId || '');
  const inviteeUserId = normalizeOpaqueId(session.userId || '');
  await ensureSocialTables(env);
  await env.DB.prepare(
    'DELETE FROM party_invites WHERE inviter_user_id = ?1 AND invitee_user_id = ?2'
  ).bind(inviterUserId, inviteeUserId).run();
  return {
    status: 200,
    body: {
      ok: true,
      friends: await buildFriendsPayload(env, session)
    }
  };
}

export async function handleFriends(env, request) {
  const session = await getSessionFromRequest(env, request);
  if (!session) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  if (request.method === 'GET') {
    return json({
      ok: true,
      friends: await buildFriendsPayload(env, session)
    });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const action = String(body.action || '').trim().toLowerCase();
  let result = null;
  if (action === 'add') {
    result = await addFriend(env, session, body.targetUserId || body.targetId || '');
  } else if (action === 'invite') {
    result = await inviteFriend(env, session, body.targetUserId || '');
  } else if (action === 'join') {
    result = await joinFriendParty(env, session, body.targetUserId || '', false);
  } else if (action === 'accept_invite') {
    result = await joinFriendParty(env, session, body.targetUserId || '', true);
  } else if (action === 'dismiss_invite') {
    result = await dismissInvite(env, session, body.targetUserId || '');
  } else {
    return json({ ok: false, error: 'Unsupported friend action.' }, 400);
  }

  return json(result.body, result.status);
}
