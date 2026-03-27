import { ensureProfileRow, getSessionFromRequest } from './auth.js';
import { json, normalizeUsername } from './transport.js';

const DISPLAY_NAME_MAX = 32;
const HEADLINE_MAX = 80;
const BIO_MAX = 500;

function profileResponse(row, fallbackUsername = '') {
  return {
    enabled: !!(row && row.profile_enabled),
    username: row && row.username ? row.username : fallbackUsername,
    displayName: row && row.display_name ? row.display_name : null,
    headline: row && row.headline ? row.headline : null,
    bio: row && row.bio ? row.bio : null,
    classId: row && row.class_id ? row.class_id : 'ffa',
    kills: row && typeof row.kills === 'number' ? row.kills : 0,
    deaths: row && typeof row.deaths === 'number' ? row.deaths : 0,
    damageDone: row && typeof row.damage_done === 'number' ? row.damage_done : 0,
    damageTaken: row && typeof row.damage_taken === 'number' ? row.damage_taken : 0,
    updatedAt: row && row.updated_at ? new Date(Number(row.updated_at) * 1000).toISOString() : null
  };
}

function normalizeOptionalText(value, maxLen, fieldName) {
  if (value === undefined) return { provided: false, value: null };
  if (value === null) return { provided: true, value: null };
  const trimmed = String(value).trim();
  if (!trimmed) return { provided: true, value: null };
  if (trimmed.length > maxLen) {
    throw new Error(fieldName + ' must be ' + maxLen + ' characters or fewer.');
  }
  return { provided: true, value: trimmed };
}

function normalizeEnabled(value) {
  if (value === undefined) return { provided: false, value: false };
  if (typeof value !== 'boolean') {
    throw new Error('enabled must be a boolean.');
  }
  return { provided: true, value };
}

async function loadOwnProfile(env, userId) {
  return env.DB.prepare(
    `SELECT u.username, p.user_id, p.display_name, p.profile_enabled, p.headline, p.bio,
            p.class_id, p.kills, p.deaths, p.damage_done, p.damage_taken, p.updated_at
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = ?1`
  ).bind(userId).first();
}

export async function handleProfileMe(env, request) {
  const session = await getSessionFromRequest(env, request);
  if (!session) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  await ensureProfileRow(env, session.userId, session.classId);
  const profile = await loadOwnProfile(env, session.userId);

  return json({
    ok: true,
    profile: profileResponse(profile, session.username)
  });
}

export async function handleProfileUpdate(env, request) {
  const session = await getSessionFromRequest(env, request);
  if (!session) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  let displayName;
  let headline;
  let bio;
  let enabled;
  try {
    displayName = normalizeOptionalText(body.displayName, DISPLAY_NAME_MAX, 'displayName');
    headline = normalizeOptionalText(body.headline, HEADLINE_MAX, 'headline');
    bio = normalizeOptionalText(body.bio, BIO_MAX, 'bio');
    enabled = normalizeEnabled(body.enabled);
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : 'Invalid profile payload.' }, 400);
  }

  if (!displayName.provided && !headline.provided && !bio.provided && !enabled.provided) {
    return json({ ok: false, error: 'No profile fields were provided.' }, 400);
  }

  await ensureProfileRow(env, session.userId, session.classId);
  const current = await loadOwnProfile(env, session.userId);
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `UPDATE profiles
     SET display_name = ?2,
         profile_enabled = ?3,
         headline = ?4,
         bio = ?5,
         updated_at = ?6
     WHERE user_id = ?1`
  ).bind(
    session.userId,
    displayName.provided ? displayName.value : (current && current.display_name ? current.display_name : null),
    enabled.provided ? (enabled.value ? 1 : 0) : Number(current && current.profile_enabled ? 1 : 0),
    headline.provided ? headline.value : (current && current.headline ? current.headline : null),
    bio.provided ? bio.value : (current && current.bio ? current.bio : null),
    now
  ).run();

  const updated = await loadOwnProfile(env, session.userId);
  return json({
    ok: true,
    profile: profileResponse(updated, session.username)
  });
}

export async function handlePublicProfile(env, request) {
  const url = new URL(request.url);
  const usernameRaw = String(url.searchParams.get('username') || '').trim();
  const usernameNorm = normalizeUsername(usernameRaw);

  if (!usernameNorm) {
    return json({ ok: false, error: 'username is required.' }, 400);
  }

  const row = await env.DB.prepare(
    `SELECT u.username, p.display_name, p.profile_enabled, p.headline, p.bio,
            p.class_id, p.kills, p.deaths, p.damage_done, p.damage_taken, p.updated_at
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.username_norm = ?1
       AND p.profile_enabled = 1`
  ).bind(usernameNorm).first();

  if (!row) {
    return json({ ok: false, error: 'Profile not found.' }, 404);
  }

  return json({
    ok: true,
    profile: profileResponse(row, row.username)
  });
}
