import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { verifyGateCookie } from './_lib/tool-gate.mjs';

const COOKIE_NAME = 'kali_tool_gate';
export function clearGateCookie(tool) {
  return [
    `${COOKIE_NAME}=`,
    tool === 'friend-apps' ? 'Path=/' : 'Path=/tools',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Lax'
  ].join('; ');
}

export function allowOnCheckError(tool) {
  return tool !== 'friend-apps';
}

export function selectGate(gates, requestedTool) {
  return gates.find((gate) => gate.valid &&
    (!requestedTool || gate.tool === requestedTool || gate.tool === 'all')) ||
    { valid: false, reason: 'invalid' };
}

// Existing /tools cookies and the friend-apps root cookie may share a name.
function gateCookieValues(event) {
  const header = event.headers?.cookie || event.headers?.Cookie || '';
  const values = [];
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === COOKIE_NAME) {
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
    const { data: row, error } = await getSupabaseAdmin()
      .from('tool_access')
      .select('tool,status')
      .eq('email', gate.email)
      .limit(1)
      .maybeSingle();
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
