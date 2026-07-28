import { bearerToken, requireViewer } from './_lib/auth.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { signGateCookie } from './_lib/tool-gate.mjs';

const COOKIE_MAX_AGE = 7_776_000;
const REQUESTABLE_TOOLS = new Set(['stopwatch', 'calc']);

async function viewerEmail(event, viewer, supabase) {
  if (viewer.email) return viewer.email;

  const token = bearerToken(event);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return data.user.email;
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
    const rawEmail = await viewerEmail(event, viewer, supabase);
    if (!rawEmail) return json(401, { error: 'auth_required' });
    const email = String(rawEmail).trim().toLowerCase();

    const { data: access, error } = await supabase
      .from('tool_access')
      .select('id,lifetime')
      .eq('email', email)
      .in('tool', [tool, 'all'])
      .limit(1)
      .maybeSingle();
    if (error) return json(500, { error: 'db_error' });
    if (!access) return json(403, { error: 'not_allowed' });

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
