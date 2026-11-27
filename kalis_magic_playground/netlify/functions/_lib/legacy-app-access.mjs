// Keep the original account row and expand legacy `all` only at its boundaries.
function emailPattern(email) { return String(email).replace(/[\\%_]/g, '\\$&'); }

export const LEGACY_TOOLS = ['calc', 'stopwatch'];

export function legacyGrants(row) {
  if (!row) return {};
  if (row.per_app_access != null) return row.per_app_access;
  const tools = row.tool === 'all' ? LEGACY_TOOLS : LEGACY_TOOLS.includes(row.tool) ? [row.tool] : [];
  return Object.fromEntries(tools.map((tool) => [tool, {
    status: row.status, lifetime: row.lifetime === true
  }]));
}

export function expandLegacyAccess(row) {
  if (!row || (!row.tool && row.per_app_access == null)) return row ? [row] : [];
  return Object.entries(legacyGrants(row)).map(([tool, grant]) => ({ ...row, ...grant, tool }));
}

export function legacyAccessForTool(row, tool) {
  const grant = legacyGrants(row)[tool];
  return grant ? { ...row, ...grant, tool } : null;
}

function compareSnapshot(query, row) {
  query = query.eq('id', row.id).eq('status', row.status).eq('lifetime', row.lifetime === true);
  query = row.tool == null ? query.is('tool', null) : query.eq('tool', row.tool);
  return row.per_app_access == null
    ? query.is('per_app_access', null)
    : query.eq('per_app_access', JSON.stringify(row.per_app_access));
}

// Every read/modify/write uses a conditional snapshot. A concurrent writer either
// wins intact or makes us reread; adding one app never overwrites its sibling.
export async function mutateLegacyAccess(supabase, options) {
  const { id, email, userId, tool, action, lifetime = false, viewerId, note, displayName, nickname } = options;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let query = supabase.from('tool_access').select('*');
    if (id) query = query.eq('id', id);
    else if (userId) query = query.eq('user_id', userId);
    else query = query.ilike('email', emailPattern(email));
    let lookup = await query.limit(1).maybeSingle();
    if (!id && userId && !lookup.error && !lookup.data) {
      lookup = await supabase.from('tool_access').select('*').ilike('email', emailPattern(email)).limit(1).maybeSingle();
    }
    if (lookup.error) return { error: lookup.error.code || 'db_error' };
    const row = lookup.data;
    if (!row && (id || action === 'lifetime' || action === 'revoke')) return { error: 'not_found' };
    const grants = { ...legacyGrants(row) };
    const selected = tool === 'all' || !tool ? LEGACY_TOOLS : [tool];
    let changed = false;
    for (const key of selected) {
      const previous = grants[key];
      if (action === 'revoke') {
        if (previous) { delete grants[key]; changed = true; }
      } else if (action === 'lifetime') {
        if (previous?.status !== 'approved') return { error: 'not_found' };
        if (!previous.lifetime) { grants[key] = { ...previous, lifetime: true }; changed = true; }
      } else if (action === 'request') {
        if (!previous) { grants[key] = { status: 'pending', lifetime: false }; changed = true; }
      } else if (previous?.status !== 'approved') {
        grants[key] = { status: 'approved', lifetime };
        changed = true;
      }
    }
    if (!changed) return action === 'revoke' ? { error: 'not_found' } : { outcome: 'alreadyGranted' };
    const keys = Object.keys(grants);
    let mutation;
    if (!keys.length) {
      mutation = compareSnapshot(supabase.from('tool_access').delete(), row);
    } else {
      const patch = {
        per_app_access: grants,
        tool: keys.length === 2 ? 'all' : keys[0],
        status: keys.some((key) => grants[key].status === 'approved') ? 'approved' : 'pending',
        // Conservative compatibility summary; new readers use individual values.
        lifetime: keys.every((key) => grants[key].lifetime === true),
        approved_at: new Date().toISOString(), approved_by: viewerId || row?.approved_by || null
      };
      if (action === 'request') {
        delete patch.approved_at; delete patch.approved_by;
        if (displayName && !row?.display_name) patch.display_name = displayName;
        if (nickname && !row?.nickname) patch.nickname = nickname;
      }
      if (note) patch.note = note;
      if (userId && !row?.user_id) patch.user_id = userId;
      mutation = row
        ? compareSnapshot(supabase.from('tool_access').update(patch), row)
        : supabase.from('tool_access').insert({ ...patch, email, created_by: viewerId });
    }
    const result = await mutation.select('id');
    if (result.error?.code === '23505') continue;
    if (result.error) return { error: result.error.code || 'db_error' };
    if (result.data?.length) return { outcome: 'granted' };
  }
  return { error: 'concurrent_change' };
}
