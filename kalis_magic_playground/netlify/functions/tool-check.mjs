import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { gateCookieName, verifyGateCookie } from './_lib/tool-gate.mjs';
import { FRIEND_APP_TOOLS } from './_lib/friend-app-access.mjs';

export function clearGateCookie(tool) {
  return [
    `${gateCookieName(tool)}=`,
    FRIEND_APP_TOOLS.has(tool) ? 'Path=/' : 'Path=/tools',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Lax'
  ].join('; ');
}

export function allowOnCheckError(tool) {
  return !FRIEND_APP_TOOLS.has(tool);
}

export function selectGate(gates, requestedTool) {
  return gates.find((gate) => gate.valid &&
    (!requestedTool || gate.tool === requestedTool ||
      (!FRIEND_APP_TOOLS.has(requestedTool) && gate.tool === 'all'))) ||
    { valid: false, reason: 'invalid' };
}

// New app cookies use separate names so either approval can be revoked independently.
function gateCookieValues(event) {
  const header = event.headers?.cookie || event.headers?.Cookie || '';
  const requestedTool = event.queryStringParameters?.tool || null;
  const cookieName = gateCookieName(requestedTool);
  const values = [];
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === cookieName) {
      values.push(part.slice(separator + 1).trim());
    }
  }
  if (values.length) return values;
  try {
    const body = readJsonBody(event);
    return body?.cookie ? [String(body.cookie)] : [];
  } catch {
    return [];
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const gates = await Promise.all(gateCookieValues(event).map((value) =>
    verifyGateCookie(value, process.env.TOOL_GATE_SECRET, Date.now())));
  const requestedTool = event.queryStringParameters?.tool || null;
  const gate = selectGate(gates, requestedTool);
  if (!gate.valid) return json(200, { ok: false, reason: 'invalid' });

  try {
    let query = getSupabaseAdmin()
      .from(FRIEND_APP_TOOLS.has(gate.tool) ? 'friend_app_access' : 'tool_access')
      .select('tool,status')
      .eq('email', gate.email);
    if (FRIEND_APP_TOOLS.has(gate.tool)) query = query.eq('tool', gate.tool);
    const { data: row, error } = await query.limit(1).maybeSingle();
    // Legacy performance tools remain fail-open; friend distribution fails closed.
    if (error) return json(200, { ok: allowOnCheckError(gate.tool) });

    const allowed =
      row?.status === 'approved' && (row.tool === gate.tool || row.tool === 'all');
    return allowed
      ? json(200, { ok: true })
      : json(200, { ok: false, reason: 'revoked' }, { 'Set-Cookie': clearGateCookie(gate.tool) });
  } catch {
    return json(200, { ok: allowOnCheckError(gate.tool) });
  }
}
