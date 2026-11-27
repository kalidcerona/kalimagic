import { LEGACY_TOOLS, legacyAccessForTool } from './_lib/legacy-app-access.mjs';
import { json, readJsonBody } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';
import { gateCookieName, verifyGateCookie } from './_lib/tool-gate.mjs';
import { FRIEND_APP_TOOLS } from './_lib/friend-app-access.mjs';

export function clearGateCookie(tool) {
  return [
    `${gateCookieName(tool)}=`,
    'Path=/tools',
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
      (LEGACY_TOOLS.includes(requestedTool) && gate.tool === 'all'))) ||
    { valid: false, reason: 'invalid' };
}

// New app cookies use separate names so either approval can be revoked independently.
function gateCookieValues(event) {
  const header = event.headers?.cookie || event.headers?.Cookie || '';
  const requestedTool = event.queryStringParameters?.tool || null;
  const names = [gateCookieName(requestedTool)];
  if (!requestedTool) names.push(...LEGACY_TOOLS.map(gateCookieName));
  else if (LEGACY_TOOLS.includes(requestedTool)) names.push('kali_tool_gate');

  const parts = header.split(';').map((part) => part.trim());
  const values = names.flatMap((name) => parts
    .filter((part) => part.startsWith(name + '='))
    .map((part) => part.slice(name.length + 1)));
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
  // A scoped check uses its preferred signed cookie. An old unscoped caller
  // may have separate cookies for both apps and needs any active grant.
  const candidates = requestedTool ? [selectGate(gates, requestedTool)] : gates;
  let decision = { ok: false, reason: 'invalid' };
  let headers = {};
  for (const gate of candidates) {
    if (!gate.valid) continue;
    decision = await checkGrant(gate, requestedTool);
    if (decision.ok) return json(200, decision);
    headers = decision.reason === 'revoked' && !(requestedTool && gate.tool === 'all')
      ? { 'Set-Cookie': clearGateCookie(gate.tool) } : {};
  }
  return json(200, decision, headers);
}

async function checkGrant(gate, requestedTool) {
  try {
    let query = getSupabaseAdmin()
      .from(FRIEND_APP_TOOLS.has(gate.tool) ? 'friend_app_access' : 'tool_access')
      .select('*')
      .ilike('email', gate.email.replace(/[\\%_]/g, '\\$&'));
    if (FRIEND_APP_TOOLS.has(gate.tool)) query = query.eq('tool', gate.tool);
    const { data: row, error } = await query.limit(1).maybeSingle();
    // Legacy performance tools remain fail-open; friend distribution fails closed.
    if (error) return { ok: allowOnCheckError(gate.tool) };

    const selectedTool = requestedTool || gate.tool;
    const selected = row?.per_app_access != null
      ? selectedTool === 'all'
        ? ['calc', 'stopwatch'].every((tool) => legacyAccessForTool(row, tool)?.status === 'approved')
        : legacyAccessForTool(row, selectedTool)?.status === 'approved'
      : row?.status === 'approved' && (row.tool === selectedTool || row.tool === 'all');
    return selected ? { ok: true } : { ok: false, reason: 'revoked' };
  } catch {
    return { ok: allowOnCheckError(gate.tool) };
  }
}
