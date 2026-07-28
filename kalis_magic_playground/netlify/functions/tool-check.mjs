import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { verifyGateCookie } from './_lib/tool-gate.mjs';

const COOKIE_NAME = 'kali_tool_gate';
const CLEAR_COOKIE = [
  `${COOKIE_NAME}=`,
  'Path=/tools',
  'Max-Age=0',
  'HttpOnly',
  'Secure',
  'SameSite=Lax'
].join('; ');

// 쿠키는 Path=/tools라 /tools/_check 리라이트로 들어올 때만 자동 전송된다.
// 그 경로를 못 쓰는 호출자를 위해 본문 {cookie}도 받는다.
function gateCookie(event) {
  const header = event.headers?.cookie || event.headers?.Cookie || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === COOKIE_NAME) {
      return part.slice(separator + 1).trim();
    }
  }
  try {
    const body = readJsonBody(event);
    return body?.cookie ? String(body.cookie) : null;
  } catch {
    return null;
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const gate = await verifyGateCookie(
    gateCookie(event),
    process.env.TOOL_GATE_SECRET,
    Date.now()
  );
  if (!gate.valid) return json(200, { ok: false, reason: 'invalid' });

  try {
    const { data: row, error } = await getSupabaseAdmin()
      .from('tool_access')
      .select('tool,status')
      .eq('email', gate.email)
      .limit(1)
      .maybeSingle();
    // DB 장애로 공연 중 도구가 잠기면 안 되므로 조회 실패는 통과시킨다(fail-open).
    if (error) return json(200, { ok: true });

    const allowed =
      row?.status === 'approved' && (row.tool === gate.tool || row.tool === 'all');
    return allowed
      ? json(200, { ok: true })
      : json(200, { ok: false, reason: 'revoked' }, { 'Set-Cookie': CLEAR_COOKIE });
  } catch {
    return json(200, { ok: true });
  }
}
