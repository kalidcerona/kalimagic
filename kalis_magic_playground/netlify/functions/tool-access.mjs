import { bearerToken, requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { signGateCookie } from './_lib/tool-gate.mjs';

const COOKIE_MAX_AGE = 7_776_000;
const REQUESTABLE_TOOLS = new Set(['stopwatch', 'calc']);

// 순수 분기 판정: 조회한 행 + 요청한 도구 → 무엇을 할지.
export function decideAccess(row, tool) {
  if (!row) return 'create';
  if (row.status !== 'approved') return 'pending';
  return row.tool === tool || row.tool === 'all' ? 'allow' : 'deny';
}

export function preferUserIdAccess(userIdAccess, emailAccess) {
  return userIdAccess || emailAccess || null;
}

export function needsEmailSync(rowEmail, authEmail) {
  return String(rowEmail ?? '').trim().toLowerCase() !==
    String(authEmail ?? '').trim().toLowerCase();
}

export function duplicateInheritancePatch(currentRow, duplicateRow) {
  if (currentRow?.status !== 'pending' || duplicateRow?.status !== 'approved') {
    return null;
  }
  return {
    status: duplicateRow.status,
    tool: duplicateRow.tool,
    lifetime: duplicateRow.lifetime
  };
}

function escapeIlikePattern(value) {
  return String(value ?? '').replace(/[\\%_]/g, '\\$&');
}

async function findAccess(supabase, userId, email) {
  const columns = 'id,user_id,email,tool,lifetime,status,display_name,nickname';
  const { data: userIdAccess, error: userIdError } = await supabase
    .from('tool_access')
    .select(columns)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (userIdError) return { data: null, error: userIdError };

  let emailAccess = null;
  if (!userIdAccess) {
    const result = await supabase
      .from('tool_access')
      .select(columns)
      .ilike('email', escapeIlikePattern(email))
      .limit(1)
      .maybeSingle();
    if (result.error) return { data: null, error: result.error };
    emailAccess = result.data;
  }

  return { data: preferUserIdAccess(userIdAccess, emailAccess), error: null };
}

// 로그인은 이메일 동기화 실패 때문에 막히면 안 된다. 충돌 병합까지 모두 best effort로 처리한다.
async function syncAccessIdentity(supabase, access, userId, email) {
  const identityPatch = {};
  if (!access.user_id) identityPatch.user_id = userId;
  if (needsEmailSync(access.email, email)) identityPatch.email = email;
  if (!Object.keys(identityPatch).length) return;

  let updateResult;
  try {
    updateResult = await supabase
      .from('tool_access')
      .update(identityPatch)
      .eq('id', access.id);
  } catch {
    return;
  }
  if (!updateResult.error) {
    Object.assign(access, identityPatch);
    return;
  }

  // 이메일 변경 시의 23505만 같은 이메일을 가진 중복 행으로 해석한다.
  if (updateResult.error.code !== '23505' || !identityPatch.email) return;

  let duplicateResult;
  try {
    duplicateResult = await supabase
      .from('tool_access')
      .select('id,status,tool,lifetime')
      .ilike('email', escapeIlikePattern(email))
      .neq('id', access.id)
      .limit(1)
      .maybeSingle();
  } catch {
    return;
  }
  const duplicate = duplicateResult.data;
  if (duplicateResult.error || !duplicate) return;

  const inheritancePatch = duplicateInheritancePatch(access, duplicate);
  if (inheritancePatch) {
    let inheritanceResult;
    try {
      inheritanceResult = await supabase
        .from('tool_access')
        .update(inheritancePatch)
        .eq('id', access.id);
    } catch {
      return;
    }
    if (inheritanceResult.error) return;
    Object.assign(access, inheritancePatch);
  }

  let deleteResult;
  try {
    deleteResult = await supabase
      .from('tool_access')
      .delete()
      .eq('id', duplicate.id);
  } catch {
    return;
  }
  if (deleteResult.error) return;

  try {
    const retryResult = await supabase
      .from('tool_access')
      .update(identityPatch)
      .eq('id', access.id);
    if (!retryResult.error) Object.assign(access, identityPatch);
  } catch {
    // 다음 로그인 때 다시 동기화할 수 있으므로 요청은 계속 진행한다.
  }
}

// 이메일·구글 이름·사이트 닉네임을 모은다. 이름/닉네임은 없어도 실패하지 않는다.
async function identity(event, viewer, supabase) {
  let email = viewer.email || null;
  let displayName = null;

  const token = bearerToken(event);
  if (token) {
    try {
      const { data } = await supabase.auth.getUser(token);
      const user = data?.user;
      if (user) {
        email = email || user.email || null;
        displayName = user.user_metadata?.full_name || user.user_metadata?.name || null;
      }
    } catch {
      // 이름 조회 실패는 무시한다.
    }
  }

  return {
    email: email ? String(email).trim().toLowerCase() : null,
    displayName: displayName ? String(displayName).trim() || null : null,
    nickname: viewer.nickname ? String(viewer.nickname).trim() || null : null
  };
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  let viewer;
  try {
    viewer = await requireViewer(event);
  } catch {
    return json(401, { error: 'auth_required' });
  }

  let payload;
  try {
    payload = readJsonBody(event);
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  const tool = String(payload?.tool || '').trim();
  if (!REQUESTABLE_TOOLS.has(tool)) {
    return json(400, { error: 'invalid_tool' });
  }

  const secret = process.env.TOOL_GATE_SECRET;
  if (!secret) return json(500, { error: 'gate_not_configured' });

  try {
    const supabase = getSupabaseAdmin();
    const { email, displayName, nickname } = await identity(event, viewer, supabase);
    if (!email) return json(401, { error: 'auth_required' });

    const { data: access, error } = await findAccess(supabase, viewer.userId, email);
    if (error) return json(500, { error: 'db_error' });

    if (access) {
      await syncAccessIdentity(supabase, access, viewer.userId, email);
    }

    const decision = decideAccess(access, tool);

    if (decision === 'create') {
      const { error: insertError } = await supabase
        .from('tool_access')
        .insert({
          user_id: viewer.userId,
          email,
          status: 'pending',
          tool: null,
          display_name: displayName,
          nickname,
          requested_at: new Date().toISOString()
        });
      // 23505 = 동시에 두 번 신청한 경우. 이미 행이 있으니 그대로 대기 응답.
      if (insertError && insertError.code !== '23505') return json(500, { error: 'db_error' });
      return json(403, { error: 'pending', status: 'pending' });
    }

    if (decision === 'pending') {
      const patch = {};
      if (!access.display_name && displayName) patch.display_name = displayName;
      if (!access.nickname && nickname) patch.nickname = nickname;
      if (Object.keys(patch).length) {
        await supabase.from('tool_access').update(patch).eq('id', access.id).then(null, () => {});
      }
      return json(403, { error: 'pending', status: 'pending' });
    }

    if (decision === 'deny') return json(403, { error: 'not_allowed' });

    const nowMs = Date.now();
    const exp = Math.floor(nowMs / 1000) + COOKIE_MAX_AGE;
    const kind = access.lifetime === true ? 'life' : 'std';
    const value = await signGateCookie(email, tool, secret, nowMs, kind);
    return json(200, { ok: true, tool, exp, kind }, {
      'Set-Cookie': [
        `kali_tool_gate=${value}`,
        'Path=/tools',
        `Max-Age=${COOKIE_MAX_AGE}`,
        'HttpOnly',
        'Secure',
        'SameSite=Lax'
      ].join('; ')
    });
  } catch {
    return json(500, { error: 'db_error' });
  }
}
