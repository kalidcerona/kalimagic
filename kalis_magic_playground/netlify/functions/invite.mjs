import { randomBytes } from 'node:crypto';
import { requireViewer } from './_lib/auth.mjs';
import { json, requireMethod } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';

async function findInvite(supabase, userId) {
  const { data, error } = await supabase
    .from('invites')
    .select('code')
    .eq('inviter_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function redemptionCount(supabase, code) {
  const { count, error } = await supabase
    .from('invite_redemptions')
    .select('new_user_id', { count: 'exact', head: true })
    .eq('invite_code', code);
  if (error) throw error;
  return count || 0;
}

async function shapeInvite(supabase, row) {
  if (!row) return null;
  return {
    code: row.code,
    redemptionCount: await redemptionCount(supabase, row.code)
  };
}

export async function getInvite(supabase, userId) {
  return json(200, {
    invite: await shapeInvite(supabase, await findInvite(supabase, userId))
  });
}

export async function createInvite(supabase, userId, createCode = () => randomBytes(9).toString('base64url')) {
  const existing = await findInvite(supabase, userId);
  if (existing) {
    return json(200, { invite: await shapeInvite(supabase, existing) });
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = createCode();
    const { data, error } = await supabase
      .from('invites')
      .insert({ code, inviter_user_id: userId })
      .select('code')
      .maybeSingle();

    if (!error && data) {
      return json(201, { invite: { code: data.code, redemptionCount: 0 } });
    }
    if (!error) throw new Error('invite_insert_missing');
    if (error.code !== '23505') throw error;

    const concurrent = await findInvite(supabase, userId);
    if (concurrent) {
      return json(200, { invite: await shapeInvite(supabase, concurrent) });
    }
  }

  throw new Error('invite_code_generation_conflict');
}

export async function handler(event) {
  try {
    requireMethod(event, ['GET', 'POST']);
  } catch {
    return json(405, { error: 'method_not_allowed' });
  }

  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (event.httpMethod === 'GET') return await getInvite(supabase, viewer.userId);
    return await createInvite(supabase, viewer.userId);
  } catch {
    return json(500, { error: 'db_error' });
  }
}
