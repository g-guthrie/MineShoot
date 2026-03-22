export function createFakeEnv() {
  const state = {
    users: new Map(),
    sessions: new Map(),
    profiles: new Map(),
    parties: new Map(),
    partyMembers: new Map(),
    privateRooms: new Map(),
    privateRoomState: new Map(),
    privateRoomMembers: new Map(),
    publicMatchAssignments: new Map(),
    publicMatchQueueLocks: new Map(),
    privateRoomInvites: new Map(),
    partyPresence: new Map(),
    friendships: new Map(),
    partyInvites: new Map(),
    partyDirectInvites: new Map(),
    schema: {
      party_presence: ['actor_id', 'display_name', 'last_menu_seen_at', 'activity_state', 'last_seen_at'],
      private_room_state: ['room_id', 'room_mode', 'room_phase', 'host_actor_id', 'invite_locked', 'created_at', 'updated_at']
    }
  };

  function normalize(sql) {
    return String(sql || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function clone(row) {
    return row ? JSON.parse(JSON.stringify(row)) : row;
  }

  class Prepared {
    constructor(sql, args) {
      this.sql = sql;
      this.args = args || [];
    }

    bind(...args) {
      return new Prepared(this.sql, args);
    }

    async run() {
      executeRun(this.sql, this.args);
      return { success: true };
    }

    async first() {
      return clone(executeFirst(this.sql, this.args));
    }

    async all() {
      return { results: clone(executeAll(this.sql, this.args)) || [] };
    }
  }

  function executeRun(sql, args) {
    const q = normalize(sql);
    if (q.startsWith('create table') || q.startsWith('create index')) return;
    if (q.startsWith('alter table party_presence add column activity_state')) {
      if (state.schema.party_presence.indexOf('activity_state') === -1) state.schema.party_presence.push('activity_state');
      return;
    }
    if (q.startsWith('alter table party_presence add column last_seen_at')) {
      if (state.schema.party_presence.indexOf('last_seen_at') === -1) state.schema.party_presence.push('last_seen_at');
      return;
    }
    if (q.startsWith('alter table private_room_state add column team_count')) {
      if (state.schema.private_room_state.indexOf('team_count') === -1) state.schema.private_room_state.push('team_count');
      state.privateRoomState.forEach(function (roomState) {
        if (roomState && roomState.team_count === undefined) roomState.team_count = 2;
      });
      return;
    }
    if (q.startsWith('alter table private_room_state add column invite_locked')) {
      if (state.schema.private_room_state.indexOf('invite_locked') === -1) state.schema.private_room_state.splice(4, 0, 'invite_locked');
      state.privateRoomState.forEach(function (roomState) {
        if (roomState && roomState.invite_locked === undefined) roomState.invite_locked = 1;
      });
      return;
    }
    if (q.indexOf('insert into parties') >= 0) {
      state.parties.set(String(args[0]), {
        id: String(args[0]),
        leader_id: String(args[1]),
        join_locked: Number(args[2]) || 0,
        created_at: Number(args[3]) || 0,
        updated_at: Number(args[4]) || 0
      });
      return;
    }
    if (q.indexOf('update parties set leader_id') >= 0) {
      const party = state.parties.get(String(args[0]));
      if (party) {
        party.leader_id = String(args[1] || '');
        party.updated_at = Number(args[2]) || party.updated_at;
      }
      return;
    }
    if (q.indexOf('update parties set updated_at') >= 0) {
      const party = state.parties.get(String(args[0]));
      if (party) party.updated_at = Number(args[1]) || party.updated_at;
      return;
    }
    if (q.indexOf('update parties set join_locked') >= 0) {
      const party = state.parties.get(String(args[0]));
      if (party) {
        party.join_locked = Number(args[1]) || 0;
        party.updated_at = Number(args[2]) || party.updated_at;
      }
      return;
    }
    if (q.indexOf('delete from parties where id') >= 0) {
      state.parties.delete(String(args[0]));
      return;
    }
    if (q.indexOf('insert into party_members') >= 0) {
      state.partyMembers.set(String(args[0]), {
        member_id: String(args[0]),
        party_id: String(args[1]),
        display_name: String(args[2]),
        joined_at: Number(args[3]) || 0
      });
      return;
    }
    if (q.indexOf('update party_members set display_name') >= 0) {
      const member = state.partyMembers.get(String(args[0]));
      if (member) member.display_name = String(args[1] || member.display_name);
      return;
    }
    if (q.indexOf('delete from party_members where member_id') >= 0) {
      state.partyMembers.delete(String(args[0]));
      return;
    }
    if (q.indexOf('insert into users') >= 0) {
      state.users.set(String(args[0]), {
        id: String(args[0]),
        username: String(args[1]),
        username_norm: String(args[2]),
        pin_plain: String(args[3]),
        created_at: Number(args[4]) || 0
      });
      return;
    }
    if (q.indexOf('insert into profiles') >= 0) {
      if (!state.profiles.has(String(args[0]))) {
        state.profiles.set(String(args[0]), {
          user_id: String(args[0]),
          display_name: null,
          profile_enabled: 0,
          headline: null,
          bio: null,
          class_id: String(args[1] || 'abilities'),
          kills: 0,
          deaths: 0,
          damage_done: 0,
          damage_taken: 0,
          updated_at: 0
        });
      }
      return;
    }
    if (q.indexOf('insert into sessions') >= 0) {
      state.sessions.set(String(args[0]), {
        id: String(args[0]),
        user_id: String(args[1]),
        expires_at: Number(args[2]) || 0,
        created_at: Number(args[3]) || 0,
        last_seen_at: Number(args[4]) || 0
      });
      return;
    }
    if (q.indexOf('update sessions set last_seen_at') >= 0) {
      const session = state.sessions.get(String(args[0]));
      if (session) session.last_seen_at = Number(args[1]) || session.last_seen_at;
      return;
    }
    if (q.indexOf('delete from sessions where id') >= 0) {
      state.sessions.delete(String(args[0]));
      return;
    }
    if (q.indexOf('insert into party_presence') >= 0) {
      state.partyPresence.set(String(args[0]), {
        actor_id: String(args[0]),
        display_name: String(args[1]),
        last_menu_seen_at: Number(args[2]) || 0,
        activity_state: String(args[3] || 'menu'),
        last_seen_at: Number(args[4]) || 0
      });
      return;
    }
    if (q.indexOf('delete from party_presence where actor_id') >= 0) {
      state.partyPresence.delete(String(args[0]));
      return;
    }
    if (q.indexOf('insert into private_rooms') >= 0) {
      state.privateRooms.set(String(args[0]), {
        room_id: String(args[0]),
        room_code: String(args[1]),
        creator_user_id: String(args[2] || ''),
        created_at: Number(args[3]) || 0,
        last_used_at: Number(args[3]) || 0
      });
      return;
    }
    if (q.indexOf('update private_rooms set last_used_at') >= 0) {
      const room = state.privateRooms.get(String(args[0]));
      if (room) room.last_used_at = Number(args[1]) || room.last_used_at;
      return;
    }
    if (q.indexOf('insert into private_room_state') >= 0) {
      state.privateRoomState.set(String(args[0]), {
        room_id: String(args[0]),
        room_mode: String(args[1] || 'ffa'),
        room_phase: String(args[2] || 'lobby'),
        host_actor_id: String(args[3] || ''),
        invite_locked: Number(args[4]) ? 1 : 0,
        created_at: Number(args[5]) || 0,
        updated_at: Number(args[5]) || 0,
        team_count: Number(args[6]) || 2
      });
      return;
    }
    if (q.indexOf('update private_room_state set room_mode') >= 0) {
      const roomState = state.privateRoomState.get(String(args[0]));
      if (roomState) {
        roomState.room_mode = String(args[1] || roomState.room_mode);
        roomState.room_phase = String(args[2] || roomState.room_phase);
        roomState.host_actor_id = String(args[3] || roomState.host_actor_id);
        roomState.invite_locked = Number(args[4]) ? 1 : 0;
        roomState.updated_at = Number(args[5]) || roomState.updated_at;
        if (args.length > 6) roomState.team_count = Number(args[6]) || roomState.team_count || 2;
      }
      return;
    }
    if (q.indexOf('insert into public_match_assignments') >= 0) {
      state.publicMatchAssignments.set(String(args[0]), {
        actor_id: String(args[0]),
        room_id: String(args[1]),
        game_mode: String(args[2] || 'ffa'),
        assigned_by_actor_id: String(args[3] || ''),
        assigned_at: Number(args[4]) || 0
      });
      return;
    }
    if (q.indexOf('delete from public_match_assignments where actor_id') >= 0) {
      state.publicMatchAssignments.delete(String(args[0]));
      return;
    }
    if (q.indexOf('insert into public_match_queue_locks') >= 0) {
      const key = String(args[0]);
      if (state.publicMatchQueueLocks.has(key)) {
        throw new Error('Constraint violation: public_match_queue_locks.queue_key');
      }
      state.publicMatchQueueLocks.set(key, {
        queue_key: key,
        actor_id: String(args[1]),
        party_id: String(args[2] || ''),
        party_size: Number(args[3]) || 1,
        game_mode: String(args[4] || 'ffa'),
        lock_expires_at: Number(args[5]) || 0,
        created_at: Number(args[6]) || 0,
        updated_at: Number(args[7]) || 0
      });
      return;
    }
    if (q.indexOf('delete from public_match_queue_locks where queue_key') >= 0) {
      state.publicMatchQueueLocks.delete(String(args[0]));
      return;
    }
    if (q.indexOf('insert into private_room_invites') >= 0) {
      state.privateRoomInvites.set(String(args[0]), {
        invitee_actor_id: String(args[0]),
        room_id: String(args[1]),
        inviter_actor_id: String(args[2]),
        created_at: Number(args[3]) || 0
      });
      return;
    }
    if (q.indexOf('delete from private_room_invites where invitee_actor_id = ?1 or inviter_actor_id = ?1') >= 0) {
      const actorId = String(args[0]);
      state.privateRoomInvites.forEach(function (invite, key) {
        if (invite.invitee_actor_id === actorId || invite.inviter_actor_id === actorId) {
          state.privateRoomInvites.delete(String(key));
        }
      });
      return;
    }
    if (q.indexOf('delete from private_room_invites where room_id') >= 0) {
      const roomId = String(args[0]);
      state.privateRoomInvites.forEach(function (invite, key) {
        if (invite.room_id === roomId) {
          state.privateRoomInvites.delete(String(key));
        }
      });
      return;
    }
    if (q.indexOf('delete from private_room_invites where invitee_actor_id') >= 0) {
      state.privateRoomInvites.delete(String(args[0]));
      return;
    }
    if (q.indexOf('insert into private_room_members') >= 0) {
      state.privateRoomMembers.set(String(args[0]), {
        actor_id: String(args[0]),
        room_id: String(args[1]),
        display_name: String(args[2]),
        team_id: String(args[3] || 'alpha'),
        joined_at: Number(args[4]) || 0
      });
      return;
    }
    if (q.indexOf('delete from private_room_members where actor_id') >= 0) {
      state.privateRoomMembers.delete(String(args[0]));
      return;
    }
    if (q.indexOf('delete from private_room_members where room_id') >= 0) {
      const roomId = String(args[0]);
      state.privateRoomMembers.forEach(function (member, key) {
        if (String(member.room_id || '') === roomId) {
          state.privateRoomMembers.delete(String(key));
        }
      });
      return;
    }
    if (q.indexOf('delete from private_room_state where room_id') >= 0) {
      state.privateRoomState.delete(String(args[0]));
      return;
    }
    if (q.indexOf('delete from private_rooms where room_id') >= 0) {
      state.privateRooms.delete(String(args[0]));
      return;
    }
    if (q.indexOf('update private_room_members set team_id') >= 0) {
      const member = state.privateRoomMembers.get(String(args[0]));
      if (member) member.team_id = String(args[1] || member.team_id);
      return;
    }
    if (q.indexOf('insert into friendships') >= 0) {
      state.friendships.set(String(args[0]) + '|' + String(args[1]), {
        user_id: String(args[0]),
        friend_user_id: String(args[1]),
        created_at: Number(args[2]) || 0
      });
      return;
    }
    if (q.indexOf('delete from friendships where user_id = ?1 and friend_user_id = ?2') >= 0) {
      state.friendships.delete(String(args[0]) + '|' + String(args[1]));
      return;
    }
    if (q.indexOf('insert into party_invites') >= 0) {
      state.partyInvites.set(String(args[0]) + '|' + String(args[1]), {
        inviter_user_id: String(args[0]),
        invitee_user_id: String(args[1]),
        created_at: Number(args[2]) || 0
      });
      return;
    }
    if (q.indexOf('delete from party_invites where inviter_user_id') >= 0) {
      state.partyInvites.delete(String(args[0]) + '|' + String(args[1]));
      return;
    }
    if (q.indexOf('insert into party_direct_invites') >= 0) {
      state.partyDirectInvites.set(String(args[0]) + '|' + String(args[1]), {
        inviter_actor_id: String(args[0]),
        invitee_actor_id: String(args[1]),
        created_at: Number(args[2]) || 0
      });
      return;
    }
    if (q.indexOf('delete from party_direct_invites where inviter_actor_id = ?1 and invitee_actor_id = ?2') >= 0) {
      state.partyDirectInvites.delete(String(args[0]) + '|' + String(args[1]));
      return;
    }
    if (q.indexOf('delete from party_direct_invites where (inviter_actor_id = ?1 and invitee_actor_id = ?2) or (inviter_actor_id = ?2 and invitee_actor_id = ?1)') >= 0) {
      state.partyDirectInvites.delete(String(args[0]) + '|' + String(args[1]));
      state.partyDirectInvites.delete(String(args[1]) + '|' + String(args[0]));
      return;
    }
    throw new Error('Unhandled run SQL: ' + sql);
  }

  function executeFirst(sql, args) {
    const q = normalize(sql);
    if (q.indexOf('select id, username, pin_plain from users where username_norm') >= 0) {
      var matchUser = null;
      state.users.forEach(function (user) {
        if (user.username_norm === String(args[0])) matchUser = user;
      });
      return matchUser || null;
    }
    if (q.indexOf('select class_id, display_name, profile_enabled, kills, deaths, damage_done, damage_taken from profiles where user_id') >= 0) {
      return state.profiles.get(String(args[0])) || null;
    }
    if (q.indexOf('select s.id as session_id, s.user_id, s.expires_at') >= 0) {
      const session = state.sessions.get(String(args[0]));
      if (!session) return null;
      const user = state.users.get(String(session.user_id));
      if (!user) return null;
      const profile = state.profiles.get(String(session.user_id)) || {};
        return {
          session_id: session.id,
          user_id: session.user_id,
          expires_at: session.expires_at,
          last_seen_at: session.last_seen_at || 0,
          username: user.username,
          class_id: profile.class_id || 'abilities',
        display_name: profile.display_name || null,
        profile_enabled: profile.profile_enabled || 0,
        kills: profile.kills || 0,
        deaths: profile.deaths || 0,
        damage_done: profile.damage_done || 0,
        damage_taken: profile.damage_taken || 0
      };
    }
    if (q.indexOf('select u.id, u.username, p.display_name from users u left join profiles p on p.user_id = u.id where u.id') >= 0) {
      const user = state.users.get(String(args[0]));
      if (!user) return null;
      const profile = state.profiles.get(String(args[0])) || {};
      return {
        id: user.id,
        username: user.username,
        display_name: profile.display_name || null
      };
    }
    if (q.indexOf('select u.id, u.username, p.display_name, pp.activity_state, pp.last_seen_at, pm.party_id, parties.leader_id, parties.join_locked from users u') >= 0) {
      const user = state.users.get(String(args[0]));
      if (!user) return null;
      const profile = state.profiles.get(String(args[0])) || {};
      const presence = state.partyPresence.get(String(args[0])) || {};
      const member = state.partyMembers.get(String(args[0])) || {};
      const party = member.party_id ? state.parties.get(String(member.party_id)) : null;
      return {
        id: user.id,
        username: user.username,
        display_name: profile.display_name || null,
        activity_state: presence.activity_state || null,
        last_seen_at: presence.last_seen_at || 0,
        party_id: member.party_id || null,
        leader_id: party ? party.leader_id : null,
        join_locked: party ? party.join_locked : 0
      };
    }
    if (q.indexOf('select actor_id, display_name, activity_state, last_seen_at from party_presence where actor_id') >= 0) {
      return state.partyPresence.get(String(args[0])) || null;
    }
    if (q.indexOf('select u.id, u.username from users u where u.id') >= 0) {
      return state.users.get(String(args[0])) || null;
    }
    if (q.indexOf('select p.id, p.leader_id, p.join_locked') >= 0) {
      const member = state.partyMembers.get(String(args[0]));
      if (!member) return null;
      const party = state.parties.get(String(member.party_id));
      return party ? {
        id: party.id,
        leader_id: party.leader_id,
        join_locked: party.join_locked,
        created_at: party.created_at,
        updated_at: party.updated_at
      } : null;
    }
    if (q.indexOf('select count(*) as total from party_members') >= 0) {
      var total = 0;
      state.partyMembers.forEach(function (member) {
        if (member.party_id === String(args[0])) total += 1;
      });
      return { total: total };
    }
    if (q.indexOf('select member_id from party_members where party_id') >= 0) {
      const members = [];
      state.partyMembers.forEach(function (member) {
        if (member.party_id === String(args[0])) members.push(member);
      });
      members.sort(function (a, b) {
        if (a.joined_at !== b.joined_at) return a.joined_at - b.joined_at;
        return a.member_id.localeCompare(b.member_id);
      });
      return members.length ? { member_id: members[0].member_id } : null;
    }
    if (q.indexOf('select room_id, room_mode, room_phase, host_actor_id, invite_locked') >= 0) {
      return state.privateRoomState.get(String(args[0])) || null;
    }
    if (q.indexOf('select actor_id, room_id, game_mode, assigned_by_actor_id, assigned_at from public_match_assignments') >= 0) {
      return state.publicMatchAssignments.get(String(args[0])) || null;
    }
    if (q.indexOf('select queue_key, actor_id, party_id, party_size, game_mode, lock_expires_at, created_at, updated_at from public_match_queue_locks where queue_key') >= 0) {
      return state.publicMatchQueueLocks.get(String(args[0])) || null;
    }
    if (q.indexOf('select invitee_actor_id, room_id, inviter_actor_id, created_at from private_room_invites where invitee_actor_id') >= 0) {
      return state.privateRoomInvites.get(String(args[0])) || null;
    }
    if (q.indexOf('select actor_id, room_id, display_name, team_id, joined_at from private_room_members where actor_id') >= 0) {
      return state.privateRoomMembers.get(String(args[0])) || null;
    }
    if (q.indexOf('select room_id, room_code, creator_user_id') >= 0) {
      return state.privateRooms.get(String(args[0])) || null;
    }
    throw new Error('Unhandled first SQL: ' + sql);
  }

  function executeAll(sql, args) {
    const q = normalize(sql);
    if (q.indexOf('pragma table_info(party_presence)') >= 0) {
      return state.schema.party_presence.map(function (name) { return { name: name }; });
    }
    if (q.indexOf('pragma table_info(private_room_state)') >= 0) {
      return state.schema.private_room_state.map(function (name) { return { name: name }; });
    }
    if (q.indexOf('select member_id, display_name, joined_at from party_members where party_id') >= 0) {
      const leaderId = String(args[1] || '');
      const members = [];
      state.partyMembers.forEach(function (member) {
        if (member.party_id === String(args[0])) members.push(member);
      });
      members.sort(function (a, b) {
        if (a.member_id === leaderId && b.member_id !== leaderId) return -1;
        if (b.member_id === leaderId && a.member_id !== leaderId) return 1;
        if (a.joined_at !== b.joined_at) return a.joined_at - b.joined_at;
        return a.member_id.localeCompare(b.member_id);
      });
      return members;
    }
    if (q.indexOf('select pm.member_id, pm.display_name from party_members pm join party_presence pp') >= 0) {
      const out = [];
      state.partyMembers.forEach(function (member) {
        if (member.party_id !== String(args[0])) return;
        const presence = state.partyPresence.get(member.member_id);
        if (!presence) return;
        if (presence.activity_state !== String(args[1])) return;
        if (Number(presence.last_seen_at || 0) < Number(args[2] || 0)) return;
        out.push({ member_id: member.member_id, display_name: member.display_name, joined_at: member.joined_at });
      });
      const selfId = String(args[3] || '');
      out.sort(function (a, b) {
        if (a.member_id === selfId && b.member_id !== selfId) return -1;
        if (b.member_id === selfId && a.member_id !== selfId) return 1;
        if (a.joined_at !== b.joined_at) return a.joined_at - b.joined_at;
        return a.member_id.localeCompare(b.member_id);
      });
      return out.map(function (row) {
        return { member_id: row.member_id, display_name: row.display_name };
      });
    }
    if (q.indexOf('select actor_id, room_id, display_name, team_id, joined_at from private_room_members where room_id') >= 0) {
      const out = [];
      state.privateRoomMembers.forEach(function (member) {
        if (member.room_id === String(args[0])) out.push(member);
      });
      out.sort(function (a, b) {
        if (a.joined_at !== b.joined_at) return a.joined_at - b.joined_at;
        return a.actor_id.localeCompare(b.actor_id);
      });
      return out;
    }
    if (q.indexOf('select friend_user_id from friendships where user_id') >= 0) {
      const out = [];
      state.friendships.forEach(function (row) {
        if (row.user_id === String(args[0])) out.push({ friend_user_id: row.friend_user_id });
      });
      out.sort(function (a, b) { return a.friend_user_id.localeCompare(b.friend_user_id); });
      return out;
    }
    if (q.indexOf('select user_id from friendships where friend_user_id') >= 0) {
      const out = [];
      state.friendships.forEach(function (row) {
        if (row.friend_user_id === String(args[0])) out.push({ user_id: row.user_id });
      });
      out.sort(function (a, b) { return a.user_id.localeCompare(b.user_id); });
      return out;
    }
    if (q.indexOf('select inviter_user_id from party_invites where invitee_user_id') >= 0) {
      const out = [];
      state.partyInvites.forEach(function (row) {
        if (row.invitee_user_id === String(args[0])) out.push({ inviter_user_id: row.inviter_user_id, created_at: row.created_at });
      });
      out.sort(function (a, b) {
        if (a.created_at !== b.created_at) return b.created_at - a.created_at;
        return a.inviter_user_id.localeCompare(b.inviter_user_id);
      });
      return out.map(function (row) { return { inviter_user_id: row.inviter_user_id }; });
    }
    if (q.indexOf('select invitee_user_id from party_invites where inviter_user_id') >= 0) {
      const out = [];
      state.partyInvites.forEach(function (row) {
        if (row.inviter_user_id === String(args[0])) out.push({ invitee_user_id: row.invitee_user_id, created_at: row.created_at });
      });
      out.sort(function (a, b) {
        if (a.created_at !== b.created_at) return b.created_at - a.created_at;
        return a.invitee_user_id.localeCompare(b.invitee_user_id);
      });
      return out.map(function (row) { return { invitee_user_id: row.invitee_user_id }; });
    }
    if (q.indexOf('select inviter_actor_id, created_at from party_direct_invites where invitee_actor_id') >= 0) {
      const out = [];
      state.partyDirectInvites.forEach(function (row) {
        if (row.invitee_actor_id === String(args[0])) out.push({ inviter_actor_id: row.inviter_actor_id, created_at: row.created_at });
      });
      out.sort(function (a, b) {
        if (a.created_at !== b.created_at) return b.created_at - a.created_at;
        return a.inviter_actor_id.localeCompare(b.inviter_actor_id);
      });
      return out;
    }
    if (q.indexOf('select invitee_actor_id, created_at from party_direct_invites where inviter_actor_id') >= 0) {
      const out = [];
      state.partyDirectInvites.forEach(function (row) {
        if (row.inviter_actor_id === String(args[0])) out.push({ invitee_actor_id: row.invitee_actor_id, created_at: row.created_at });
      });
      out.sort(function (a, b) {
        if (a.created_at !== b.created_at) return b.created_at - a.created_at;
        return a.invitee_actor_id.localeCompare(b.invitee_actor_id);
      });
      return out;
    }
    if (q.indexOf('select invitee_actor_id, room_id, created_at from private_room_invites where inviter_actor_id') >= 0) {
      const out = [];
      state.privateRoomInvites.forEach(function (row) {
        if (row.inviter_actor_id === String(args[0])) {
          out.push({
            invitee_actor_id: row.invitee_actor_id,
            room_id: row.room_id,
            created_at: row.created_at
          });
        }
      });
      out.sort(function (a, b) {
        if (a.created_at !== b.created_at) return b.created_at - a.created_at;
        return a.invitee_actor_id.localeCompare(b.invitee_actor_id);
      });
      return out;
    }
    throw new Error('Unhandled all SQL: ' + sql);
  }

  const DB = {
    prepare(sql) {
      return new Prepared(sql, []);
    },
    async batch(statements) {
      for (let i = 0; i < statements.length; i++) {
        await statements[i].run();
      }
      return [];
    }
  };

  const GLOBAL_ARENA = {
    idFromName(name) {
      return String(name || '');
    },
    get() {
      return {
        async fetch() {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      };
    }
  };

  const PRIVATE_ROOM_LOBBY_HUB = {
    idFromName(name) {
      return String(name || '');
    },
    get() {
      return {
        async fetch() {
          return new Response(null, { status: 204 });
        }
      };
    }
  };

  return { DB, GLOBAL_ARENA, PRIVATE_ROOM_LOBBY_HUB, __state: state };
}
