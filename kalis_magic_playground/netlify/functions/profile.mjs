import { requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';

function clean(value) {
  return String(value ?? '').trim();
}

export function escapeIlikePattern(value) {
  return String(value ?? '').replace(/[\\%_]/g, '\\$&');
}

export function validateNickname(value) {
  const nickname = clean(value);
  if (nickname.length < 2 || nickname.length > 24) {
    return { ok: false, error: 'invalid_nickname' };
  }
  return { ok: true, nickname };
}

export function shapeProfile(row) {
  return {
    nickname: row.nickname,
    role: row.role,
    nicknameSet: Boolean(row.nickname_set)
  };
}

async function loadProfile(supabase, viewer) {
  const { data, error } = await supabase
    .from('profiles')
    .select('nickname,role,nickname_set')
    .eq('user_id', viewer.userId)
    .maybeSingle();
  if (error) throw error;
  return data || {
    nickname: viewer.nickname,
    role: viewer.role,
    nickname_set: false
  };
}

async function nicknameTaken(supabase, viewer, nickname) {
  // Preflight lower(nickname) match; the unique index still handles races.
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,nickname')
    .ilike('nickname', escapeIlikePattern(nickname))
    .neq('user_id', viewer.userId);
  if (error) throw error;
  return (data || []).some((row) => clean(row.nickname).toLocaleLowerCase() === nickname.toLocaleLowerCase());
}

async function getProfile(supabase, viewer) {
  const profile = await loadProfile(supabase, viewer);
  return json(200, shapeProfile(profile));
}

async function updateProfile(event, supabase, viewer) {
  let payload;
  try {
    payload = readJsonBody(event);
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  const validation = validateNickname(payload.nickname);
  if (!validation.ok) return json(400, { error: validation.error });

  let exists;
  try {
    exists = await nicknameTaken(supabase, viewer, validation.nickname);
  } catch {
    return json(500, { error: 'db_error' });
  }
  if (exists) return json(409, { error: 'nickname_taken' });

  const { data, error } = await supabase
    .from('profiles')
    .update({
      nickname: validation.nickname,
      nickname_set: true
    })
    .eq('user_id', viewer.userId)
    .select('nickname,nickname_set')
    .maybeSingle();
  if (error && error.code === '23505') return json(409, { error: 'nickname_taken' });
  if (error) return json(500, { error: 'db_error' });

  return json(200, {
    nickname: data?.nickname || validation.nickname,
    nicknameSet: true
  });
}

export async function handler(event) {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return json(405, { error: 'method_not_allowed' });
  }

  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  const supabase = getSupabaseAdmin();
  try {
    if (event.httpMethod === 'GET') return await getProfile(supabase, viewer);
    return await updateProfile(event, supabase, viewer);
  } catch {
    return json(500, { error: 'db_error' });
  }
}
